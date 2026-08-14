<?php

namespace App\Http\Controllers;

use App\Models\Member;
use App\Models\Membership;
use App\Models\Payment;
use App\Models\Trainer;
use App\Models\Visit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function stats()
    {
        $now   = now();
        $month = $now->month;
        $year  = $now->year;

        $lastMonth     = $now->copy()->subMonth();
        $weekStart     = $now->copy()->startOfWeek();
        $startOfMonth  = $now->copy()->startOfMonth();

        // ── Members ──────────────────────────────────────────────
        $activeMembers    = Member::active()->count();
        $totalMembers     = Member::count();
        $newMembersMonth  = Member::whereMonth('created_at', $month)->whereYear('created_at', $year)->count();
        $newMembersLast   = Member::whereMonth('created_at', $lastMonth->month)->whereYear('created_at', $lastMonth->year)->count();

        $expiringSoon = Member::where('status', 'active')
            ->whereBetween('membership_end', [$now->toDateString(), $now->copy()->addDays(7)->toDateString()])
            ->count();

        // Expiring members list (up to 8, ordered by soonest)
        $expiringMembers = Member::where('status', 'active')
            ->whereBetween('membership_end', [$now->toDateString(), $now->copy()->addDays(7)->toDateString()])
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
        $todayVisits = Visit::whereDate('visit_date', today())->count();
        $weekVisits  = Visit::where('visit_date', '>=', $weekStart)->count();
        $monthVisits = Visit::whereMonth('visit_date', $month)->whereYear('visit_date', $year)->count();
        $lastMonthVisits = Visit::whereMonth('visit_date', $lastMonth->month)
            ->whereYear('visit_date', $lastMonth->year)->count();

        // Visit types breakdown today
        $visitTypesToday = Visit::select('visit_type', DB::raw('COUNT(*) as count'))
            ->whereDate('visit_date', today())
            ->groupBy('visit_type')
            ->get()
            ->map(fn ($v) => ['type' => $v->visit_type ?? 'other', 'count' => (int) $v->count]);

        // Visit types breakdown this month
        $visitTypesMonth = Visit::select('visit_type', DB::raw('COUNT(*) as count'))
            ->whereMonth('visit_date', $month)
            ->whereYear('visit_date', $year)
            ->groupBy('visit_type')
            ->get()
            ->map(fn ($v) => ['type' => $v->visit_type ?? 'other', 'count' => (int) $v->count]);

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
        // This month
        $payRev  = (float) Payment::whereMonth('payment_date', $month)->whereYear('payment_date', $year)->where('status', 'completed')->sum('amount');
        $visitRev = (float) Visit::whereMonth('visit_date', $month)->whereYear('visit_date', $year)->whereNotNull('price')->where('price', '>', 0)->sum('price');
        $monthRevenue = $payRev + $visitRev;

        // Last month
        $lmPayRev  = (float) Payment::whereMonth('payment_date', $lastMonth->month)->whereYear('payment_date', $lastMonth->year)->where('status', 'completed')->sum('amount');
        $lmVisitRev = (float) Visit::whereMonth('visit_date', $lastMonth->month)->whereYear('visit_date', $lastMonth->year)->whereNotNull('price')->where('price', '>', 0)->sum('price');
        $lastMonthRevenue = $lmPayRev + $lmVisitRev;

        // This week
        $wPayRev   = (float) Payment::where('payment_date', '>=', $weekStart)->where('status', 'completed')->sum('amount');
        $wVisitRev = (float) Visit::where('visit_date', '>=', $weekStart)->whereNotNull('price')->where('price', '>', 0)->sum('price');
        $weekRevenue = $wPayRev + $wVisitRev;

        // This year
        $yPayRev   = (float) Payment::whereYear('payment_date', $year)->where('status', 'completed')->sum('amount');
        $yVisitRev = (float) Visit::whereYear('visit_date', $year)->whereNotNull('price')->where('price', '>', 0)->sum('price');
        $yearRevenue = $yPayRev + $yVisitRev;

        // Revenue by month (last 6)
        $payRevByMonth = Payment::select(
                DB::raw('YEAR(payment_date) as year'),
                DB::raw('MONTH(payment_date) as month'),
                DB::raw('SUM(amount) as total')
            )
            ->where('status', 'completed')
            ->where('payment_date', '>=', now()->subMonths(6))
            ->groupBy('year', 'month')
            ->get();

        $visitRevByMonth = Visit::select(
                DB::raw('YEAR(visit_date) as year'),
                DB::raw('MONTH(visit_date) as month'),
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
        $recentVisitorIds = Visit::where('visit_date', '>=', $riskCutoff)
            ->whereNotNull('member_id')
            ->distinct()
            ->pluck('member_id');

        $lastVisitMap = Visit::select('member_id', DB::raw('MAX(visit_date) as last_visit'))
            ->whereNotNull('member_id')
            ->groupBy('member_id')
            ->pluck('last_visit', 'member_id');

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

        return response()->json([
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
        ]);
    }
}
