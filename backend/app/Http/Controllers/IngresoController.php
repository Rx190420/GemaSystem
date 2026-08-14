<?php

namespace App\Http\Controllers;

use App\Models\Ingreso;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class IngresoController extends Controller
{
    // ── List with filters + pagination ─────────────────────────────────────────

    public function index(Request $request)
    {
        $query = Ingreso::with('member:id,first_name,last_name,member_code');

        if ($month = $request->get('month')) {
            $query->whereRaw("DATE_FORMAT(date, '%Y-%m') = ?", [$month]);
        }

        if ($origin = $request->get('origin')) {
            $query->where('origin', $origin);
        }

        if ($method = $request->get('method')) {
            $query->where('payment_method', $method);
        }

        if ($memberId = $request->get('member_id')) {
            $query->where('member_id', $memberId);
        }

        if ($from = $request->get('from')) {
            $query->where('date', '>=', $from);
        }

        if ($to = $request->get('to')) {
            $query->where('date', '<=', $to);
        }

        $ingresos = $query->orderByDesc('date')
            ->orderByDesc('created_at')
            ->paginate($request->get('per_page', 25));

        $ingresos->getCollection()->transform(fn ($i) => [
            'id'             => $i->id,
            'member'         => $i->member ? "{$i->member->first_name} {$i->member->last_name}" : null,
            'member_code'    => $i->member?->member_code,
            'member_id'      => $i->member_id,
            'concept'        => $i->concept,
            'amount'         => (float) $i->amount,
            'payment_method' => $i->payment_method,
            'origin'         => $i->origin,
            'reference_id'   => $i->reference_id,
            'reference_type' => $i->reference_type,
            'date'           => $i->date?->format('Y-m-d'),
            'notes'          => $i->notes,
            'created_at'     => $i->created_at?->toIso8601String(),
        ]);

        return response()->json($ingresos);
    }

    // ── Create manual income ───────────────────────────────────────────────────

    public function store(Request $request)
    {
        $data = $request->validate([
            'member_id'      => ['nullable', $this->existsInGym('members')],
            'concept'        => 'required|string|max:255',
            'amount'         => 'required|numeric|min:0.01|max:999999.99',
            'payment_method' => 'required|in:cash,card,transfer',
            'origin'         => 'nullable|in:membership,visit,manual',
            'date'           => 'required|date|before_or_equal:today',
            'notes'          => 'nullable|string|max:1000',
        ]);

        $data['origin']         = $data['origin'] ?? 'manual';
        $data['reference_type'] = null;

        $ingreso = Ingreso::create($data);
        $ingreso->load('member:id,first_name,last_name,member_code');

        $gymId = auth()->user()->gym_id;
        if ($gymId) {
            $memberName = $ingreso->member
                ? "{$ingreso->member->first_name} {$ingreso->member->last_name}"
                : null;
            NotificationService::paymentReceived(
                $gymId,
                $ingreso->member_id,
                $memberName,
                (float) $ingreso->amount,
                $ingreso->concept
            );
        }

        return response()->json([
            'id'             => $ingreso->id,
            'member'         => $ingreso->member ? "{$ingreso->member->first_name} {$ingreso->member->last_name}" : null,
            'member_code'    => $ingreso->member?->member_code,
            'member_id'      => $ingreso->member_id,
            'concept'        => $ingreso->concept,
            'amount'         => (float) $ingreso->amount,
            'payment_method' => $ingreso->payment_method,
            'origin'         => $ingreso->origin,
            'date'           => $ingreso->date?->format('Y-m-d'),
            'notes'          => $ingreso->notes,
        ], 201);
    }

    // ── Update ─────────────────────────────────────────────────────────────────

    public function update(Request $request, Ingreso $ingreso)
    {
        $data = $request->validate([
            'member_id'      => ['nullable', $this->existsInGym('members')],
            'concept'        => 'sometimes|required|string|max:255',
            'amount'         => 'sometimes|required|numeric|min:0.01|max:999999.99',
            'payment_method' => 'sometimes|required|in:cash,card,transfer',
            'date'           => 'sometimes|required|date|before_or_equal:today',
            'notes'          => 'nullable|string|max:1000',
        ]);

        $ingreso->update($data);
        $ingreso->load('member:id,first_name,last_name,member_code');

        return response()->json([
            'id'             => $ingreso->id,
            'member'         => $ingreso->member ? "{$ingreso->member->first_name} {$ingreso->member->last_name}" : null,
            'member_code'    => $ingreso->member?->member_code,
            'member_id'      => $ingreso->member_id,
            'concept'        => $ingreso->concept,
            'amount'         => (float) $ingreso->amount,
            'payment_method' => $ingreso->payment_method,
            'origin'         => $ingreso->origin,
            'date'           => $ingreso->date?->format('Y-m-d'),
            'notes'          => $ingreso->notes,
        ]);
    }

    // ── Delete ─────────────────────────────────────────────────────────────────

    public function destroy(Ingreso $ingreso)
    {
        $ingreso->delete();
        return response()->json(['message' => 'Ingreso eliminado correctamente.']);
    }

    // ── Summary stats (used by FinanceController) ──────────────────────────────

    public static function buildSummary(): array
    {
        $now           = now();
        $thisMonth     = $now->month;
        $thisYear      = $now->year;
        $lastMonth     = $now->copy()->subMonth()->month;
        $lastMonthYear = $now->copy()->subMonth()->year;
        $weekStart     = $now->copy()->startOfWeek();

        $base = Ingreso::query();

        $total      = (float) (clone $base)->sum('amount');
        $thisMonthV = (float) (clone $base)->whereMonth('date', $thisMonth)->whereYear('date', $thisYear)->sum('amount');
        $lastMonthV = (float) (clone $base)->whereMonth('date', $lastMonth)->whereYear('date', $lastMonthYear)->sum('amount');
        $thisYearV  = (float) (clone $base)->whereYear('date', $thisYear)->sum('amount');
        $thisWeekV  = (float) (clone $base)->where('date', '>=', $weekStart)->sum('amount');
        $txCount    = (clone $base)->count();
        $avgAmount  = $txCount > 0 ? round($total / $txCount, 2) : 0;

        $memMonth   = (float) (clone $base)->where('origin', 'membership')->whereMonth('date', $thisMonth)->whereYear('date', $thisYear)->sum('amount');
        $visitMonth = (float) (clone $base)->where('origin', 'visit')->whereMonth('date', $thisMonth)->whereYear('date', $thisYear)->sum('amount');
        $memTxMonth  = (clone $base)->where('origin', 'membership')->whereMonth('date', $thisMonth)->whereYear('date', $thisYear)->count();
        $visitTxMonth = (clone $base)->where('origin', 'visit')->whereMonth('date', $thisMonth)->whereYear('date', $thisYear)->count();

        // By source (all time)
        $bySourceRaw = Ingreso::select('origin', DB::raw('SUM(amount) as total'))
            ->groupBy('origin')->get();
        $bySource = $bySourceRaw->map(fn ($r) => [
            'label' => match($r->origin) {
                'membership' => 'Membresías',
                'visit'      => 'Visitas',
                'product'    => 'Productos',
                default      => 'Manual',
            },
            'origin' => $r->origin,
            'value'  => (float) $r->total,
            'color'  => match($r->origin) {
                'membership' => '#6366F1',
                'visit'      => '#10B981',
                'product'    => '#F97316',
                default      => '#F59E0B',
            },
        ])->values();

        // By method
        $byMethod = Ingreso::select('payment_method', DB::raw('SUM(amount) as total'), DB::raw('COUNT(*) as count'))
            ->groupBy('payment_method')->get()
            ->map(fn ($r) => [
                'method' => $r->payment_method,
                'total'  => (float) $r->total,
                'count'  => (int) $r->count,
            ])->values();

        // By month (last 12)
        $startDate = $now->copy()->startOfMonth()->subMonths(11);
        $byMonthRaw = Ingreso::where('date', '>=', $startDate)
            ->select(
                DB::raw('YEAR(date) as year'),
                DB::raw('MONTH(date) as month'),
                DB::raw('SUM(amount) as total')
            )
            ->groupBy('year', 'month')
            ->orderBy('year')->orderBy('month')
            ->get();
        $byMonth = $byMonthRaw->map(fn ($r) => [
            'year'  => (int) $r->year,
            'month' => (int) $r->month,
            'total' => (float) $r->total,
        ])->values();

        // By day (current month)
        $startOfMonth = $now->copy()->startOfMonth();
        $byDayRaw = Ingreso::whereBetween('date', [$startOfMonth->toDateString(), $now->toDateString()])
            ->select(DB::raw('DAY(date) as day'), DB::raw('SUM(amount) as total'))
            ->groupBy('day')->get()->keyBy('day');
        $byDayMonth = [];
        for ($d = 1; $d <= $now->day; $d++) {
            $byDayMonth[] = ['day' => $d, 'total' => (float) ($byDayRaw[$d]->total ?? 0)];
        }

        // Top paying members
        $topRows = Ingreso::whereNotNull('member_id')
            ->select('member_id', DB::raw('SUM(amount) as total'), DB::raw('COUNT(*) as count'))
            ->groupBy('member_id')->orderByDesc('total')->limit(5)->get();
        $memberMap = \App\Models\Member::whereIn('id', $topRows->pluck('member_id'))
            ->get(['id', 'first_name', 'last_name', 'member_code'])->keyBy('id');
        $topMembers = $topRows->map(fn ($r) => [
            'member'      => isset($memberMap[$r->member_id])
                ? "{$memberMap[$r->member_id]->first_name} {$memberMap[$r->member_id]->last_name}"
                : '—',
            'member_code' => $memberMap[$r->member_id]?->member_code,
            'total'       => (float) $r->total,
            'count'       => (int) $r->count,
        ]);

        return [
            'summary' => [
                'total'          => $total,
                'this_month'     => $thisMonthV,
                'last_month'     => $lastMonthV,
                'this_year'      => $thisYearV,
                'this_week'      => $thisWeekV,
                'total_tx'       => $txCount,
                'avg_amount'     => $avgAmount,
                'mem_tx_month'   => $memTxMonth,
                'visit_tx_month' => $visitTxMonth,
            ],
            'by_source'    => $bySource,
            'by_method'    => $byMethod,
            'by_month'     => $byMonth,
            'by_day_month' => $byDayMonth,
            'top_members'  => $topMembers,
        ];
    }
}
