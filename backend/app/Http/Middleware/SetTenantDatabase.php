<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

/**
 * Detects the authenticated gym's plan and wires the correct database
 * connection before any controller or model runs.
 *
 *  free  → uses the default 'mysql' connection (gemasystem) with GymScope filtering
 *  paid  → dynamically creates a 'tenant' connection to gemasystem_gym_{id}
 */
class SetTenantDatabase
{
    public function handle(Request $request, Closure $next)
    {
        $user = Auth::guard('sanctum')->user();

        if (!$user) {
            app()->instance('gym.plan', 'free');
            return $next($request);
        }

        $gym = $user->gym;

        if ($gym && $gym->plan_type === 'paid' && $gym->db_name) {
            // ── Paid: point the 'tenant' connection to the gym's own database ──
            config(['database.connections.tenant' => array_merge(
                config('database.connections.mysql'),
                ['database' => $gym->db_name]
            )]);

            // Purge any cached connection so the new config takes effect
            DB::purge('tenant');

            app()->instance('gym.plan', 'paid');
            app()->instance('gym.db',   $gym->db_name);
        } else {
            // ── Free / trial: shared database, GymScope handles isolation ──
            app()->instance('gym.plan', 'free');
        }

        return $next($request);
    }
}
