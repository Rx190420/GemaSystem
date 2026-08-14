<?php

namespace App\Http\Controllers;

use App\Models\ClassSchedule;
use App\Models\GymClass;
use Illuminate\Http\Request;

class ClassController extends Controller
{
    public function index()
    {
        $classes = GymClass::with('trainer:id,first_name,last_name', 'member:id,first_name,last_name', 'schedules', 'sessions')
            ->orderBy('name')
            ->get();

        return response()->json($classes);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name'        => 'required|string|max:150',
            'description' => 'nullable|string',
            'trainer_id'  => ['required', $this->existsInGym('trainers')],
            'capacity'    => 'integer|min:1|max:500',
            'duration'    => 'integer|min:15|max:480',
            'start_date'  => 'nullable|date',
            'difficulty'  => 'in:beginner,intermediate,advanced',
            'type'            => 'sometimes|in:group,private',
            'member_id'       => ['nullable', 'required_if:type,private', $this->existsInGym('members')],
            'total_sessions'  => 'nullable|required_if:type,private|integer|min:1|max:200',
            'schedules'   => 'nullable|array',
            'schedules.*.day_of_week' => 'required|in:Monday,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday',
            'schedules.*.start_time'  => 'required|date_format:H:i',
            'schedules.*.end_time'    => 'required|date_format:H:i',
            'schedules.*.room'        => 'nullable|string|max:50',
        ]);

        $data['type'] = $data['type'] ?? 'group';

        if ($data['type'] === 'private') {
            $data['capacity'] = 1;
        } else {
            unset($data['member_id'], $data['total_sessions']);
        }

        $gymClass = GymClass::create($data);

        if (!empty($data['schedules'])) {
            foreach ($data['schedules'] as $schedule) {
                $gymClass->schedules()->create($schedule);
            }
        }

        if ($gymClass->type === 'private' && $gymClass->total_sessions) {
            for ($n = 1; $n <= $gymClass->total_sessions; $n++) {
                $gymClass->sessions()->create(['session_number' => $n, 'status' => 'pending']);
            }
        }

        $gymClass->load('trainer:id,first_name,last_name', 'member:id,first_name,last_name', 'schedules', 'sessions');

        return response()->json($gymClass, 201);
    }

    public function show(GymClass $class)
    {
        $class->load('trainer', 'member', 'schedules', 'sessions');
        return response()->json($class);
    }

    public function update(Request $request, GymClass $class)
    {
        $data = $request->validate([
            'name'        => 'sometimes|string|max:150',
            'description' => 'sometimes|nullable|string',
            'trainer_id'  => ['sometimes', 'required', $this->existsInGym('trainers')],
            'capacity'    => 'sometimes|integer|min:1',
            'duration'    => 'sometimes|integer|min:15',
            'start_date'  => 'sometimes|nullable|date',
            'difficulty'  => 'sometimes|in:beginner,intermediate,advanced',
            'member_id'       => ['sometimes', 'nullable', $this->existsInGym('members')],
            'total_sessions'  => 'sometimes|nullable|integer|min:1|max:200',
            'schedules'                   => 'sometimes|nullable|array',
            'schedules.*.day_of_week'     => 'required|in:Monday,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday',
            'schedules.*.start_time'      => 'required|date_format:H:i',
            'schedules.*.end_time'        => 'required|date_format:H:i',
            'schedules.*.room'            => 'nullable|string|max:50',
        ]);

        // `type` is intentionally not a validated field — it's immutable after creation,
        // so any incoming value is silently dropped by validate() rather than applied.

        if ($class->type !== 'private') {
            unset($data['member_id'], $data['total_sessions']);
        } else {
            $data['capacity'] = 1;

            if (array_key_exists('total_sessions', $data) && $data['total_sessions'] !== null) {
                $newTotal       = (int) $data['total_sessions'];
                $completedCount = $class->sessions()->where('status', 'completed')->count();

                if ($newTotal < $completedCount) {
                    return response()->json([
                        'message' => 'No puedes reducir el total de sesiones por debajo de las ya completadas.',
                        'errors'  => ['total_sessions' => ["Ya hay {$completedCount} sesiones completadas."]],
                    ], 422);
                }
            }
        }

        $class->update($data);

        if (array_key_exists('schedules', $data)) {
            $class->schedules()->delete();
            foreach ($data['schedules'] ?? [] as $schedule) {
                $class->schedules()->create($schedule);
            }
        }

        if ($class->type === 'private' && array_key_exists('total_sessions', $data) && $data['total_sessions'] !== null) {
            $newTotal   = (int) $data['total_sessions'];
            $currentMax = (int) $class->sessions()->max('session_number');

            if ($newTotal > $currentMax) {
                for ($n = $currentMax + 1; $n <= $newTotal; $n++) {
                    $class->sessions()->create(['session_number' => $n, 'status' => 'pending']);
                }
            } elseif ($newTotal < $currentMax) {
                $class->sessions()->where('session_number', '>', $newTotal)->where('status', '!=', 'completed')->delete();
            }
        }

        return response()->json($class->load('trainer:id,first_name,last_name', 'member:id,first_name,last_name', 'schedules', 'sessions'));
    }

    public function destroy(GymClass $class)
    {
        $class->delete();
        return response()->json(['message' => 'Clase eliminada correctamente.']);
    }
}
