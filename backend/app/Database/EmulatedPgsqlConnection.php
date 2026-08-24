<?php

namespace App\Database;

use Illuminate\Database\PostgresConnection;

/**
 * The Supabase transaction pooler (port 6543) forces `PDO::ATTR_EMULATE_PREPARES
 * => true` on our persistent connections (see config/database.php) — real
 * server-side prepared statements can't survive a logical connection being
 * multiplexed across different backend Postgres connections mid-session,
 * which is exactly what transaction-mode pooling does.
 *
 * The tradeoff: Laravel's base Connection::prepareBindings() casts every PHP
 * boolean to (int) 0/1. That's completely safe under NATIVE prepared
 * statements — PDO/Postgres negotiate the target column's real type
 * server-side and coerce an int 0/1 into a boolean column automatically.
 * Under EMULATED prepares there's no such negotiation: PDO embeds the value
 * as a literal straight into the SQL text, Postgres parses `0`/`1` as type
 * `integer`, and integer→boolean has no implicit cast in Postgres — so
 * every insert/update touching a boolean column throws "column X is of
 * type boolean but expression is of type integer".
 *
 * Fix: bind real booleans as the strings 't'/'f' instead of (int) 0/1 —
 * those are Postgres's own literal boolean syntax, parsed as `unknown`/text
 * and implicitly cast to boolean wherever one's expected, so it round-trips
 * correctly under emulation too. Registered as the resolver for the 'pgsql'
 * driver in AppServiceProvider.
 */
class EmulatedPgsqlConnection extends PostgresConnection
{
    public function prepareBindings(array $bindings)
    {
        foreach ($bindings as $key => $value) {
            if (is_bool($value)) {
                $bindings[$key] = $value ? 't' : 'f';
            }
        }

        // Booleans are now strings, so the parent's own (int) cast for
        // is_bool() no longer touches them — its DateTimeInterface handling
        // still applies normally to everything else.
        return parent::prepareBindings($bindings);
    }
}
