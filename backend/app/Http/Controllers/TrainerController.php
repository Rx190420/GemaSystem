<?php

namespace App\Http\Controllers;

use App\Models\Trainer;
use App\Support\SqlPortability;
use Illuminate\Http\Request;

class TrainerController extends Controller
{
    public function index(Request $request)
    {
        $query = Trainer::query();

        if ($request->get('active_only')) {
            $query->active();
        }

        if ($search = $request->get('search')) {
            $like = SqlPortability::likeOperator();
            $query->where(function ($q) use ($search, $like) {
                $q->where('first_name', $like, "%{$search}%")
                  ->orWhere('last_name', $like, "%{$search}%")
                  ->orWhere('specialty', $like, "%{$search}%");
            });
        }

        $trainers = $query->orderBy('first_name')->get();

        return response()->json($trainers->map(fn($t) => array_merge(
            $t->toArray(),
            ['full_name' => $t->full_name]
        )));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'first_name'       => 'required|string|max:100',
            'last_name'        => 'required|string|max:100',
            'email'            => 'nullable|email',
            'phone'            => 'nullable|string|max:20',
            'specialty'        => 'nullable|string|max:150',
            'certifications'   => 'nullable|string|max:255',
            'bio'              => 'nullable|string',
            'hire_date'        => 'nullable|date',
            'status'           => 'sometimes|in:active,inactive',
        ]);

        $trainer = Trainer::create($data);

        return response()->json($trainer, 201);
    }

    public function show(Trainer $trainer)
    {
        $trainer->load('classes.schedules');
        return response()->json($trainer);
    }

    public function update(Request $request, Trainer $trainer)
    {
        $data = $request->validate([
            'first_name'     => 'sometimes|string|max:100',
            'last_name'      => 'sometimes|string|max:100',
            'email'          => 'sometimes|nullable|email',
            'phone'          => 'sometimes|nullable|string|max:20',
            'specialty'      => 'sometimes|nullable|string|max:150',
            'certifications' => 'sometimes|nullable|string|max:255',
            'bio'            => 'sometimes|nullable|string',
            'hire_date'      => 'sometimes|nullable|date',
            'status'         => 'sometimes|in:active,inactive',
        ]);

        $trainer->update($data);
        return response()->json($trainer);
    }

    public function destroy(Trainer $trainer)
    {
        $trainer->delete();
        return response()->json(['message' => 'Entrenador eliminado correctamente.']);
    }
}
