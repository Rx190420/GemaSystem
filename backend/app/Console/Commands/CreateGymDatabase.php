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
