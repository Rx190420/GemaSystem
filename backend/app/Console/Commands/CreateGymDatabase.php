<?php

namespace App\Console\Commands;

use App\Models\Gym;
use App\Models\Setting;
use App\Scopes\GymScope;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use PDO;

class CreateGymDatabase extends Command
{
    protected $signature = 'gym:create-database
                            {gym_id : ID del gym a convertir a cuenta de pago}
                            {--force : Omitir confirmación}
                            {--recreate : Eliminar y recrear la DB/schema (BORRA todos los datos)}';

    protected $description = 'Crea almacenamiento dedicado (base de datos en MySQL, schema en Postgres) para un gym de pago (plan_type = paid)';

    public function handle(): int
    {
        $gym = Gym::find($this->argument('gym_id'));

        if (!$gym) {
            $this->error("Gym ID {$this->argument('gym_id')} no encontrado.");
            return 1;
        }

        $isPgsql = config('database.default') !== 'mysql';
        $label   = $isPgsql ? 'schema' : 'base de datos';

        if ($gym->plan_type === 'paid' && $gym->db_name && !$this->option('recreate')) {
            $this->warn("Este gym ya tiene {$label} dedicado: {$gym->db_name}");
            $this->warn("Usa --recreate para eliminarlo y recrearlo (BORRA todos los datos).");
            return 0;
        }

        if ($this->option('recreate') && $gym->db_name) {
            $this->warn("ADVERTENCIA: Se eliminará el {$label} '{$gym->db_name}' y todos sus datos.");
        }

        $target = $isPgsql ? ('gym_' . $gym->id) : ('gemasystem_gym_' . $gym->id);

        $this->info("Gym:      {$gym->name}");
        $this->info(($isPgsql ? 'Schema:   ' : 'Base:     ') . $target);
        $this->newLine();

        if (!$this->option('force') && !$this->confirm('¿Continuar?', true)) {
            $this->line('Cancelado.');
            return 0;
        }

        self::provision($gym, $this, (bool) $this->option('recreate'));

        $this->newLine();
        $this->info("✓ {$label} '{$target}' listo para {$gym->name}.");
        $this->info('  El gym usará este almacenamiento automáticamente al hacer login.');

        return 0;
    }

    /**
     * Provision the dedicated storage for a paid gym.
     * Called from both the Artisan command and StripeController::fulfill().
     */
    public static function provision(Gym $gym, ?Command $console = null, bool $recreate = false): void
    {
        if (config('database.default') === 'mysql') {
            self::provisionMysqlDatabase($gym, $console, $recreate);
        } else {
            self::provisionPgsqlSchema($gym, $console, $recreate);
        }
    }

    private static function provisionMysqlDatabase(Gym $gym, ?Command $console, bool $recreate): void
    {
        $dbName = 'gemasystem_gym_' . $gym->id;
        $log = fn(string $msg) => $console ? $console->line($msg) : \Log::info("[GymDB] $msg");

        // 1. Optionally drop existing database
        if ($recreate) {
            $log("→ Eliminando base de datos existente {$dbName}...");
            DB::statement("DROP DATABASE IF EXISTS `{$dbName}`");
        }

        // 2. Create the database
        $log("→ Creando base de datos {$dbName}...");
        DB::statement("CREATE DATABASE IF NOT EXISTS `{$dbName}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");

        // 3. Point 'tenant' connection to the new DB
        config(['database.connections.tenant' => array_merge(
            config('database.connections.mysql'),
            ['database' => $dbName]
        )]);
        DB::purge('tenant');

        // 4. Run tenant schema migrations
        $log("→ Creando tablas en {$dbName}...");
        \Artisan::call('migrate', [
            '--database' => 'tenant',
            '--path'     => 'database/migrations/tenant',
            '--force'    => true,
        ]);

        // 5. Seed default settings into the tenant DB (no gym_id column in tenant)
        $log("→ Sembrando configuración inicial...");
        self::seedTenantSettings($gym);

        // 6. Update the gym record with db_name
        $gym->update([
            'db_name'   => $dbName,
            'plan_type' => 'paid',
        ]);

        $log("→ Registro actualizado: gym.db_name = {$dbName}");
    }

