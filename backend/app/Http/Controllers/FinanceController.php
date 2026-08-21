<?php

namespace App\Http\Controllers;

use App\Models\Payment;
use App\Models\Visit;
use App\Models\Ingreso;
use App\Support\SqlPortability;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class FinanceController extends Controller
{
    public function summary()
    {
        // Use IngresoController's aggregated summary as primary source
        $data = IngresoController::buildSummary();

        // Append legacy activity heatmap from visits
        $now  = now();
        $heatStart = $now->copy()->subDays(364)->startOfDay();
        $heatmap = Visit::select(
                DB::raw('DATE(visit_date) as date'),
                DB::raw('COUNT(*) as count')
            )
            ->where('visit_date', '>=', $heatStart->toDateString())
            ->groupBy(DB::raw('DATE(visit_date)'))
            ->orderBy('date')
            ->get()
            ->map(fn ($r) => ['date' => $r->date, 'count' => (int) $r->count]);

        $data['activity_heatmap'] = $heatmap;
        return response()->json($data);
    }

    public function summaryLegacy()
    {
        $now           = now();
        $thisMonth     = $now->month;
        $thisYear      = $now->year;
        $lastMonth     = $now->copy()->subMonth()->month;
        $lastMonthYear = $now->copy()->subMonth()->year;

        // Membership revenue — from payments table
        $pBase      = Payment::where('status', 'completed');
        $mTotal     = (float) (clone $pBase)->sum('amount');
        $mThisMonth = (float) (clone $pBase)->whereMonth('payment_date', $thisMonth)->whereYear('payment_date', $thisYear)->sum('amount');
        $mLastMonth = (float) (clone $pBase)->whereMonth('payment_date', $lastMonth)->whereYear('payment_date', $lastMonthYear)->sum('amount');
        $mThisYear  = (float) (clone $pBase)->whereYear('payment_date', $thisYear)->sum('amount');

        // Visit revenue — from visits.price
        $vBase      = Visit::whereNotNull('price')->where('price', '>', 0);
        $vTotal     = (float) (clone $vBase)->sum('price');
        $vThisMonth = (float) (clone $vBase)->whereMonth('visit_date', $thisMonth)->whereYear('visit_date', $thisYear)->sum('price');
        $vLastMonth = (float) (clone $vBase)->whereMonth('visit_date', $lastMonth)->whereYear('visit_date', $lastMonthYear)->sum('price');
        $vThisYear  = (float) (clone $vBase)->whereYear('visit_date', $thisYear)->sum('price');

        // Payment method breakdown — memberships + visits combined
        $payMethods = Payment::where('status', 'completed')
            ->select('payment_method', DB::raw('SUM(amount) as total'), DB::raw('COUNT(*) as count'))
            ->groupBy('payment_method')
            ->get();

        $visitMethods = Visit::whereNotNull('price')
            ->where('price', '>', 0)
            ->whereNotNull('payment_method')
            ->select('payment_method', DB::raw('SUM(price) as total'), DB::raw('COUNT(*) as count'))
            ->groupBy('payment_method')
            ->get();

        $methodMap = [];
        foreach ($payMethods as $row) {
            $methodMap[$row->payment_method] = [
                'method' => $row->payment_method,
                'total'  => (float) $row->total,
                'count'  => (int) $row->count,
            ];
        }
        foreach ($visitMethods as $row) {
            if (isset($methodMap[$row->payment_method])) {
                $methodMap[$row->payment_method]['total'] += (float) $row->total;
                $methodMap[$row->payment_method]['count'] += (int) $row->count;
            } else {
                $methodMap[$row->payment_method] = [
                    'method' => $row->payment_method,
                    'total'  => (float) $row->total,
                    'count'  => (int) $row->count,
                ];
            }
        }
        $byMethod = collect($methodMap)->values();

        // Monthly revenue — last 12 months (payments + visit prices)
        $startDate = $now->copy()->startOfMonth()->subMonths(11);

        $payByMonth = Payment::where('status', 'completed')
            ->where('payment_date', '>=', $startDate)
            ->select(
                DB::raw(SqlPortability::yearExpr('payment_date')),
                DB::raw(SqlPortability::monthExpr('payment_date')),
                DB::raw('SUM(amount)         as total')
            )
            ->groupBy('year', 'month')
            ->get();

        $visitByMonth = Visit::whereNotNull('price')
            ->where('price', '>', 0)
            ->where('visit_date', '>=', $startDate)
            ->select(
                DB::raw(SqlPortability::yearExpr('visit_date')),
                DB::raw(SqlPortability::monthExpr('visit_date')),
                DB::raw('SUM(price)        as total')
            )
            ->groupBy('year', 'month')
            ->get();

        $monthMap = [];
        foreach ($payByMonth as $row) {
            $key = "{$row->year}-{$row->month}";
            $monthMap[$key] = ['year' => (int)$row->year, 'month' => (int)$row->month, 'total' => (float)$row->total];
        }
        foreach ($visitByMonth as $row) {
            $key = "{$row->year}-{$row->month}";
            if (isset($monthMap[$key])) {
                $monthMap[$key]['total'] += (float) $row->total;
            } else {
                $monthMap[$key] = ['year' => (int)$row->year, 'month' => (int)$row->month, 'total' => (float)$row->total];
            }
        }
        $byMonth = collect($monthMap)
            ->sortBy([['year', 'asc'], ['month', 'asc']])
            ->values();

        // ── This week revenue ──────────────────────────────────
        $weekStart = $now->copy()->startOfWeek();
        $wPay   = (float) Payment::where('status', 'completed')->where('payment_date', '>=', $weekStart)->sum('amount');
        $wVisit = (float) Visit::whereNotNull('price')->where('price', '>', 0)->where('visit_date', '>=', $weekStart)->sum('price');
        $thisWeek = $wPay + $wVisit;

        // ── Transaction counts & average ─────────────────────────
        $txCount  = Payment::where('status', 'completed')->count()
                  + Visit::whereNotNull('price')->where('price', '>', 0)->count();
        $grandTotal = $mTotal + $vTotal;
        $avgAmount  = $txCount > 0 ? round($grandTotal / $txCount, 2) : 0;

        // Membership tx count this month
        $memTxMonth  = Payment::where('status', 'completed')
            ->whereMonth('payment_date', $thisMonth)->whereYear('payment_date', $thisYear)->count();
        // Visit tx count this month
        $visitTxMonth = Visit::whereNotNull('price')->where('price', '>', 0)
            ->whereMonth('visit_date', $thisMonth)->whereYear('visit_date', $thisYear)->count();

        // ── Daily revenue for current month ──────────────────────
        $startOfMonth = $now->copy()->startOfMonth();

        $payByDay = Payment::where('status', 'completed')
            ->whereBetween('payment_date', [$startOfMonth->toDateString(), $now->toDateString()])
            ->select(DB::raw(SqlPortability::dayExpr('payment_date')), DB::raw('SUM(amount) as total'))
            ->groupBy('day')
            ->get()
            ->keyBy('day');

        $visitByDay = Visit::whereNotNull('price')
            ->where('price', '>', 0)
            ->whereBetween('visit_date', [$startOfMonth->toDateString(), $now->toDateString()])
            ->select(DB::raw(SqlPortability::dayExpr('visit_date')), DB::raw('SUM(price) as total'))
            ->groupBy('day')
            ->get()
            ->keyBy('day');

        $byDayMonth = [];
        for ($d = 1; $d <= $now->day; $d++) {
            $p = (float) ($payByDay[$d]->total ?? 0);
            $v = (float) ($visitByDay[$d]->total ?? 0);
            $byDayMonth[] = ['day' => $d, 'total' => $p + $v];
        }

        // ── Activity heatmap — daily visit count for past 365 days ──
        $heatStart = $now->copy()->subDays(364)->startOfDay();
        $heatmap = Visit::select(
                DB::raw('DATE(visit_date) as date'),
                DB::raw('COUNT(*) as count')
            )
            ->where('visit_date', '>=', $heatStart->toDateString())
            ->groupBy(DB::raw('DATE(visit_date)'))
            ->orderBy('date')
            ->get()
            ->map(fn ($r) => ['date' => $r->date, 'count' => (int) $r->count]);

        // ── Top paying members (all time) ────────────────────────
        $topPayRows = Payment::where('status', 'completed')
            ->select('member_id', DB::raw('SUM(amount) as total'), DB::raw('COUNT(*) as count'))
            ->groupBy('member_id')
            ->orderByDesc('total')
            ->limit(5)
            ->get();

        $topMemberIds = $topPayRows->pluck('member_id');
        $topMemberMap = \App\Models\Member::whereIn('id', $topMemberIds)
            ->get(['id', 'first_name', 'last_name', 'member_code'])
            ->keyBy('id');

        $topMembers = $topPayRows->map(fn ($p) => [
            'member'      => isset($topMemberMap[$p->member_id])
                ? "{$topMemberMap[$p->member_id]->first_name} {$topMemberMap[$p->member_id]->last_name}"
                : '—',
            'member_code' => $topMemberMap[$p->member_id]?->member_code,
            'total'       => (float) $p->total,
            'count'       => (int) $p->count,
        ]);

        return response()->json([
            'summary' => [
                'total'            => $grandTotal,
                'this_month'       => $mThisMonth + $vThisMonth,
                'last_month'       => $mLastMonth + $vLastMonth,
                'this_year'        => $mThisYear + $vThisYear,
                'this_week'        => $thisWeek,
                'total_tx'         => $txCount,
                'avg_amount'       => $avgAmount,
                'mem_tx_month'     => $memTxMonth,
                'visit_tx_month'   => $visitTxMonth,
            ],
            'by_source' => [
                ['label' => 'Membresías', 'value' => $mTotal, 'color' => '#6366F1'],
                ['label' => 'Visitas',    'value' => $vTotal, 'color' => '#10B981'],
            ],
            'by_method'        => $byMethod,
            'by_month'         => $byMonth,
            'by_day_month'     => $byDayMonth,
            'top_members'      => $topMembers,
            'activity_heatmap' => $heatmap,
        ]);
    }

    public function transactions(Request $request)
    {
        $page    = max(1, (int) $request->get('page', 1));
        $perPage = min(50, max(10, (int) $request->get('per_page', 20)));
        $month   = $request->get('month');
        $source  = $request->get('source');

        $payments = collect();
        $visits   = collect();

        if ($source !== 'visit') {
            $q = Payment::with('member:id,first_name,last_name,member_code')
                ->where('status', 'completed');
            if ($month) {
                $q->whereRaw(SqlPortability::yearMonthEquals('payment_date'), [$month]);
            }
            $payments = $q->orderByDesc('payment_date')->get()->map(fn ($p) => [
                'id'          => 'pay_' . $p->id,
                'source'      => 'membership',
                'member'      => $p->member?->full_name ?? '—',
                'member_code' => $p->member?->member_code,
                'amount'      => (float) $p->amount,
                'date'        => $p->payment_date,
                'method'      => $p->payment_method,
                'description' => 'Membresía',
            ]);
        }

        if ($source !== 'membership') {
            $q = Visit::with('member:id,first_name,last_name,member_code')
                ->whereNotNull('price')
                ->where('price', '>', 0);
            if ($month) {
                $q->whereRaw(SqlPortability::yearMonthEquals('visit_date'), [$month]);
            }
            $visits = $q->orderByDesc('visit_date')->get()->map(fn ($v) => [
                'id'          => 'vis_' . $v->id,
                'source'      => 'visit',
                'member'      => $v->member?->full_name ?? '—',
                'member_code' => $v->member?->member_code,
                'amount'      => (float) $v->price,
                'date'        => $v->visit_date,
                'method'      => $v->payment_method ?? 'cash',
                'description' => 'Visita · ' . ($v->visit_type ?? 'training'),
            ]);
        }

        $all   = $payments->concat($visits)->sortByDesc('date')->values();
        $total = $all->count();
        $items = $all->slice(($page - 1) * $perPage, $perPage)->values();

        return response()->json([
            'data'         => $items,
            'total'        => $total,
            'current_page' => $page,
            'last_page'    => (int) ceil($total / max(1, $perPage)),
            'per_page'     => $perPage,
        ]);
    }
}
