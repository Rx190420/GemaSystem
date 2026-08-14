<?php

namespace App\Http\Controllers;

use App\Models\Ingreso;
use App\Models\Member;
use App\Models\Membership;
use App\Models\Payment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MembershipController extends Controller
{
    public function summary()
    {
        $now = now();

        $total     = Membership::count();
        $active    = Membership::where('status', 'active')->count();
        $expired   = Membership::where('status', 'expired')->count();
        $cancelled = Membership::where('status', 'cancelled')->count();

        $byType = Membership::select('type', DB::raw('COUNT(*) as count'))
            ->groupBy('type')
            ->get()
            ->map(fn ($r) => ['type' => $r->type, 'count' => (int) $r->count]);

        $startDate = $now->copy()->startOfMonth()->subMonths(11);
        $byMonth = Membership::where('created_at', '>=', $startDate)
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
            'summary'  => compact('total', 'active', 'expired', 'cancelled'),
            'by_type'  => $byType,
            'by_month' => $byMonth,
        ]);
    }

    public function index(Request $request)
    {
        $query = Membership::with('member:id,first_name,last_name,member_code');

        if ($memberId = $request->get('member_id')) {
            $query->where('member_id', $memberId);
        }

        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }

        if ($search = $request->get('search')) {
            $query->whereHas('member', function ($q) use ($search) {
                $q->where('first_name', 'like', "%{$search}%")
                  ->orWhere('last_name',  'like', "%{$search}%")
                  ->orWhere('member_code','like', "%{$search}%");
            });
        }

        $memberships = $query->orderByDesc('created_at')->paginate($request->get('per_page', 20));

        return response()->json($memberships);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'member_id'       => ['required', $this->existsInGym('members')],
            'type'            => 'required|in:monthly,quarterly,biannual,annual,weekly,biweekly',
            'start_date'      => 'required|date',
            'end_date'        => 'required|date|after:start_date',
            'amount'          => 'required|numeric|min:0',
            'amount_paid'     => 'nullable|numeric|min:0',
            'payment_method'  => 'required|in:cash,card,transfer',
            'membership_type' => 'nullable|string|max:50',
        ]);

        $resolvedMembershipType = $data['membership_type'] ?? match ($data['type']) {
            'annual', 'biannual' => 'Premium',
            default              => 'Básica',
        };

        $existingActive = Membership::where('member_id', $data['member_id'])
            ->where('status', 'active')
            ->first();

        if ($existingActive) {
            $existingActive->update(['status' => 'expired']);
        }

        $membership = Membership::create(array_merge(
            array_diff_key($data, ['membership_type' => null]),
            ['status' => 'active']
        ));

        Member::where('id', $data['member_id'])->update([
            'membership_type'  => $resolvedMembershipType,
            'membership_start' => $data['start_date'],
            'membership_end'   => $data['end_date'],
            'status'           => 'active',
        ]);

        $payment = Payment::create([
            'member_id'      => $data['member_id'],
            'membership_id'  => $membership->id,
            'amount'         => $data['amount'],
            'amount_paid'    => $data['amount_paid'] ?? null,
            'payment_date'   => now()->toDateString(),
            'payment_method' => $data['payment_method'],
            'status'         => 'completed',
        ]);

        $planLabels = [
            'weekly'    => 'Semanal',
            'biweekly'  => 'Quincenal',
            'monthly'   => 'Mensual',
            'quarterly' => 'Trimestral',
            'biannual'  => 'Semestral',
            'annual'    => 'Anual',
        ];
        try {
            Ingreso::create([
                'member_id'      => $data['member_id'],
                'concept'        => 'Membresía ' . ($planLabels[$data['type']] ?? $data['type']),
                'amount'         => $data['amount'],
                'payment_method' => $data['payment_method'],
                'origin'         => 'membership',
                'reference_id'   => $payment->id,
                'reference_type' => 'payment',
                'date'           => $data['start_date'],
            ]);
        } catch (\Throwable $e) {
            \Log::warning("Ingreso auto-insert failed (membership {$membership->id}): " . $e->getMessage());
        }

        return response()->json($membership->load('member:id,first_name,last_name'), 201);
    }

    public function destroy(Membership $membership)
    {
        $membership->update(['status' => 'cancelled']);
        return response()->json(['message' => 'Membresía cancelada.']);
    }
}