    /**
     * Postgres/Supabase equivalent: instead of a separate database (which
     * MySQL forces one into — no cross-database FKs, no shared connection
     * pool), give the gym its own SCHEMA inside the same Supabase project.
     * Real isolation (physically separate tables, droppable/backupable on
     * their own) without the cost or ops overhead of a project per gym.
     */
    private static function provisionPgsqlSchema(Gym $gym, ?Command $console, bool $recreate): void
    {
        $schema = 'gym_' . $gym->id;
        $log = fn(string $msg) => $console ? $console->line($msg) : \Log::info("[GymSchema] $msg");

        $shared = DB::connection('pgsql');

        // 1. Optionally drop the existing schema (CASCADE — takes every table
        // in it with it, same "BORRA todos los datos" semantics as --recreate
        // on MySQL's DROP DATABASE).
        if ($recreate) {
            $log("→ Eliminando schema existente \"{$schema}\"...");
            $shared->statement("DROP SCHEMA IF EXISTS \"{$schema}\" CASCADE");
        }

        // 2. Create the schema
        $log("→ Creando schema \"{$schema}\"...");
        $shared->statement("CREATE SCHEMA IF NOT EXISTS \"{$schema}\"");

        // 3. Point 'tenant' connection at the new schema (public as fallback
        // in search_path — see SetTenantDatabase for why that's safe). No
        // PDO::ATTR_PERSISTENT: this gets purged and re-pointed per request.
        config(['database.connections.tenant' => array_merge(
            config('database.connections.pgsql'),
            [
                'schema'  => [$schema, 'public'],
                'options' => extension_loaded('pdo_pgsql') ? [PDO::ATTR_TIMEOUT => 8] : [],
            ]
        )]);
        DB::purge('tenant');

        // 4. Create the tenant tables inside the new schema
        $log("→ Creando tablas en \"{$schema}\"...");
        $sql = file_get_contents(database_path('gemasystem_tenant_pgsql.sql'));
        DB::connection('tenant')->unprepared($sql);

        // 5. Seed default settings (no gym_id column in the tenant schema)
        $log("→ Sembrando configuración inicial...");
        self::seedTenantSettings($gym);

        // 6. Update the gym record — db_name repurposed to hold the schema
        // name on Postgres (SetTenantDatabase reads it the same way either
        // driver; the column doesn't need to know which one is active).
        $gym->update([
            'db_name'   => $schema,
            'plan_type' => 'paid',
        ]);

        $log("→ Registro actualizado: gym.db_name = {$schema}");
    }

