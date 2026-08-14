<?php

namespace App\Http\Controllers;

use App\Models\GymNotification;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index()
    {
        $gymId = auth()->user()->gym_id;

        if (!$gymId) {
            return response()->json(['notifications' => [], 'unread_count' => 0]);
        }

        $notifications = GymNotification::where('gym_id', $gymId)
            ->orderByDesc('created_at')
            ->limit(60)
            ->get();

        return response()->json([
            'notifications' => $notifications,
            'unread_count'  => $notifications->whereNull('read_at')->count(),
        ]);
    }

    public function markRead(GymNotification $gymNotification)
    {
        abort_if($gymNotification->gym_id !== auth()->user()->gym_id, 403);
        $gymNotification->update(['read_at' => now()]);
        return response()->json(['ok' => true]);
    }

    public function markAllRead()
    {
        $gymId = auth()->user()->gym_id;
        GymNotification::where('gym_id', $gymId)->whereNull('read_at')->update(['read_at' => now()]);
        return response()->json(['ok' => true]);
    }

    public function destroy(GymNotification $gymNotification)
    {
        abort_if($gymNotification->gym_id !== auth()->user()->gym_id, 403);
        $gymNotification->delete();
        return response()->json(['ok' => true]);
    }

    public function destroyRead()
    {
        $gymId = auth()->user()->gym_id;
        GymNotification::where('gym_id', $gymId)->whereNotNull('read_at')->delete();
        return response()->json(['ok' => true]);
    }
}
