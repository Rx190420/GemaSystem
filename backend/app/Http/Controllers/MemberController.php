<?php

namespace App\Http\Controllers;

use App\Mail\MemberBirthdayMail;
use App\Mail\MemberRenewalMail;
use App\Mail\MemberWelcome;
use App\Mail\MembershipReminder;
use App\Models\Member;
use App\Models\Visit;
use App\Services\MemberCodeService;
use App\Services\NotificationService;
use App\Services\WhatsAppService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\Rule;

class MemberController extends Controller
{
    public function summary()
    {
        $now = now();

        $total     = Member::count();
        $active    = Member::where('status', 'active')->count();
        $inactive  = Member::where('status', 'inactive')->count();
        $suspended = Member::where('status', 'suspended')->count();

        $byType = Member::select('membership_type', DB::raw('COUNT(*) as count'))
            ->groupBy('membership_type')
            ->get()
            ->map(fn ($r) => ['type' => $r->membership_type, 'count' => (int) $r->count]);

        $startDate = $now->copy()->startOfMonth()->subMonths(11);
        $byMonth = Member::where('created_at', '>=', $startDate)
            ->select(
                DB::raw('YEAR(created_at) as year'),
                DB::raw('MONTH(created_at) as month'),
                DB::raw('COUNT(*) as count')
            )
            ->groupBy('year', 'month')
            ->orderBy('year')->orderBy('month')
            ->get()
            ->map(fn ($r) => ['year' => (int) $r->year, 'month' => (int) $r->month, 'count' => (int) $r->count]);

        return response()->json([
            'summary'  => compact('total', 'active', 'inactive', 'suspended'),
            'by_type'  => $byType,
            'by_month' => $byMonth,
        ]);
    }

    public function index(Request $request)
    {
        $query = Member::query();

        if ($search = $request->get('search')) {
            $query->search($search);
        }

        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }

        if ($type = $request->get('membership_type')) {
            $query->where('membership_type', $type);
        }

        $this->applySort($query, $request, ['first_name', 'membership_type', 'membership_end', 'status', 'created_at'], 'first_name');

        try {
            $members = (clone $query)
                ->select('members.*')
                ->with('labels')
                ->withCount('visits')
                ->addSelect([
                    'last_visit_date' => Visit::selectRaw('MAX(visit_date)')
                        ->whereColumn('member_id', 'members.id'),
                    'active_plan_type' => \App\Models\Membership::select('type')
                        ->whereColumn('member_id', 'members.id')
                        ->where('status', 'active')
                        ->orderByDesc('end_date')
                        ->limit(1),
                ])
                ->paginate($request->get('per_page', 12));
        } catch (\Throwable $e) {
            $members = $query->paginate($request->get('per_page', 12));
            $members->getCollection()->each(fn($m) => $m->setRelation('labels', collect([])));
        }