    /**
     * Same as provision(), but for a gym that already has real data sitting
     * in the shared 'public' schema (a free-trial gym being converted to
     * paid mid-life) instead of nothing (a brand-new paid signup, the only
     * case provision() originally had to handle). Creates the schema exactly
     * like provision() does, then copies every row that belongs to this gym
     * out of 'public' and into the new schema, and finally removes those
     * rows from 'public' via the same wipeSharedGymData() a permanent
     * delete already uses — so nothing is left duplicated in both places.
     *
     * Postgres-only. A gym on MySQL never lived in a shared database to
     * begin with (see class doc comment) — provisionMysqlDatabase() already
     * handles "first dedicated database" as its only case, correctly.
     */
    public static function migrateAndProvision(Gym $gym, ?Command $console = null): void
    {
        $log = fn(string $msg) => $console ? $console->line($msg) : \Log::info("[GymMigrate] $msg");

        if (config('database.default') === 'mysql') {
            $log('→ MySQL: sin schema compartido que migrar, aprovisionando vacío.');
            self::provisionMysqlDatabase($gym, $console, false);
            return;
        }

        self::provisionPgsqlSchema($gym, $console, false);

        $schema = $gym->db_name; // set by provisionPgsqlSchema() above
        $shared = DB::connection('pgsql');

        // provisionPgsqlSchema() just pointed the 'tenant' connection's
        // search_path at [schema, 'public'] and purged it — with
        // PDO::ATTR_PERSISTENT set on 'pgsql' (config/database.php), PHP can
        // hand 'tenant' back the SAME physical socket 'pgsql' already had
        // open (persistent PDO pools by connection string, not by Laravel's
        // connection name), meaning that SET search_path leaks onto 'pgsql'
        // too. Every query below that reads/writes 'public' unqualified —
        // migrateSettings() and, critically, the existing wipeSharedGymData()
        // this reuses unmodified — would silently resolve against the gym's
        // own schema instead without this, since it comes first in that
        // search_path.
        $shared->statement('SET search_path TO public');

        // Tables with their own gym_id column in 'public', copied in an order
        // that never inserts a child row before the parent it references —
        // reverse of wipeSharedGymData()'s delete order (which goes
        // child-first), minus support_tickets (stays in 'public' — the
        // operator's support panel needs every gym's tickets in one place,
        // paid or not). member_labels is NOT in this list despite having a
        // wipeSharedGymData() comment implying otherwise at a glance — like
        // class_schedules/class_sessions, it has no gym_id of its own in the
        // real live schema (confirmed against information_schema, the .sql
        // export on disk was stale for this one table) and is scoped only
        // through member_id → members.gym_id.
        $directTables = [
            'trainers', 'members', 'labels', 'membership_types',
            'discount_categories', 'products', 'whatsapp_logs',
        ];
        $afterClasses = [
            'memberships', 'visits', 'payments', 'product_sales', 'ingresos',
        ];
        $childTables = [
            // [table, fk column, parent table]
            ['class_schedules', 'class_id', 'classes'],
            ['class_sessions',  'class_id', 'classes'],
            ['member_labels',   'member_id', 'members'],
        ];

        $shared->transaction(function () use ($shared, $schema, $gym, $log, $directTables, $afterClasses, $childTables) {
            foreach ($directTables as $table) {
                self::copyTableRows($shared, $schema, $table, 'gym_id', $gym->id, $log);
            }

            $log('→ Migrando configuración (settings)...');
            self::migrateSettings($shared, $schema, $gym->id, $log);

            self::copyTableRows($shared, $schema, 'classes', 'gym_id', $gym->id, $log);

            foreach ($childTables as [$table, $fkColumn, $parentTable]) {
                self::copyChildTableRows($shared, $schema, $table, $fkColumn, $parentTable, $gym->id, $log);
            }

            foreach ($afterClasses as $table) {
                self::copyTableRows($shared, $schema, $table, 'gym_id', $gym->id, $log);
            }

            foreach (array_merge($directTables, ['classes'], $afterClasses) as $table) {
                self::resetSequence($shared, $schema, $table, $log);
            }
            foreach (array_column($childTables, 0) as $table) {
                self::resetSequence($shared, $schema, $table, $log);
            }

            $log('→ Limpiando datos ya migrados del schema compartido...');
            self::wipeSharedGymData($gym->id);
        });

        $log("→ Migración de datos completa para {$gym->name} → \"{$schema}\".");
    }

    /**
     * Copies every row from public.<table> where <table>.<scopeColumn> =
     * $gymId into "<schema>".<table>, using only the columns both tables
     * actually have in common (minus $scopeColumn itself, which the tenant
     * table doesn't carry — its whole schema IS the scope). Discovering
     * columns at runtime instead of hardcoding a list per table means this
     * keeps working if either table's columns ever change.
     */
    private static function copyTableRows($shared, string $schema, string $table, string $scopeColumn, int $gymId, callable $log): void
    {
        $cols = self::commonColumns($shared, $schema, $table, $scopeColumn);
        if (empty($cols)) {
            $log("  ⚠ {$table}: sin columnas en común, se omite.");
            return;
        }

        $colList = implode(', ', array_map(fn($c) => "\"{$c}\"", $cols));
        $moved = $shared->insert(
            "INSERT INTO \"{$schema}\".\"{$table}\" ({$colList}) " .
            "SELECT {$colList} FROM public.\"{$table}\" WHERE \"{$scopeColumn}\" = ?",
            [$gymId]
        );
        $log("  · {$table}: copiado.");
    }

