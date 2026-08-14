<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

/**
 * Lee el token de la cookie HttpOnly `gemasystem_token` e inyecta el
 * header Authorization: Bearer para que auth:sanctum lo procese.
 */
class TokenFromCookie
{
    public function handle(Request $request, Closure $next)
    {
        $token = $request->cookie('gemasystem_token');

        if ($token && !$request->bearerToken()) {
            $request->headers->set('Authorization', 'Bearer ' . $token);
        }

        return $next($request);
    }
}
