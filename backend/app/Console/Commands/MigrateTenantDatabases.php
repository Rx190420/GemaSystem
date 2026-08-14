<?php

namespace App\Console\Commands;

use App\Models\Gym;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class MigrateTenantDatabases extends Command
{
    protected $signature = 'gym:migrate-tenants {--dry-run : List target gyms/databases without running anything}';

    protected $description = 'Applies pending database/migrations/tenant migrations to every already-provisioned paid gym database';

    public function handle(): int
    {
        $gyms = Gym::where('plan_type', 'paid')->whereNotNull('db_name')->orderBy('id')->get();

        if ($gyms->isEmpty()) {
            $this->info('No paid gyms with a dedicated database were found.');
            return 0;
        }

        $this->info("Found {$gyms->count()} paid gym database(s):");
        foreach ($gyms as $gym) {
            $this->line("  - [{$gym->id}] {$gym->name} → {$gym->db_name}");
        }

        if ($this->option('dry-run')) {
            $this->newLine();
            $this->info('Dry run — no migrations were executed.');
            return 0;
        }

        $this->newLine();
        $ok = 0;
        $failed = [];

        foreach ($gyms as $gym) {
            $this->line("→ Migrating {$gym->db_name} ({$gym->name})...");

            try {
                config(['database.connections.tenant' => array_merge(
                    config('database.connections.mysql'),
                    ['database' => $gym->db_name]
                )]);
                DB::purge('tenant');

                \Artisan::call('migrate', [
                    '--database' => 'tenant',
                    '--path'     => 'database/migrations/tenant',
                    '--force'    => true,
                ]);

                $this->info('  ✓ OK');
                $ok++;
            } catch (\Throwable $e) {
                $this->error("  ✗ Failed: {$e->getMessage()}");
                \Log::error("[gym:migrate-tenants] Failed migrating {$gym->db_name}: {$e->getMessage()}");
                $failed[] = $gym->name;
            }
        }

        $this->newLine();
        $this->info("Done: {$ok}/{$gyms->count()} databases migrated successfully.");
        if ($failed) {
            $this->error('Failed: ' . implode(', ', $failed));
            return 1;
        }

        return 0;
    }
}
