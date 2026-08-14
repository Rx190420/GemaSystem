<?php

namespace App\Console\Commands;

use App\Models\Gym;
use App\Models\Setting;
use App\Scopes\GymScope;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class CreateGymDatabase extends Command
{
    protected $signature = 'gym:create-database
                            {gym_id : ID del gym a convertir a cuenta de pago}
                            {--force : Omitir confirmación}
                            {--recreate : Eliminar y recrear la DB (BORRA todos los datos)}';

    protected $description = 'Crea una base de datos dedicada para un gym de pago (plan_type = paid)';

    public function handle(): int
    {
        $gym = Gym::find($this->argument('gym_id'));

        if (!$gym) {
            $this->error("Gym ID {$this->argument('gym_id')} no encontrado.");
            return 1;
        }

        if ($gym->plan_type === 'paid' && $gym->db_name && !$this->option('recreate')) {
            $this->warn("Este gym ya tiene base de datos dedicada: {$gym->db_name}");
            $this->warn("Usa --recreate para eliminarla y recrearla (BORRA todos los datos).");
            return 0;
        }

        if ($this->option('recreate') && $gym->db_name) {
            $this->warn("ADVERTENCIA: Se eliminará la base de datos '{$gym->db_name}' y todos sus datos.");
        }

        $dbName = 'gemasystem_gym_' . $gym->id;

        $this->info("Gym:      {$gym->name}");
        $this->info("Base:     {$dbName}");
        $this->newLine();

        if (!$this->option('force') && !$this->confirm('¿Continuar?', true)) {
            $this->line('Cancelado.');
            return 0;
        }

        self::provision($gym, $this, (bool) $this->option('recreate'));

        $this->newLine();
        $this->info("✓ Base de datos '{$dbName}' lista para {$gym->name}.");
        $this->info('  El gym usará esta DB automáticamente al hacer login.');

        return 0;
    }

    /**
     * Provision the dedicated database for a paid gym.
     * Called from both the Artisan command and StripeController::fulfill().
     */
    public static function provision(Gym $gym, ?Command $console = null, bool $recreate = false): void
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

        // 2. Point 'tenant' connection to the new DB
        config(['database.connections.tenant' => array_merge(
            config('database.connections.mysql'),
            ['database' => $dbName]
        )]);
        DB::purge('tenant');

        // 3. Run tenant schema migrations
        $log("→ Creando tablas en {$dbName}...");
        \Artisan::call('migrate', [
            '--database' => 'tenant',
            '--path'     => 'database/migrations/tenant',
            '--force'    => true,
        ]);

        // 4. Seed default settings into the tenant DB (no gym_id column in tenant)
        $log("→ Sembrando configuración inicial...");
        self::seedTenantSettings($gym, $dbName);

        // 5. Update the gym record with db_name
        $gym->update([
            'db_name'   => $dbName,
            'plan_type' => 'paid',
        ]);

        $log("→ Registro actualizado: gym.db_name = {$dbName}");
    }

    /**
     * Seed default settings directly into the tenant database.
     * Tenant settings table has no gym_id column.
     */
    private static function seedTenantSettings(Gym $gym, string $dbName): void
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