    /**
     * Same as copyTableRows(), but for a table (class_schedules,
     * class_sessions) that has no gym_id of its own — it's reached through
     * $fkColumn (class_id) pointing at a row in $parentTable (classes) that
     * does.
     */
    private static function copyChildTableRows($shared, string $schema, string $table, string $fkColumn, string $parentTable, int $gymId, callable $log): void
    {
        $cols = self::commonColumns($shared, $schema, $table, null);
        if (empty($cols)) {
            $log("  ⚠ {$table}: sin columnas en común, se omite.");
            return;
        }

        $colList = implode(', ', array_map(fn($c) => "\"{$c}\"", $cols));
        $shared->insert(
            "INSERT INTO \"{$schema}\".\"{$table}\" ({$colList}) " .
            "SELECT {$colList} FROM public.\"{$table}\" WHERE \"{$fkColumn}\" IN " .
            "(SELECT id FROM public.\"{$parentTable}\" WHERE gym_id = ?)",
            [$gymId]
        );
        $log("  · {$table}: copiado (vía {$parentTable}).");
    }

    /**
     * settings is unique per table: the tenant copy was already seeded with
     * sensible defaults by seedTenantSettings() inside provisionPgsqlSchema()
     * above, and 'public' may not have a row for every key (only whatever
     * the gym actually changed during its trial). upsert-by-key onto the
     * seeded defaults keeps every key covered while making sure anything the
     * gym genuinely configured wins over the default.
     */
    private static function migrateSettings($shared, string $schema, int $gymId, callable $log): void
    {
        $rows = $shared->table('public.settings')->where('gym_id', $gymId)->get(['key', 'value', 'type', 'group', 'label']);
        foreach ($rows as $row) {
            $shared->table("{$schema}.settings")->updateOrInsert(
                ['key' => $row->key],
                [
                    'value' => $row->value,
                    'type'  => $row->type,
                    'group' => $row->group,
                    'label' => $row->label,
                ]
            );
        }
    }

    /**
     * Column names present in both public.<table> and "<schema>".<table>,
     * minus $excludeColumn (the scope column — gym_id — that only the source
     * table has and that the copy shouldn't carry over).
     */
    private static function commonColumns($shared, string $schema, string $table, ?string $excludeColumn): array
    {
        $sourceCols = $shared->select(
            'SELECT column_name FROM information_schema.columns WHERE table_schema = ? AND table_name = ?',
            ['public', $table]
        );
        $targetCols = $shared->select(
            'SELECT column_name FROM information_schema.columns WHERE table_schema = ? AND table_name = ?',
            [$schema, $table]
        );

        $source = array_column($sourceCols, 'column_name');
        $target = array_column($targetCols, 'column_name');
        $common = array_values(array_intersect($source, $target));

        if ($excludeColumn) {
            $common = array_values(array_diff($common, [$excludeColumn]));
        }

        return $common;
    }

