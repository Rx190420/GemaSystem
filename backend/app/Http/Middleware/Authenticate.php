<?php

namespace App\Http\Middleware;

use Illuminate\Auth\Middleware\Authenticate as Middleware;

class Authenticate extends Middleware
{
    /**
     * Get the path the user should be redirected to when they are not authenticated.
     *
     * This backend is a pure JSON API for a separate SPA frontend — there is
     * no Blade-based 'login' route to redirect to. The original expectsJson()
     * check meant any unauthenticated request that *didn't* look like an XHR
     * (missing/odd Accept header, a direct browser navigation, a stale
     * session hitting an endpoint in a way axios wouldn't) crashed with
     * "Route [login] not defined" — a 500 instead of a clean 401 — which is
     * exactly what blocked access to the operator console. Always returning
     * null here means Laravel's default unauthenticated() 401-JSON path
     * runs unconditionally instead.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return string|null
     */
    protected function redirectTo($request)
    {
        return null;
    }
}
