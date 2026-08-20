<?php

namespace App\Http\Controllers;

use App\Models\Ingreso;
use App\Models\Visit;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class VisitController extends Controller
{
    public function summary()
    {
        $now = now();

        $total     = Visit::count();
        $thisMonth = Visit::whereMonth('visit_date', $now->month)->whereYear('visit_date', $now->year)->count();
        $today     = Visit::whereDate('visit_date', $now->toDateString())->count();
        $thisWeek  = Visit::whereBetween('visit_date', [
            $now->copy()->startOfWeek()->toDateString(),
            $now->copy()->endOfWeek()->toDateString(),
        ])->count();

        $byType = Visit::select('visit_type', DB::raw('COUNT(*) as count'))
            ->groupBy('visit_type')
            ->get()
            ->map(fn ($r) => ['type' => $r->visit_type ?? 'other', 'count' => (int) $r->count]);

        $startDate = $now->copy()->startOfMonth()->subMonths(11);
        $byMonth = Visit::where('visit_date', '>=', $startDate)
            ->select(
                DB::raw('YEAR(visit_date) as year'),
                DB::raw('MONTH(visit_date) as month'),
                DB::raw('COUNT(*) as count')
            )
            ->groupBy('year', 'month')
            ->orderBy('year')->orderBy('month')
            ->get()
            ->map(fn ($r) => ['year' => (int) $r->year, 'month' => (int) $r->month, 'count' => (int) $r->count]);

        return response()->json([
            'summary'  => compact('total', 'thisMonth', 'today', 'thisWeek'),
            'by_type'  => $byType,
            'by_month' => $byMonth,
        ]);
    }

    // Gym-wide daily visit counts for the GitHub-style activity heatmap on
    // the Dashboard — same shape as MemberController::activity() but across
    // every member, not just one.
    public function activity(Request $request)
    {
        if ($request->filled('from') && $request->filled('to')) {
            $from = \Carbon\Carbon::parse($request->get('from'))->startOfDay();
            $to   = \Carbon\Carbon::parse($request->get('to'))->endOfDay();
        } else {
            $from = now()->subDays(364)->startOfDay();
            $to   = now()->endOfDay();
        }

        $counts = Visit::whereBetween('visit_date', [$from->toDateString(), $to->toDateString()])
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

    public function index(Request $request)
    {
        $gymId = auth()->user()->gym_id;

        $query = Visit::with([
            'member:id,first_name,last_name,membership_start,membership_end,status',
            'gymClass:id,name',
            'trainer:id,first_name,last_name',
        ]);

        if ($memberId = $request->get('member_id')) {
            $query->where('member_id', $memberId);
        }

        if ($classId = $request->get('class_id')) {
            $query->where('class_id', $classId);
        }

        if ($search = $request->get('search')) {
            $query->whereHas('member', function ($q) use ($search) {
                $q->where('first_name',  'like', "%{$search}%")
                  ->orWhere('last_name',  'like', "%{$search}%")
                  ->orWhere('member_code','like', "%{$search}%");
            });
        }

        if ($date = $request->get('date')) {
            $query->whereDate('visit_date', $date);
        }

        if ($from = $request->get('from')) {
            $query->where('visit_date', '>=', $from);
        }

        if ($to = $request->get('to')) {
            $query->where('visit_date', '<=', $to);
        }

        $this->applySort($query, $request, ['visit_date', 'visit_type', 'price'], 'visit_date', 'desc');
        $visits = $query->paginate($request->get('per_page', 12));

        $today     = now()->toDateString();
        $memberIds = $visits->getCollection()->pluck('member_id')->unique()->filter()->values();

        // Use the correct DB connection: tenant for paid gyms, shared for free
        $dbConn = (app()->bound('gym.plan') && app('gym.plan') === 'paid')
            ? DB::connection('tenant')
            : DB::connection();

        $memQuery = $dbConn->table('memberships')
            ->whereIn('member_id', $memberIds)
            ->where('status', 'active')
            ->where('end_date', '>=', $today);

        if (app('gym.plan') !== 'paid') {
            $memQuery->where('gym_id', $gymId);
        }

        $activeInTable = $memQuery->pluck('member_id')->flip();

        $visits->getCollection()->transform(function ($visit) use ($today, $activeInTable) {
            $m = $visit->member;
            if ($m) {
                $byTable = isset($activeInTable[$visit->member_id]);
                $byField = $m->membership_end
                    && $m->membership_end->toDateString() >= $today
                    && $m->status === 'active'
                    && (!$m->membership_start || $m->membership_start->toDateString() <= $today);
                $visit->has_active_membership = $byTable || $byField;
            } else {
                $visit->has_active_membership = false;
            }
            return $visit;
        });

        return response()->json($visits);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'member_id'      => ['required', $this->existsInGym('members')],
            'visit_date'     => 'nullable|date',
            'visit_type'     => 'nullable|in:training,class,consultation,other',
            'class_id'       => ['nullable', $this->existsInGym('classes')],
            'trainer_id'     => ['nullable', $this->existsInGym('trainers')],
            'notes'          => 'nullable|string',
            'price'          => 'nullable|numeric|min:0',
            'payment_method' => 'nullable|in:cash,card,transfer',
            'amount_paid'    => 'nullable|numeric|min:0',
        ]);

        // Only inject gym_id on the shared DB; tenant DB has no gym_id column
        if (app('gym.plan') !== 'paid') {
            $data['gym_id'] = auth()->user()->gym_id;
        }
        $data['visit_date'] = $data['visit_date'] ?? now();
        $data['visit_type'] = $data['visit_type'] ?? 'training';

        $visit = Visit::create($data);
        $visit->load('member:id,first_name,last_name');

        $gymId = auth()->user()->gym_id;
        if ($gymId && $visit->member) {
            try {
                $totalVisits = Visit::where('member_id', $data['member_id'])->count();
                if (in_array($totalVisits, [10, 25, 50, 100, 200, 500])) {
                    NotificationService::visitMilestone($visit->member, $gymId, $totalVisits);
                }
            } catch (\Throwable $e) {
                \Log::warning("Visit milestone notification failed: " . $e->getMessage());
            }
        }

        if (!empty($data['price']) && (float)$data['price'] > 0) {
            $visitTypeLabels = [
                'training'     => 'Entrenamiento',
                'class'        => 'Clase',
                'consultation' => 'Consulta',
                'other'        => 'Otro',
            ];
            try {
                Ingreso::create([
                    'member_id'      => $data['member_id'],
                    'concept'        => 'Visita · ' . ($visitTypeLabels[$data['visit_type'] ?? 'training'] ?? 'Visita'),
                    'amount'         => $data['price'],
                    'payment_method' => $data['payment_method'] ?? 'cash',
                    'origin'         => 'visit',
                    'reference_id'   => $visit->id,
                    'reference_type' => 'visit',
                    'date'           => date('Y-m-d', strtotime($data['visit_date'] ?? now())),
                ]);
            } catch (\Throwable $e) {
                \Log::warning("Ingreso auto-insert failed (visit {$visit->id}): " . $e->getMessage());
            }
        }

        return response()->json($visit, 201);
    }

    public function update(Request $request, Visit $visit)
    {
        $data = $request->validate([
            'price'          => 'nullable|numeric|min:0',
            'payment_method' => 'nullable|in:cash,card,transfer',
        ]);

        $visit->update($data);
        return response()->json($visit->load('member:id,first_name,last_name', 'trainer:id,first_name,last_name'));
    }

    public function destroy(Visit $visit)
    {
        $visit->delete();
        return response()->json(['message' => 'Visita eliminada.']);
    }
}
