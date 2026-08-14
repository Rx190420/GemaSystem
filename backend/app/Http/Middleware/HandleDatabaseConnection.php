<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * Ensures the shared MySQL connection is alive at the start of every API
 * request, and reconnects if it has gone stale.
 *
 * Why this matters
 * ────────────────
 * We enable PDO::ATTR_PERSISTENT on the 'mysql' (shared) connection so that
 * each Apache worker process re-uses a single socket to MySQL rather than
 * opening a new TCP connection on every HTTP request (the closest equivalent
 * to a connection pool in PHP/Apache land).
 *
 * The risk of persistent connections is that MySQL can close the server-side
 * socket if the worker is idle longer than `wait_timeout` (set to 600 s in
 * my.ini). The next request arriving at that worker would get a dead socket
 * and a "MySQL server has gone away" error (SQLSTATE HY000 / error 2006).
 *
 * This middleware prevents that by running a zero-cost SELECT 1 before any
 * real query. If the ping fails, it calls DB::reconnect() to re-open the
 * socket transparently — the controller never sees the error.
 *
 * Placement: registered BEFORE SetTenantDatabase in the 'api' group so the
 * shared connection is healthy before tenant resolution begins.
 */
class HandleDatabaseConnection
{
    public function handle(Request $request, Closure $next)
    {
        $this->ensureAlive('mysql');

        return $next($request);
    }

    private function ensureAlive(string $connection): void
    {
        try {
            // getPdo() returns the underlying PDO handle without opening a
            // new connection if one already exists. query('SELECT 1') is the
            // standard "ping" — it costs a single round-trip to MySQL (~0.1ms
            // on localhost) and is far cheaper than a reconnect on every miss.
            DB::connection($connection)->getPdo()->query('SELECT 1');
        } catch (Throwable) {
            // The socket is stale (2006 "gone away") or never opened (first
            // request on this worker). Reconnect silently.
            try {
                DB::reconnect($connection);
            } catch (Throwable $e) {
                // If reconnect also fails, surface a clean 503 rather than
                // leaking a raw PDO stack trace.
                abort(503, 'Servicio de base de datos no disponible temporalmente.');
            }
        }
    }
}
