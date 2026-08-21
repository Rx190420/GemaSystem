<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use PDO;

/**
 * Detects the authenticated gym's plan and wires the correct database
 * connection before any controller or model runs.
 *
 *  free  → shared database/schema, GymScope filters every query by gym_id
 *  paid  → dynamically points the 'tenant' connection at the gym's own
 *          isolated storage — a separate MySQL database (gemasystem_gym_{id})
 *          or, on Postgres/Supabase, a separate schema (gym_{id}) in the
 *          same project. Either way GymScope is skipped entirely for paid
 *          gyms — the storage itself is the isolation boundary, not a column.
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

        if (!$gym || $gym->plan_type !== 'paid' || !$gym->db_name) {
            // ── Free / trial: shared database, GymScope handles isolation ──
            app()->instance('gym.plan', 'free');
            return $next($request);
        }

        if (config('database.default') === 'mysql') {
            // ── Paid on MySQL: point 'tenant' at the gym's own database ──
            config(['database.connections.tenant' => array_merge(
                config('database.connections.mysql'),
                ['database' => $gym->db_name]
            )]);
        } else {
            // ── Paid on Postgres/Supabase: point 'tenant' at the gym's own
            // schema within the same database. `db_name` holds the schema
            // name (e.g. "gym_17") — same column, repurposed, so Gym/the
            // rest of the app don't need to know which driver is active.
            // search_path lists the tenant schema first, "public" as
            // fallback — the tenant tables' FKs to public.users(id) resolve
            // regardless of search_path (Postgres stores the qualified
            // reference at constraint-creation time), and any relationship
            // that legitimately queries a shared table (e.g. User's own
            // connection) uses its own connection anyway, not this one.
            //
            // No PDO::ATTR_PERSISTENT here — same reasoning as the MySQL
            // tenant connection: this config is repointed per-request, and a
            // persistent socket would survive DB::purge() and could keep
            // serving a previous gym's schema.
            config(['database.connections.tenant' => array_merge(
                config('database.connections.pgsql'),
                [
                    'schema'  => [$gym->db_name, 'public'],
                    'options' => extension_loaded('pdo_pgsql') ? [PDO::ATTR_TIMEOUT => 8] : [],
                ]
            )]);
        }

        // Purge any cached connection so the new config takes effect
        DB::purge('tenant');

        app()->instance('gym.plan', 'paid');
        app()->instance('gym.db',   $gym->db_name);

        return $next($request);
    }
}
