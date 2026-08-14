<?php

namespace App\Http\Controllers;

use App\Mail\TrialApproved;
use App\Mail\TrialRejected;
use App\Models\Gym;
use App\Models\SupportTicket;
use App\Models\TrialRequest;
use App\Models\User;
use App\Services\RecaptchaService;
use App\Services\WhatsAppService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class SuperAdminController extends Controller
{
    // ── Overview ─────────────────────────────────────────────────────────────

    public function stats()
    {
        return response()->json([
            'pending_trials'    => TrialRequest::where('status', 'pending')->count(),
            'total_gyms'        => Gym::count(),
            'free_gyms'         => Gym::where('plan_type', 'free')->count(),
            'paid_gyms'         => Gym::where('plan_type', 'paid')->count(),
            'active_gyms'       => Gym::where('status', 'active')->count(),
            'total_users'       => User::where('extended_access', 0)->count(),
            'unread_messages'   => \App\Models\FormSubmission::where('status', 'new')->count(),
            'open_tickets'      => SupportTicket::where('status', 'open')->count(),
        ]);
    }

    // ── Trial requests ────────────────────────────────────────────────────────

    public function trialRequests(Request $request)
    {
        $status = $request->query('status', 'pending');

        $q = TrialRequest::orderByDesc('created_at');
        if ($status !== 'all') {
            $q->where('status', $status);
        }

        return response()->json($q->get());
    }

    public function approveTrial(Request $request, TrialRequest $trial)
    {
        if ($trial->status !== 'pending') {
            return response()->json(['message' => 'La solicitud ya fue procesada.'], 422);
        }

        $request->validate([
            'username'  => 'required|string|max:50|unique:users|regex:/^[a-zA-Z0-9_]+$/',
            'password'  => 'required|string|min:8|max:255',
            'notes'     => 'nullable|string|max:1000',
            'send_email'=> 'nullable|boolean',
        ]);

        // Check email uniqueness — email comes from the trial form, not from request
        if (User::where('email', $trial->email)->exists()) {
            return response()->json([
                'message' => 'Ya existe una cuenta registrada con el correo ' . $trial->email . '. El gym puede ya estar en el sistema.',
            ], 422);
        }

        $plainPassword = $request->password;

        $result = DB::transaction(function () use ($request, $trial, $plainPassword) {
            $gym = Gym::create([
                'name'                   => $trial->gym_name,
                'code'                   => Gym::generateUniqueCode($trial->gym_name),
                'plan'                   => 'weekly',
                'plan_type'              => 'free',
                'status'                 => 'trialing',
                'billing_status'         => 'active',
                'subscription_starts_at' => now(),
                'subscription_ends_at'   => now()->addDays(10),
            ]);

            $user = User::create([
                'gym_id'               => $gym->id,
                'username'             => $request->username,
                'email'                => $trial->email,
                'password'             => Hash::make($plainPassword),
                'role'                 => 'admin',
                'account_status'       => 'active',
                'onboarding_completed' => false,
            ]);

            $trial->update([
                'status'         => 'approved',
                'reviewed_by'    => $request->user()->id,
                'reviewed_at'    => now(),
                'operator_notes' => $request->input('notes'),
            ]);

            return compact('gym', 'user');
        });

        // Send welcome email with credentials (unless operator explicitly opted out)
        if ($request->input('send_email', true)) {
            try {
                Mail::to($trial->email)->send(new TrialApproved(
                    $trial->gym_name,
                    $trial->contact_name,
                    $request->username,
                    $plainPassword,
                ));
            } catch (\Throwable $e) {
                \Log::warning("TrialApproved email failed for trial #{$trial->id}: " . $e->getMessage());
            }

            if ($trial->phone) {
                WhatsAppService::trialApproved($trial->phone, $trial->gym_name, $trial->contact_name, $request->username);
            }
        }

        return response()->json([
            'message'    => 'Cuenta de prueba creada' . ($request->input('send_email', true) ? ' y correo enviado.' : '.'),
            'gym_id'     => $result['gym']->id,
            'user_id'    => $result['user']->id,
        ]);
    }

    public function rejectTrial(Request $request, TrialRequest $trial)
    {
        if ($trial->status !== 'pending') {
            return response()->json(['message' => 'La solicitud ya fue procesada.'], 422);
        }

        $request->validate([
            'notes'      => 'nullable|string|max:1000',
            'send_email' => 'nullable|boolean',
        ]);

        $trial->update([
            'status'         => 'rejected',
            'reviewed_by'    => $request->user()->id,
            'reviewed_at'    => now(),
            'operator_notes' => $request->input('notes'),
        ]);

        if ($request->input('send_email', true)) {
            try {
                Mail::to($trial->email)->send(new TrialRejected(
                    $trial->gym_name,
                    $trial->contact_name,
                    $request->input('notes'),
                ));
            } catch (\Throwable $e) {
                \Log::warning("TrialRejected email failed for trial #{$trial->id}: " . $e->getMessage());
            }

            if ($trial->phone) {
                WhatsAppService::trialRejected($trial->phone, $trial->gym_name, $trial->contact_name, $request->input('notes'));
            }
        }

        return response()->json([
            'message' => 'Solicitud rechazada' . ($request->input('send_email', true) ? ' y notificación enviada.' : '.'),
        ]);
    }

    public function resendApprovalEmail(Request $request, TrialRequest $trial)
    {
        if ($trial->status !== 'approved') {
            return response()->json(['message' => 'Esta solicitud no está aprobada.'], 422);
        }

        $request->validate([
            'username' => 'required|string',
            'password' => 'required|string|min:8',
        ]);

        try {
            Mail::to($trial->email)->send(new TrialApproved(
                $trial->gym_name,
                $trial->contact_name,
                $request->username,
                $request->password,
            ));
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Error enviando correo: ' . $e->getMessage()], 500);
        }

        if ($trial->phone) {
            WhatsAppService::trialApproved($trial->phone, $trial->gym_name, $trial->contact_name, $request->username);
        }

        return response()->json(['message' => 'Correo de credenciales enviado a ' . $trial->email]);
    }

    public function resendRejectionEmail(Request $request, TrialRequest $trial)
    {
        if ($trial->status !== 'rejected') {
            return response()->json(['message' => 'Esta solicitud no está rechazada.'], 422);
        }

        try {
            Mail::to($trial->email)->send(new TrialRejected(
                $trial->gym_name,
                $trial->contact_name,
                $trial->operator_notes,
            ));
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Error enviando correo: ' . $e->getMessage()], 500);
        }

        if ($trial->phone) {
            WhatsAppService::trialRejected($trial->phone, $trial->gym_name, $trial->contact_name, $trial->operator_notes);
        }

        return response()->json(['message' => 'Notificación de rechazo enviada a ' . $trial->email]);
    }

    // ── Gyms list ─────────────────────────────────────────────────────────────

    public function gyms(Request $request)
    {
        $type = $request->query('type', 'all');

        $q = Gym::with(['users' => fn($q) => $q->where('role', 'admin')->select('id', 'gym_id', 'username', 'email', 'last_login', 'account_status')])
                 ->orderByDesc('created_at');

        if ($type !== 'all') {
            $q->where('plan_type', $type);
        }

        $gyms = $q->get()->map(function ($gym) {
            $sub  = $this->subscriptionInfo($gym);
            $data = $gym->toArray();
            $data['subscription']   = $sub;
            $data['admin']          = $gym->users->first();
            unset($data['users']);
            return $data;
        });

        return response()->json($gyms);
    }

    public function gymDetail(Gym $gym)
    {
        $users = User::where('gym_id', $gym->id)
                     ->select('id','username','email','role','account_status','restriction_reason','last_login','created_at')
                     ->get();

        // DB stats — paid gyms have dedicated DB, free gyms use shared
        $stats = $this->getGymStats($gym);

        return response()->json([
            'gym'          => $gym,
            'users'        => $users,
            'subscription' => $this->subscriptionInfo($gym),
            'stats'        => $stats,
        ]);
    }

    public function setBillingStatus(Request $request, Gym $gym)
    {
        $request->validate([
            'action' => 'required|in:suspend_now,suspend_on_expire,restore',
        ]);

        switch ($request->action) {
            case 'suspend_now':
                // Mark as payment_failed AND expire the subscription immediately → blocks login right now
                $gym->update([
                    'billing_status'       => 'payment_failed',
                    'subscription_ends_at' => now()->subSecond(), // set to past to trigger block
                ]);
                // Revoke all tokens so they're forced to re-login and see the block
                DB::table('personal_access_tokens')
                    ->whereIn('tokenable_id', User::where('gym_id', $gym->id)->pluck('id'))
                    ->where('tokenable_type', User::class)
                    ->delete();
                return response()->json(['message' => 'Suscripción suspendida. El acceso está bloqueado inmediatamente.']);

            case 'suspend_on_expire':
                // Mark as payment_failed but keep subscription_ends_at → blocks only when period ends
                $gym->update(['billing_status' => 'payment_failed']);
                return response()->json(['message' => 'Marcado como pago fallido. El acceso se bloqueará al vencer el período actual.']);

            case 'restore':
                $gym->update([
                    'billing_status' => 'active',
                    'status'         => 'active',
                ]);
                return response()->json(['message' => 'Facturación restaurada. El gym puede volver a acceder.']);
        }
    }

    private function getGymStats(Gym $gym): array
    {
        try {
            if ($gym->isPaid() && $gym->db_name) {
                config(['database.connections.tenant' => array_merge(
                    config('database.connections.mysql'),
                    ['database' => $gym->db_name]
                )]);
                DB::purge('tenant');
                $conn = DB::connection('tenant');
            } else {
                $conn = DB::connection();
            }

            $where = $gym->isPaid() ? [] : ['gym_id' => $gym->id];

            $members = $conn->table('members')
                ->when(!empty($where), fn($q) => $q->where($where))
                ->count();

            $activeMembers = $conn->table('members')
                ->when(!empty($where), fn($q) => $q->where($where))
                ->where('status', 'active')
                ->count();

            $visits = $conn->table('visits')
                ->when(!empty($where), fn($q) => $q->where($where))
                ->count();

            $visitsThisMonth = $conn->table('visits')
                ->when(!empty($where), fn($q) => $q->where($where))
                ->whereMonth('visit_date', now()->month)
                ->whereYear('visit_date', now()->year)
                ->count();

            $memberships = $conn->table('memberships')
                ->when(!empty($where), fn($q) => $q->where($where))
                ->count();

            $activeMemberships = $conn->table('memberships')
                ->when(!empty($where), fn($q) => $q->where($where))
                ->where('status', 'active')
                ->where('end_date', '>=', now()->toDateString())
                ->count();

            $payments = $conn->table('payments')
                ->when(!empty($where), fn($q) => $q->where($where))
                ->count();

            $revenue = (float) $conn->table('payments')
                ->when(!empty($where), fn($q) => $q->where($where))
                ->where('status', 'completed')
                ->sum('amount');

            return compact('members','activeMembers','visits','visitsThisMonth','memberships','activeMemberships','payments','revenue');
        } catch (\Throwable $e) {
            \Log::warning("getGymStats failed for gym {$gym->id}: " . $e->getMessage());
            return [];
        }
    }

    // ── Session management ────────────────────────────────────────────────────

    public function suspendGym(Request $request, Gym $gym)
    {
        $reason = $request->reason ?? null;

        DB::table('personal_access_tokens')
            ->whereIn('tokenable_id', User::where('gym_id', $gym->id)->pluck('id'))
            ->where('tokenable_type', User::class)
            ->delete();

        User::where('gym_id', $gym->id)
            ->where('extended_access', 0)
            ->update(['account_status' => 'suspended', 'restriction_reason' => $reason]);

        return response()->json(['message' => 'Sesiones suspendidas y tokens revocados.']);
    }

    public function restrictGym(Request $request, Gym $gym)
    {
        $reason = $request->reason ?? null;

        User::where('gym_id', $gym->id)
            ->where('extended_access', 0)
            ->update(['account_status' => 'restricted', 'restriction_reason' => $reason]);

        return response()->json(['message' => 'Acceso restringido.']);
    }

    public function activateGym(Gym $gym)
    {
        User::where('gym_id', $gym->id)
            ->where('extended_access', 0)
            ->update(['account_status' => 'active', 'restriction_reason' => null]);

        return response()->json(['message' => 'Acceso activado.']);
    }

    public function suspendUser(Request $request, User $user)
    {
        DB::table('personal_access_tokens')
            ->where('tokenable_id', $user->id)
            ->where('tokenable_type', User::class)
            ->delete();

        $user->update(['account_status' => 'suspended', 'restriction_reason' => $request->reason ?? null]);
        return response()->json(['message' => 'Usuario suspendido.']);
    }

    public function restrictUser(Request $request, User $user)
    {
        $user->update(['account_status' => 'restricted', 'restriction_reason' => $request->reason ?? null]);
        return response()->json(['message' => 'Usuario restringido.']);
    }

    public function activateUser(User $user)
    {
        $user->update(['account_status' => 'active', 'restriction_reason' => null]);
        return response()->json(['message' => 'Usuario activado.']);
    }

    // ── Credentials ───────────────────────────────────────────────────────────

    public function changePassword(Request $request, User $user)
    {
        $request->validate(['password' => 'required|string|min:8']);

        // Revoke all tokens so they must log in again
        $user->tokens()->delete();
        $user->update(['password' => Hash::make($request->password)]);

        return response()->json(['message' => 'Contraseña actualizada.']);
    }

    public function changeSecurityCode(Request $request, User $user)
    {
        $request->validate(['code' => 'required|string|min:4|max:20']);

        $plain = $request->code;
        $user->update([
            'access_code'       => Hash::make($plain),
            'access_code_plain' => $plain,
        ]);

        return response()->json(['message' => 'Código de seguridad actualizado.']);
    }

    public function removeSecurityCode(User $user)
    {
        $user->update(['access_code' => null, 'access_code_plain' => null]);
        return response()->json(['message' => 'Código de seguridad eliminado.']);
    }

    // ── Paid gym DB management ────────────────────────────────────────────────

    public function paidGymDbStats(Gym $gym)
    {
        if (!$gym->isPaid()) {
            return response()->json(['message' => 'Este gym no tiene base de datos dedicada.'], 422);
        }

        config(['database.connections.tenant' => array_merge(
            config('database.connections.mysql'),
            ['database' => $gym->db_name]
        )]);
        DB::purge('tenant');

        $counts = [
            'members'     => DB::connection('tenant')->table('members')->count(),
            'visits'      => DB::connection('tenant')->table('visits')->count(),
            'payments'    => DB::connection('tenant')->table('payments')->count(),
            'memberships' => DB::connection('tenant')->table('memberships')->count(),
        ];

        return response()->json([
            'gym'    => $gym->only('id', 'name', 'db_name', 'status'),
            'counts' => $counts,
        ]);
    }

    // ── Trial requests (public submit endpoint) ───────────────────────────────

    public function submitTrial(Request $request)
    {
        $data = $request->validate([
            'gym_name'        => 'required|string|max:100',
            'contact_name'    => 'required|string|max:100',
            'email'           => 'required|email|max:150',
            'phone'           => 'nullable|string|max:20',
            'recaptcha_token' => 'required|string',
        ]);

        if (! RecaptchaService::verify($data['recaptcha_token'], $request->ip())) {
            return response()->json(['message' => 'No pudimos verificar que eres humano. Intenta de nuevo.'], 422);
        }
        unset($data['recaptcha_token']);

        // Prevent duplicate pending requests from same email
        if (TrialRequest::where('email', $data['email'])->where('status', 'pending')->exists()) {
            return response()->json(['message' => 'Ya tienes una solicitud pendiente con ese correo.'], 422);
        }

        $trial = TrialRequest::create($data);

        return response()->json(['message' => 'Solicitud enviada. Te contactaremos pronto.', 'id' => $trial->id], 201);
    }

    // ── Suspension check manual ───────────────────────────────────────────────

    public function runSuspensionCheck()
    {
        $suspended = 0;
        $details   = [];

        // Gyms gratuitos con trial vencido
        $expiredFree = Gym::where('plan_type', 'free')
            ->whereNotNull('subscription_ends_at')
            ->where('subscription_ends_at', '<', now())
            ->where('status', '!=', 'suspended')
            ->get();

        foreach ($expiredFree as $gym) {
            $this->doSuspendGym($gym, 'trial_expired');
            $details[]  = ['id' => $gym->id, 'name' => $gym->name, 'reason' => 'trial_expired'];
            $suspended++;
        }

        // Gyms de pago con suscripción vencida (2 horas de gracia para webhooks Stripe)
        $expiredPaid = Gym::where('plan_type', 'paid')
            ->whereNotNull('subscription_ends_at')
            ->where('subscription_ends_at', '<', now()->subHours(2))
            ->where('status', '!=', 'suspended')
            ->get();

        foreach ($expiredPaid as $gym) {
            $this->doSuspendGym($gym, 'payment_due');
            $details[]  = ['id' => $gym->id, 'name' => $gym->name, 'reason' => 'payment_due'];
            $suspended++;
        }

        return response()->json([
            'suspended' => $suspended,
            'details'   => $details,
            'message'   => $suspended > 0
                ? "{$suspended} gym(s) suspendidos automáticamente."
                : 'No hay gyms con período vencido.',
        ]);
    }

    private function doSuspendGym(Gym $gym, string $billingStatus): void
    {
        $gym->update([
            'status'         => 'suspended',
            'billing_status' => $billingStatus,
        ]);

        $userIds = User::where('gym_id', $gym->id)->pluck('id');

        DB::table('personal_access_tokens')
            ->whereIn('tokenable_id', $userIds)
            ->where('tokenable_type', User::class)
            ->delete();

        User::where('gym_id', $gym->id)
            ->where('extended_access', 0)
            ->update(['account_status' => 'suspended']);
    }

    // ── Helper ────────────────────────────────────────────────────────────────

    private function subscriptionInfo(Gym $gym): array
    {
        $endsAt      = $gym->subscription_ends_at;
        $startsAt    = $gym->subscription_starts_at;
        $lastPayment = $gym->last_payment_at;
        $days        = $endsAt ? (int) now()->diffInDays(Carbon::parse($endsAt), false) : null;

        if ($gym->plan_type === 'free') {
            if ($gym->billing_status === 'trial_expired' || ($days !== null && $days < 0)) {
                $subStatus = 'expired';
            } elseif ($days !== null && $days <= 3) {
                $subStatus = 'expiring_soon';
            } elseif ($days !== null && $days <= 7) {
                $subStatus = 'expiring';
            } else {
                $subStatus = 'trial';
            }

            return [
                'plan'           => 'free',
                'billing_status' => $gym->billing_status ?? 'active',
                'sub_status'     => $subStatus,
                'starts_at'      => $startsAt?->toISOString(),
                'ends_at'        => $endsAt?->toISOString(),
                'last_payment'   => null,
                'days_remaining' => $days,
                'is_blocked'     => $gym->isBillingBlocked(),
            ];
        }

        if ($gym->billing_status === 'cancelled') {
            $subStatus = 'cancelled';
        } elseif ($gym->billing_status === 'payment_failed') {
            $subStatus = $days !== null && $days < 0 ? 'expired' : 'payment_failed';
        } elseif ($endsAt === null) {
            $subStatus = 'unknown';
        } elseif ($days < 0) {
            $subStatus = 'expired';
        } elseif ($days <= 3) {
            $subStatus = 'expiring_soon';
        } elseif ($days <= 7) {
            $subStatus = 'expiring';
        } else {
            $subStatus = 'active';
        }

        return [
            'plan'           => $gym->plan,
            'billing_status' => $gym->billing_status ?? 'none',
            'sub_status'     => $subStatus,
            'starts_at'      => $startsAt?->toISOString(),
            'ends_at'        => $endsAt?->toISOString(),
            'last_payment'   => $lastPayment?->toISOString(),
            'days_remaining' => $days,
            'is_blocked'     => $gym->isBillingBlocked(),
        ];
    }
}
