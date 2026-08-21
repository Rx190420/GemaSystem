<?php

namespace App\Http\Controllers;

use App\Models\Member;
use App\Models\Membership;
use App\Models\Payment;
use App\Models\Trainer;
use App\Models\Visit;
use App\Support\SqlPortability;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function stats()
    {
        // Short-lived cache: this endpoint alone runs ~20 queries, each a
        // real network round-trip against Supabase (~300-500ms), so it's the
        // single heaviest request in the app. A 30s cache means bursts of
        // dashboard loads (switching tabs, multiple staff, page refresh)
        // hit the cache instead of recomputing everything each time.
        //
        // Keyed by gym_id — GymScope filters every query below by the
        // authenticated user's gym automatically, so the cached payload is
        // only valid for that same gym. The operator/super-admin account has
        // no gym_id (sees all gyms unscoped), hence the 'super' fallback —
        // never share a cache key between different gyms' data.
        $user     = auth('sanctum')->user();
        $cacheKey = 'dashboard_stats_gym_' . ($user?->gym_id ?? 'super');

        $payload = Cache::remember($cacheKey, 30, function () {
        $now   = now();
        $month = $now->month;
        $year  = $now->year;

        $lastMonth     = $now->copy()->subMonth();
        $weekStart     = $now->copy()->startOfWeek();
        $startOfMonth  = $now->copy()->startOfMonth();

        // Shared date-range boundaries — computed once here and reused across
        // the consolidated queries below instead of every individual query
        // recomputing (and re-sending) its own whereMonth()/whereYear() pair.
        // Against a remote DB (Supabase) each extra query is a real network
        // round-trip (~300-500ms), so collapsing N single-purpose COUNT/SUM
        // queries into one SUM(CASE WHEN ...) query per table is the single
        // biggest lever on this endpoint's load time — this cuts it from
        // ~30 queries down to ~21 without changing any returned value.
        $monthStart     = $now->copy()->startOfMonth();
        $monthEnd       = $now->copy()->endOfMonth();
        $lastMonthStart = $lastMonth->copy()->startOfMonth();
        $lastMonthEnd   = $lastMonth->copy()->endOfMonth();
        $yearStart      = $now->copy()->startOfYear();
        $yearEnd        = $now->copy()->endOfYear();
        $todayStart     = $now->copy()->startOfDay();
        $todayEnd       = $now->copy()->endOfDay();

        // ── Members ──────────────────────────────────────────────
        // 5 separate COUNT queries collapsed into 1.
        $expiringUntil = $now->copy()->addDays(7);
        $memberCounts = Member::selectRaw(
            'COUNT(*) as total,
             SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as active,
             SUM(CASE WHEN created_at BETWEEN ? AND ? THEN 1 ELSE 0 END) as new_month,
             SUM(CASE WHEN created_at BETWEEN ? AND ? THEN 1 ELSE 0 END) as new_last,
             SUM(CASE WHEN status = ? AND membership_end BETWEEN ? AND ? THEN 1 ELSE 0 END) as expiring_soon',
            [
                'active',
                $monthStart, $monthEnd,
                $lastMonthStart, $lastMonthEnd,
                'active', $now->toDateString(), $expiringUntil->toDateString(),
            ]
        )->first();

        $activeMembers   = (int) $memberCounts->active;
        $totalMembers    = (int) $memberCounts->total;
        $newMembersMonth = (int) $memberCounts->new_month;
        $newMembersLast  = (int) $memberCounts->new_last;
        $expiringSoon    = (int) $memberCounts->expiring_soon;

        // Expiring members list (up to 8, ordered by soonest)
        $expiringMembers = Member::where('status', 'active')
            ->whereBetween('membership_end', [$now->toDateString(), $expiringUntil->toDateString()])
            ->orderBy('membership_end')
            ->limit(8)
            ->get(['id', 'first_name', 'last_name', 'membership_end', 'membership_type'])
            ->map(fn ($m) => [
                'id'             => $m->id,
                'name'           => "{$m->first_name} {$m->last_name}",
                'membership_end' => $m->membership_end,
                'membership_type'=> $m->membership_type,
            ]);

        // ── Visits ───────────────────────────────────────────────
        // 4 separate COUNT queries collapsed into 1.
        $visitCounts = Visit::selectRaw(
            'SUM(CASE WHEN visit_date BETWEEN ? AND ? THEN 1 ELSE 0 END) as today,
             SUM(CASE WHEN visit_date >= ? THEN 1 ELSE 0 END) as week,
             SUM(CASE WHEN visit_date BETWEEN ? AND ? THEN 1 ELSE 0 END) as month,
             SUM(CASE WHEN visit_date BETWEEN ? AND ? THEN 1 ELSE 0 END) as last_month',
            [$todayStart, $todayEnd, $weekStart, $monthStart, $monthEnd, $lastMonthStart, $lastMonthEnd]
        )->first();

        $todayVisits     = (int) $visitCounts->today;
        $weekVisits      = (int) $visitCounts->week;
        $monthVisits     = (int) $visitCounts->month;
        $lastMonthVisits = (int) $visitCounts->last_month;

        // Visit types breakdown, today + this month in one pass (today is
        // always inside "this month", so one WHERE scoped to the month plus
        // a conditional count covers both — was 2 separate grouped queries).
        $visitTypeRows = Visit::selectRaw(
                'visit_type,
                 SUM(CASE WHEN visit_date BETWEEN ? AND ? THEN 1 ELSE 0 END) as today_count,
                 COUNT(*) as month_count',
                [$todayStart, $todayEnd]
            )
            ->whereBetween('visit_date', [$monthStart, $monthEnd])
            ->groupBy('visit_type')
            ->get();

        $visitTypesToday = $visitTypeRows
            ->filter(fn ($v) => (int) $v->today_count > 0)
            ->map(fn ($v) => ['type' => $v->visit_type ?? 'other', 'count' => (int) $v->today_count])
            ->values();

        $visitTypesMonth = $visitTypeRows
            ->map(fn ($v) => ['type' => $v->visit_type ?? 'other', 'count' => (int) $v->month_count])
            ->values();

        // Top visitors this month (up to 5)
        $topVisitorRows = Visit::select('member_id', DB::raw('COUNT(*) as visits'))
            ->whereMonth('visit_date', $month)
            ->whereYear('visit_date', $year)
            ->whereNotNull('member_id')
            ->groupBy('member_id')
            ->orderByDesc('visits')
            ->limit(5)
            ->get();

        $memberIds = $topVisitorRows->pluck('member_id');
        $memberMap = Member::whereIn('id', $memberIds)
            ->get(['id', 'first_name', 'last_name', 'membership_type'])
            ->keyBy('id');

        $topVisitors = $topVisitorRows->map(fn ($v) => [
            'member'          => $memberMap[$v->member_id] ? "{$memberMap[$v->member_id]->first_name} {$memberMap[$v->member_id]->last_name}" : '—',
            'membership_type' => $memberMap[$v->member_id]?->membership_type,
            'visits'          => (int) $v->visits,
        ]);

        // Visits by day (last 30)
        $visitsByDay = Visit::select(
                DB::raw('DATE(visit_date) as date'),
                DB::raw('COUNT(*) as count')
            )
            ->where('visit_date', '>=', now()->subDays(30))
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        // Recent visits (last 15)
        $recentVisits = Visit::with('member:id,first_name,last_name')
            ->orderByDesc('visit_date')
            ->limit(15)
            ->get()
            ->map(fn ($v) => [
                'id'         => $v->id,
                'member'     => $v->member?->full_name,
                'visit_date' => $v->visit_date,
                'visit_type' => $v->visit_type,
                'price'      => $v->price ? (float) $v->price : null,
            ]);

        // ── Revenue ──────────────────────────────────────────────
        // month/last-month/week/year totals used to be 8 separate sum()
        // queries (4 on payments, 4 on visits) — one conditional-aggregate
        // query per table now covers all four periods at once.
        $payRevRow = Payment::where('status', 'completed')->selectRaw(
            'SUM(CASE WHEN payment_date BETWEEN ? AND ? THEN amount ELSE 0 END) as month_rev,
             SUM(CASE WHEN payment_date BETWEEN ? AND ? THEN amount ELSE 0 END) as last_month_rev,
             SUM(CASE WHEN payment_date >= ? THEN amount ELSE 0 END) as week_rev,
             SUM(CASE WHEN payment_date BETWEEN ? AND ? THEN amount ELSE 0 END) as year_rev',
            [
                $monthStart->toDateString(), $monthEnd->toDateString(),
                $lastMonthStart->toDateString(), $lastMonthEnd->toDateString(),
                $weekStart->toDateString(),
                $yearStart->toDateString(), $yearEnd->toDateString(),
            ]
        )->first();

        $payRev   = (float) ($payRevRow->month_rev ?? 0);
        $lmPayRev = (float) ($payRevRow->last_month_rev ?? 0);
        $wPayRev  = (float) ($payRevRow->week_rev ?? 0);
        $yPayRev  = (float) ($payRevRow->year_rev ?? 0);

        $visitRevRow = Visit::whereNotNull('price')->where('price', '>', 0)->selectRaw(
            'SUM(CASE WHEN visit_date BETWEEN ? AND ? THEN price ELSE 0 END) as month_rev,
             SUM(CASE WHEN visit_date BETWEEN ? AND ? THEN price ELSE 0 END) as last_month_rev,
             SUM(CASE WHEN visit_date >= ? THEN price ELSE 0 END) as week_rev,
             SUM(CASE WHEN visit_date BETWEEN ? AND ? THEN price ELSE 0 END) as year_rev',
            [$monthStart, $monthEnd, $lastMonthStart, $lastMonthEnd, $weekStart, $yearStart, $yearEnd]
        )->first();

        $visitRev   = (float) ($visitRevRow->month_rev ?? 0);
        $lmVisitRev = (float) ($visitRevRow->last_month_rev ?? 0);
        $wVisitRev  = (float) ($visitRevRow->week_rev ?? 0);
        $yVisitRev  = (float) ($visitRevRow->year_rev ?? 0);

        $monthRevenue     = $payRev + $visitRev;
        $lastMonthRevenue = $lmPayRev + $lmVisitRev;
        $weekRevenue      = $wPayRev + $wVisitRev;
        $yearRevenue      = $yPayRev + $yVisitRev;

        // Revenue by month (last 6)
        // YEAR()/MONTH() are MySQL-only — Postgres has no such functions
        // (throws "function year(date) does not exist"). SqlPortability picks
        // the right expression for whichever DB is actually connected.
        $payRevByMonth = Payment::select(
                DB::raw(SqlPortability::yearExpr('payment_date')),
                DB::raw(SqlPortability::monthExpr('payment_date')),
                DB::raw('SUM(amount) as total')
            )
            ->where('status', 'completed')
            ->where('payment_date', '>=', now()->subMonths(6))
            ->groupBy('year', 'month')
            ->get();

        $visitRevByMonth = Visit::select(
                DB::raw(SqlPortability::yearExpr('visit_date')),
                DB::raw(SqlPortability::monthExpr('visit_date')),
                DB::raw('SUM(price) as total')
            )
            ->whereNotNull('price')
            ->where('price', '>', 0)
            ->where('visit_date', '>=', now()->subMonths(6))
            ->groupBy('year', 'month')
            ->get();

        $revenueMap = [];
        foreach ($payRevByMonth as $row) {
            $key = "{$row->year}-{$row->month}";
            $revenueMap[$key] = ['year' => (int)$row->year, 'month' => (int)$row->month, 'total' => (float)$row->total];
        }
        foreach ($visitRevByMonth as $row) {
            $key = "{$row->year}-{$row->month}";
            if (isset($revenueMap[$key])) {
                $revenueMap[$key]['total'] += (float)$row->total;
            } else {
                $revenueMap[$key] = ['year' => (int)$row->year, 'month' => (int)$row->month, 'total' => (float)$row->total];
            }
        }
        $revenueByMonth = collect($revenueMap)->sortBy([['year', 'asc'], ['month', 'asc']])->values();

        // ── Memberships ──────────────────────────────────────────
        $activeMemberships = Membership::where('status', 'active')->count();
        $activeTrainers    = Trainer::active()->count();

        $membersByType = Member::select('membership_type', DB::raw('COUNT(*) as count'))
            ->groupBy('membership_type')
            ->get();

        $membershipsByStatus = Membership::select('status', DB::raw('COUNT(*) as count'))
            ->groupBy('status')
            ->get()
            ->map(fn ($m) => ['status' => $m->status, 'count' => (int) $m->count]);

        // ── Upcoming birthdays (next 30 days) ─────────────────────
        $today = $now->copy()->startOfDay();
        $upcomingBirthdays = Member::whereNotNull('birth_date')
            ->get(['id', 'first_name', 'last_name', 'birth_date'])
            ->map(function ($m) use ($today) {
                $next = $m->birth_date->copy()->year($today->year);
                if ($next->lt($today)) {
                    $next = $next->addYear();
                }
                return [
                    'id'            => $m->id,
                    'name'          => "{$m->first_name} {$m->last_name}",
                    'next_birthday' => $next->toDateString(),
                    'days_until'    => $today->diffInDays($next),
                    'turning'       => $next->year - $m->birth_date->year,
                ];
            })
            ->filter(fn ($m) => $m['days_until'] <= 30)
            ->sortBy('days_until')
            ->values()
            ->take(8);

        // ── Revenue by payment method (this month) ────────────────
        // Same dual sources as month_revenue above, so the breakdown always
        // adds up to the exact same total shown in the KPI card.
        $payByMethod = Payment::whereMonth('payment_date', $month)->whereYear('payment_date', $year)
            ->where('status', 'completed')
            ->select('payment_method', DB::raw('SUM(amount) as total'))
            ->groupBy('payment_method')
            ->pluck('total', 'payment_method');

        $visitByMethod = Visit::whereMonth('visit_date', $month)->whereYear('visit_date', $year)
            ->whereNotNull('price')->where('price', '>', 0)
            ->select('payment_method', DB::raw('SUM(price) as total'))
            ->groupBy('payment_method')
            ->pluck('total', 'payment_method');

        $revenueByMethod = collect(['cash', 'card', 'transfer'])
            ->map(fn ($method) => [
                'method' => $method,
                'total'  => (float) ($payByMethod[$method] ?? 0) + (float) ($visitByMethod[$method] ?? 0),
            ])
            ->filter(fn ($m) => $m['total'] > 0)
            ->values();

        // ── Members who haven't visited in 14+ days (or never) ────
        // A quick retention list — active members who might be drifting away.
        $riskCutoff = $now->copy()->subDays(14);

        $lastVisitMap = Visit::select('member_id', DB::raw('MAX(visit_date) as last_visit'))
            ->whereNotNull('member_id')
            ->groupBy('member_id')
            ->pluck('last_visit', 'member_id');

        // "Recent visitor" ids used to come from a second full-table DISTINCT
        // query — derived instead from lastVisitMap (already fetched above)
        // since a member is recent exactly when their last visit is within
        // the risk window.
        $recentVisitorIds = $lastVisitMap
            ->filter(fn ($lastVisit) => Carbon::parse($lastVisit)->gte($riskCutoff))
            ->keys();

        $atRiskMembers = Member::where('status', 'active')
            ->whereNotIn('id', $recentVisitorIds)
            ->get(['id', 'first_name', 'last_name', 'membership_type'])
            ->map(function ($m) use ($lastVisitMap, $now) {
                $last = $lastVisitMap[$m->id] ?? null;
                return [
                    'id'              => $m->id,
                    'name'            => "{$m->first_name} {$m->last_name}",
                    'membership_type' => $m->membership_type,
                    'last_visit'      => $last,
                    'days_since'      => $last ? (int) $now->diffInDays($last) : null,
                ];
            })
            ->sortByDesc(fn ($m) => $m['days_since'] ?? PHP_INT_MAX)
            ->take(8)
            ->values();

        return [
            'stats' => [
                'active_members'    => $activeMembers,
                'total_members'     => $totalMembers,
                'new_members_month' => $newMembersMonth,
                'new_members_last'  => $newMembersLast,
                'today_visits'      => $todayVisits,
                'week_visits'       => $weekVisits,
                'month_visits'      => $monthVisits,
                'last_month_visits' => $lastMonthVisits,
                'month_revenue'     => $monthRevenue,
                'last_month_revenue'=> $lastMonthRevenue,
                'week_revenue'      => $weekRevenue,
                'year_revenue'      => $yearRevenue,
                'active_trainers'   => $activeTrainers,
                'expiring_soon'     => $expiringSoon,
                'active_memberships'=> $activeMemberships,
            ],
            'recent_visits'        => $recentVisits,
            'visits_by_day'        => $visitsByDay,
            'members_by_type'      => $membersByType,
            'revenue_by_month'     => $revenueByMonth,
            'expiring_members'     => $expiringMembers,
            'top_visitors'         => $topVisitors,
            'visits_by_type_today' => $visitTypesToday,
            'visits_by_type_month' => $visitTypesMonth,
            'memberships_by_status'=> $membershipsByStatus,
            'upcoming_birthdays'   => $upcomingBirthdays,
            'revenue_by_method'    => $revenueByMethod,
            'at_risk_members'      => $atRiskMembers,
        ];
        });

        return response()->json($payload);
    }
}
