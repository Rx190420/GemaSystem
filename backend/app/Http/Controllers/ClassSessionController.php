<?php

namespace App\Http\Controllers;

use App\Models\GymClass;
use Illuminate\Http\Request;

class ClassSessionController extends Controller
{
    public function update(Request $request, GymClass $class, int $session)
    {
        $classSession = $class->sessions()->findOrFail($session);

        $data = $request->validate([
            'status'         => 'sometimes|in:pending,completed,missed',
            'scheduled_date' => 'sometimes|nullable|date',
            'notes'          => 'sometimes|nullable|string',
        ]);

        if (array_key_exists('status', $data)) {
            $data['completed_at'] = $data['status'] === 'completed' ? now() : null;
        }

        $classSession->update($data);

        return response()->json($classSession);
    }
}