    /**
     * Rows just copied in keep their original ids (safe — those ids were
     * only ever unique within this one gym's data to begin with, and moving
     * to an isolated schema doesn't change that). But the schema's own
     * BIGSERIAL sequence for the table has no idea those ids are now taken,
     * so the next INSERT without an explicit id would collide. Advancing the
     * sequence past the highest copied id avoids that.
     *
     * Guarded for tables with no serial 'id' at all (member_labels has a
     * composite primary key, member_id+label_id, no sequence to reset) —
     * pg_get_serial_sequence() doesn't just return NULL for a column that
     * isn't there, it raises an error, so the lookup itself is wrapped in
     * its own BEGIN/EXCEPTION to swallow that and no-op instead.
     */
    private static function resetSequence($shared, string $schema, string $table, callable $log): void
    {
        $shared->statement(
            "DO \$\$
            DECLARE seq text;
            BEGIN
                BEGIN
                    seq := pg_get_serial_sequence('\"{$schema}\".\"{$table}\"', 'id');
                EXCEPTION WHEN OTHERS THEN
                    seq := NULL;
                END;
                IF seq IS NOT NULL THEN
                    PERFORM setval(seq, COALESCE((SELECT MAX(id) FROM \"{$schema}\".\"{$table}\"), 1));
                END IF;
            END \$\$;"
        );
    }

    /**
     * Permanently wipes ALL operational data belonging to a gym — the
     * dedicated schema/database for a paid gym, or every gym_id-scoped row
     * in the shared schema for a free gym. Mirror image of provision(): this
     * only handles the STORAGE side. The caller is responsible for deleting
     * the gym's `users` rows and the `gyms` row itself afterward — same
     * division of responsibility provision() already has (it doesn't touch
     * those either; StripeController creates them before calling it).
     *
     * Irreversible. Called from SuperAdminController::deleteGym(), which
     * gates it behind SUPERADMIN_DELETE_SECRET.
     */
    public static function destroy(Gym $gym): void
    {
        if (config('database.default') === 'mysql') {
            self::destroyMysqlStorage($gym);
        } else {
            self::destroyPgsqlStorage($gym);
        }
    }

    private static function destroyMysqlStorage(Gym $gym): void
    {
        if ($gym->plan_type === 'paid' && $gym->db_name) {
            DB::statement("DROP DATABASE IF EXISTS `{$gym->db_name}`");
            return;
        }

        // Free-tier gym — shared 'gemasystem' database, gym_id-scoped rows.
        self::wipeSharedGymData($gym->id);
    }

    private static function destroyPgsqlStorage(Gym $gym): void
    {
        if ($gym->plan_type === 'paid' && $gym->db_name) {
            DB::connection('pgsql')->statement("DROP SCHEMA IF EXISTS \"{$gym->db_name}\" CASCADE");
            return;
        }

        // Free-tier gym — shared 'public' schema, gym_id-scoped rows.
        self::wipeSharedGymData($gym->id);
    }

    /**
     * Deletes every row belonging to this gym across the shared schema's
     * gym_id-scoped tables. Order matters: tables listed first are either
     * referenced by a later table with a plain (non-cascading) FK — e.g.
     * product_sales.product_id blocks deleting products first — or are
     * children of a later table whose own rows we're about to remove.
     * Tables with NO gym_id column of their own (class_schedules,
     * class_sessions, member_labels, ticket_messages) aren't listed here —
     * they cascade automatically once their parent (classes/members/
     * labels/support_tickets) rows are deleted, per the FKs declared in
     * gemasystem_supabase.sql.
     */
    private static function wipeSharedGymData(int $gymId): void
    {
        $order = [
            'product_sales', 'payments', 'visits', 'memberships',
            'classes', 'products', 'support_tickets', 'trainers', 'members',
            'ingresos', 'labels', 'membership_types', 'discount_categories',
            'settings', 'whatsapp_logs',
        ];

        foreach ($order as $table) {
            DB::table($table)->where('gym_id', $gymId)->delete();
        }
    }

    /**
     * Seed default settings directly into the tenant database.
     * Tenant settings table has no gym_id column.
     */
    private static function seedTenantSettings(Gym $gym): void
    {
        $adminUser = $gym->users()->where('role', 'admin')->first();
        $gymEmail  = $adminUser?->email ?? '';

        $defaults = [
            ['key' => 'gym_name',                   'value' => $gym->name],
            ['key' => 'gym_description',             'value' => ''],
            ['key' => 'gym_address',                 'value' => ''],
            ['key' => 'gym_phone',                   'value' => ''],
            ['key' => 'gym_email',                   'value' => $gymEmail],
            ['key' => 'theme_color',                 'value' => 'indigo'],
            ['key' => 'price_visit_training',        'value' => '0'],
            ['key' => 'price_visit_class',           'value' => '0'],
            ['key' => 'price_visit_consultation',    'value' => '0'],
            ['key' => 'price_visit_other',           'value' => '0'],
            ['key' => 'price_membership_monthly',    'value' => '0'],
            ['key' => 'price_membership_quarterly',  'value' => '0'],
            ['key' => 'price_membership_biannual',   'value' => '0'],
            ['key' => 'price_membership_annual',     'value' => '0'],
            ['key' => 'send_welcome_email',          'value' => '1'],
            ['key' => 'expiry_alert_days',           'value' => '7'],
            ['key' => 'currency',                    'value' => 'MXN'],
            ['key' => 'timezone',                    'value' => 'America/Mexico_City'],
            ['key' => 'trial_days',                  'value' => '0'],
        ];

        foreach ($defaults as $row) {
            DB::connection('tenant')
                ->table('settings')
                ->updateOrInsert(['key' => $row['key']], ['key' => $row['key'], 'value' => $row['value']]);
        }
    }
}
