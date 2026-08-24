<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

/**
 * Route-group gate for the plan/feature system (Gym::hasFeature()) — usage:
 * Route::middleware('feature:whatsapp')->group(...). Mirrors EnsureOperator's
 * pattern: same file shape, same "check + 403 with a message" style.
 */
class EnsureGymFeature
{
    public function handle(Request $request, Closure $next, string $feature)
    {
        $gym = $request->user()?->gym;

        if (!$gym || !$gym->hasFeature($feature)) {
            return response()->json([
                'message' => 'Tu plan no incluye esta función. Actualiza tu plan para acceder.',
            ], 403);
        }

        return $next($request);
    }
}