        return response()->json($members);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'first_name'              => 'required|string|max:100',
            'last_name'               => 'required|string|max:100',
            'email'                   => ['nullable', 'email', $this->uniqueForGym('members', 'email')],
            'phone'                   => 'nullable|string|max:20',
            'birth_date'              => 'nullable|date',
            'gender'                  => 'nullable|in:male,female,other',
            'address'                 => 'nullable|string',
            'emergency_contact_name'  => 'nullable|string|max:100',
            'emergency_contact_phone' => 'nullable|string|max:20',
            'membership_type'         => 'required|string|max:50',
            'discount_category'       => 'nullable|string|max:100',
            'membership_start'        => 'nullable|date',
            'membership_end'          => 'nullable|date|after_or_equal:membership_start',
        ]);

        $data['qr_token']    = MemberCodeService::qrToken();
        $data['member_code'] = MemberCodeService::next(MemberCodeService::gymPrefix());

        try {
            $member = Member::create($data);
        } catch (\Illuminate\Database\QueryException $e) {
            if (($e->errorInfo[1] ?? 0) === 1062) {
                return response()->json([
                    'message' => 'El correo electrónico ya está registrado en este gimnasio.',
                    'errors'  => ['email' => ['El correo electrónico ya está registrado en este gimnasio.']],
                ], 422);
            }
            throw $e;
        }

        $sendQrEmail = $request->boolean('send_qr_email', true);
        if ($member->email && $sendQrEmail) {
            try {
                Mail::to($member->email)->send(new MemberWelcome($member));
            } catch (\Throwable $e) {
                \Log::warning("Welcome email failed for member {$member->id}: " . $e->getMessage());
            }
        }

        $gymId = auth()->user()->gym_id;
        if ($gymId) {
            NotificationService::memberRegistered($member, $gymId);
        }

        try {
            $member->load('labels');
        } catch (\Throwable $e) {
            $member->setRelation('labels', collect([]));
        }

        return response()->json($member, 201);
    }

    public function show(Member $member)
    {
        try {
            $member->load('memberships', 'activeMembership', 'labels');
        } catch (\Throwable $e) {
            $member->load('memberships', 'activeMembership');
            $member->setRelation('labels', collect([]));
        }

        $totalVisits = $member->visits()->count();
        $monthVisits = $member->visits()->whereMonth('visit_date', now()->month)->count();
        $weekVisits  = $member->visits()->where('visit_date', '>=', now()->startOfWeek())->count();
        $daysActive  = $member->created_at ? $member->created_at->diffInDays(now()) : 0;

        $recentVisits = $member->visits()
            ->orderByDesc('visit_date')
            ->limit(5)
            ->get(['id', 'visit_date', 'visit_type', 'notes']);

        return response()->json([
            'member'        => $member,
            'stats'         => compact('totalVisits', 'monthVisits', 'weekVisits', 'daysActive'),
            'recent_visits' => $recentVisits,
        ]);
    }

    public function update(Request $request, Member $member)
    {
        $data = $request->validate([
            'first_name'              => 'sometimes|string|max:100',
            'last_name'               => 'sometimes|string|max:100',
            'email'                   => ['sometimes', 'nullable', 'email', $this->uniqueForGym('members', 'email', $member->id)],
            'phone'                   => 'sometimes|nullable|string|max:20',
            'birth_date'              => 'sometimes|nullable|date',
            'gender'                  => 'sometimes|nullable|in:male,female,other',
            'address'                 => 'sometimes|nullable|string',
            'emergency_contact_name'  => 'sometimes|nullable|string|max:100',
            'emergency_contact_phone' => 'sometimes|nullable|string|max:20',
            'membership_type'         => 'sometimes|nullable|string|max:50',
            'discount_category'       => 'sometimes|nullable|string|max:100',
            'membership_start'        => 'sometimes|nullable|date',
            'membership_end'          => 'sometimes|nullable|date',
            'status'                  => 'sometimes|in:active,inactive,suspended',
        ]);

        $member->update($data);

        try {
            $member->load('labels');
        } catch (\Throwable $e) {
            $member->setRelation('labels', collect([]));
        }

        return response()->json($member);
    }

    public function sendNotification(Member $member)
    {
        if (!$member->email) {
            return response()->json(['message' => 'El miembro no tiene correo electrónico registrado.'], 422);
        }

        try {
            $member->load('activeMembership');
            Mail::to($member->email)->send(new MemberWelcome($member));
            return response()->json(['message' => 'Notificación enviada correctamente.']);
        } catch (\Throwable $e) {
            \Log::warning("Notification email failed for member {$member->id}: " . $e->getMessage());
            return response()->json(['message' => 'No se pudo enviar la notificación. Verifica la configuración de correo.'], 500);
        }
    }

    public function sendWhatsApp(Member $member)
    {
        if (!$member->phone) {
            return response()->json(['message' => 'El miembro no tiene teléfono registrado.'], 422);
        }

        if (!WhatsAppService::enabled()) {
            return response()->json(['message' => 'El bot de WhatsApp no está activo. Verifica la configuración.'], 503);
        }

        $gymId   = auth()->user()->gym_id;
        $gymName = $gymId ? \App\Models\Gym::find($gymId)?->name : null;
        WhatsAppService::memberWelcome(
            $member->phone,
            $member->first_name,
            $member->member_code,
            $gymName,
            $member->membership_end?->format('d/m/Y'),
            $member->qr_token,
            $gymId
        );

        return response()->json(['message' => 'Mensaje de WhatsApp enviado correctamente.']);
    }

    public function notifyMembership(Member $member)
    {
        if (!$member->email) {
            return response()->json(['message' => 'El miembro no tiene correo electrónico registrado.'], 422);
        }

        // Direct query — avoids the unreliable latestOfMany() in Laravel 8
        $active = \App\Models\Membership::where('member_id', $member->id)
            ->where('status', 'active')
            ->latest('end_date')
            ->first();

        if (!$active) {
            return response()->json(['has_membership' => false], 200);
        }

        $member->setRelation('activeMembership', $active);

        $endDate  = \Carbon\Carbon::parse($active->end_date->format('Y-m-d'));
        $today    = now()->startOfDay();
        $daysLeft = (int) max(0, $today->diffInDays($endDate, false));

        try {
            Mail::to($member->email)->send(
                new MembershipReminder($member, $daysLeft, $endDate->format('d/m/Y'))
            );
        } catch (\Throwable $e) {
            \Log::warning("Membership reminder email failed for member {$member->id}: " . $e->getMessage());
            return response()->json(['message' => 'No se pudo enviar la notificación. Verifica la configuración de correo.'], 500);
        }

        if ($member->phone) {
            $gymId   = auth()->user()->gym_id;
            $gymName = $gymId ? \App\Models\Gym::find($gymId)?->name : null;
            WhatsAppService::membershipReminder(
                $member->phone,
                $member->first_name,
                $member->member_code,
                $daysLeft,
                $endDate->format('d/m/Y'),
                $gymName,
                $gymId
            );
        }

        return response()->json([
            'has_membership' => true,
            'days_left'      => $daysLeft,
            'end_date'       => $endDate->format('d/m/Y'),
            'message'        => 'Notificación enviada correctamente.',
        ]);
    }

    public function notify(Request $request, Member $member)
    {
        $request->validate([
            'type'    => 'required|in:qr,reminder,birthday,renewal',
            'channel' => 'required|in:email,whatsapp',
        ]);

        $type    = $request->type;
        $channel = $request->channel;
        $gymId   = auth()->user()->gym_id;
        $gymName = $gymId ? \App\Models\Gym::find($gymId)?->name : null;

        if ($channel === 'email' && !$member->email) {
            return response()->json(['message' => 'El miembro no tiene correo registrado.'], 422);
        }
        if ($channel === 'whatsapp' && !$member->phone) {
            return response()->json(['message' => 'El miembro no tiene teléfono registrado.'], 422);
        }

        try {
            match ($type) {
                'qr' => $this->doNotifyQr($member, $channel, $gymName, $gymId),
                'reminder' => $this->doNotifyReminder($member, $channel, $gymName, $gymId),
                'birthday' => $this->doNotifyBirthday($member, $channel, $gymName, $gymId),
                'renewal'  => $this->doNotifyRenewal($member, $channel, $gymName, $gymId),
            };
        } catch (\Throwable $e) {
            \Log::warning("Member notify [{$type}/{$channel}] failed: " . $e->getMessage());
            return response()->json(['message' => 'No se pudo enviar la notificación. Verifica la configuración.'], 500);
        }

        return response()->json(['message' => 'Notificación enviada correctamente.']);
    }

    private function doNotifyQr(Member $member, string $channel, ?string $gymName, ?int $gymId): void
    {
        if ($channel === 'email') {
            Mail::to($member->email)->send(new MemberWelcome($member));
        } else {
            WhatsAppService::memberWelcome(
                $member->phone,
                $member->first_name,
                $member->member_code,
                $gymName,
                $member->membership_end?->format('d/m/Y'),
                $member->qr_token,
                $gymId
            );
        }
    }

    private function doNotifyReminder(Member $member, string $channel, ?string $gymName, ?int $gymId): void
    {
        $active = \App\Models\Membership::where('member_id', $member->id)
            ->where('status', 'active')
            ->latest('end_date')
            ->first();

        $endDate  = $active
            ? \Carbon\Carbon::parse($active->end_date->format('Y-m-d'))
            : ($member->membership_end ? \Carbon\Carbon::parse($member->membership_end) : null);

        $daysLeft = $endDate
            ? (int) max(0, now()->startOfDay()->diffInDays($endDate, false))
            : 0;

        $endDateStr = $endDate?->format('d/m/Y') ?? '—';

        if ($active) {
            $member->setRelation('activeMembership', $active);
        }

        if ($channel === 'email') {
            Mail::to($member->email)->send(new MembershipReminder($member, $daysLeft, $endDateStr));
        } else {
            WhatsAppService::membershipReminder(
                $member->phone,
                $member->first_name,
                $member->member_code,
                $daysLeft,
                $endDateStr,
                $gymName,
                $gymId
            );
        }
    }

    private function doNotifyBirthday(Member $member, string $channel, ?string $gymName, ?int $gymId): void
    {
        if ($channel === 'email') {
            Mail::to($member->email)->send(new MemberBirthdayMail($member, $gymName));
        } else {
            WhatsAppService::birthdayGreeting($member->phone, $member->first_name, $gymName, $gymId);
        }
    }

    private function doNotifyRenewal(Member $member, string $channel, ?string $gymName, ?int $gymId): void
    {
        $endDate = $member->activeMembership?->end_date?->format('d/m/Y')
            ?? $member->membership_end?->format('d/m/Y');

        if ($channel === 'email') {
            Mail::to($member->email)->send(new MemberRenewalMail($member, $gymName, $endDate));
        } else {
            WhatsAppService::renewalInvitation(
                $member->phone,
                $member->first_name,
                $member->member_code,
                $endDate,
                $gymName,
                $gymId
            );
        }
    }

    public function destroy(Member $member)
    {
        $member->delete();
        return response()->json(['message' => 'Miembro eliminado correctamente.']);
    }

    public function search(Request $request)
    {
        $term = $request->get('q', '');

        try {
            $members = Member::search($term)
                ->with('labels')
                ->limit(10)
                ->get(['id', 'member_code', 'first_name', 'last_name', 'email', 'phone', 'membership_type', 'status', 'qr_token']);
        } catch (\Throwable $e) {
            $members = Member::search($term)
                ->limit(10)
                ->get(['id', 'member_code', 'first_name', 'last_name', 'email', 'phone', 'membership_type', 'status', 'qr_token']);
            $members->each(fn($m) => $m->setRelation('labels', collect([])));
        }

        return response()->json($members->map(fn($m) => array_merge(
            $m->toArray(),
            ['full_name' => $m->full_name]
        )));
    }

    public function qr(Member $member)
    {
        return response()->json([
            'id'          => $member->id,
            'member_code' => $member->member_code,
            'full_name'   => $member->full_name,
            'qr_token'    => $member->qr_token,
        ]);
    }

    public function membershipStatus(Member $member)
    {
        $hasActive = $this->hasMembership($member);

        $activeMembership = $member->memberships()
            ->where('status', 'active')
            ->where('end_date', '>=', now()->toDateString())
            ->latest('end_date')
            ->first(['id', 'type', 'end_date', 'status', 'amount']);

        // Distinguish "never had a membership" from "had one and it lapsed" —
        // and surface the member's own status (e.g. suspended) — so the front
        // desk gets the same clear messaging here as in the QR-scan flow.
        $lastMembership = $hasActive ? null : $member->memberships()
            ->latest('end_date')
            ->first(['id', 'type', 'end_date', 'status', 'amount']);

        return response()->json([
            'has_active_membership' => $hasActive,
            'membership'            => $activeMembership,
            'last_membership'       => $lastMembership,
            'membership_end'        => $member->membership_end?->toDateString(),
            'member_status'         => $member->status,
        ]);
    }

    public function scanQr(Request $request)
    {
        $request->validate([
            'token'          => 'required|string',
            'price'          => 'nullable|numeric|min:0',
            'payment_method' => 'nullable|in:cash,card,transfer',
            'amount_paid'    => 'nullable|numeric|min:0',
            'confirmed'      => 'nullable|boolean',
        ]);

        // GymScope + tenant isolation ensures QR tokens only match members of the current gym
        $member = Member::where('qr_token', $request->token)->first();

        if (!$member) {
            // Could be invalid token OR a member from a different gym
            return response()->json([
                'message' => 'QR no reconocido. Este código no pertenece a ningún miembro de este gimnasio.',
            ], 404);
        }

        if ($member->status === 'suspended') {
            return response()->json(['message' => "La membresía de {$member->first_name} está suspendida."], 403);
        }

        $hasActive = $this->hasMembership($member);

        if (!$hasActive && !$request->boolean('confirmed')) {
            // Distinguish "never had a membership" from "had one and it lapsed" so the
            // front desk can offer to renew instead of only charging a walk-in visit.
            $lastMembership = $member->memberships()
                ->latest('end_date')
                ->first(['id', 'type', 'end_date', 'status', 'amount']);

            return response()->json([
                'requires_payment'      => true,
                'has_active_membership' => false,
                'member'          => $member->only('id', 'member_code', 'first_name', 'last_name', 'membership_type', 'status'),
                'last_membership' => $lastMembership,
            ]);
        }

        $visit = Visit::create([
            'member_id'      => $member->id,
            'visit_date'     => now(),
            'visit_type'     => 'training',
            'price'          => $hasActive ? null : ($request->price ?? null),
            'payment_method' => $hasActive ? null : ($request->payment_method ?? null),
            'amount_paid'    => $hasActive ? null : ($request->amount_paid ?? null),
        ]);

        return response()->json([
            'has_active_membership' => $hasActive,
            'member' => $member->only('id', 'member_code', 'first_name', 'last_name', 'membership_type', 'status'),
            'visit'  => $visit,
        ]);
    }

    private function hasMembership(Member $member): bool
    {
        $inTable = $member->memberships()
            ->where('status', 'active')
            ->where('end_date', '>=', now()->toDateString())
            ->exists();

        if ($inTable) return true;

        return $member->membership_end
            && !$member->membership_end->isPast()
            && $member->status === 'active'
            && (!$member->membership_start || !$member->membership_start->isFuture());
    }

    public function activity(Member $member, Request $request)
    {
        if ($request->filled('from') && $request->filled('to')) {
            $from = \Carbon\Carbon::parse($request->get('from'))->startOfDay();
            $to   = \Carbon\Carbon::parse($request->get('to'))->endOfDay();
        } else {
            $from = now()->subDays(364)->startOfDay();
            $to   = now()->endOfDay();
        }

        $counts = $member->visits()
            ->whereBetween('visit_date', [$from->toDateString(), $to->toDateString()])
            ->selectRaw('DATE(visit_date) as date, COUNT(*) as count')
            ->groupBy(DB::raw('DATE(visit_date)'))
            ->pluck('count', 'date');

        $days    = [];
        $current = $from->copy()->startOfDay();
        while ($current <= $to) {
            $date   = $current->format('Y-m-d');
            $days[] = ['date' => $date, 'count' => (int) ($counts->get($date) ?? 0)];
            $current->addDay();
        }

        return response()->json($days);
    }

}
