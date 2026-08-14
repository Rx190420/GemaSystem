<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class EnsureOperator
{
    public function handle(Request $request, Closure $next)
    {
        $user      = $request->user();
        $abilities = $user?->currentAccessToken()?->abilities ?? [];

        // Do NOT use ->can('operator'): Sanctum's can() returns true for '*' wildcard,
        // which would let any authenticated user bypass this check.
        if (!$user || !in_array('operator', $abilities)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        return $next($request);
    }
}
