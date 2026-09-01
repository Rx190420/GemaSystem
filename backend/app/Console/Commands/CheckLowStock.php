<?php

namespace App\Console\Commands;

use App\Models\Gym;
use App\Models\GymNotification;
use App\Services\NotificationService;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Daily low-stock check — staff-facing only (no member email makes sense
 * here), gated entirely behind the gym's `low_stock_alerts` setting
 * (Settings → Notificaciones, off by default). Skips gyms on a plan without
 * the products feature at all — nothing to check for them.
 */
class CheckLowStock extends Command
{
    protected $signature   = 'notifications:low-stock';
    protected $description = 'Notifica cuando el stock de un producto llega a su umbral mínimo (si está habilitado).';

    public function handle(): int
    {
        $created = 0;

        $gyms = Gym::where('status', '!=', 'suspended')->get();

        foreach ($gyms as $gym) {
            if (!$gym->hasFeature('products')) {
                continue;
            }

            $enabled = DB::table('settings')
                ->where('gym_id', $gym->id)
                ->where('key', 'low_stock_alerts')
                ->value('value') === '1';

            if (!$enabled) {
                continue;
            }

            $conn = $this->dbConn($gym);

            $products = $conn->table('products')
                ->where('unlimited_stock', false)
                ->whereNotNull('stock')
                ->whereColumn('stock', '<=', 'low_stock_threshold')
                ->where('stock', '>', 0)
                ->where('status', 'active')
                ->when(!$gym->isPaid(), fn ($q) => $q->where('gym_id', $gym->id))
                ->select('id', 'name', 'stock', 'low_stock_threshold')
                ->get();

            foreach ($products as $row) {
                if ($this->alreadyNotifiedToday($gym->id, 'low_stock', $row->id)) {
                    continue;
                }
                NotificationService::lowStock($gym->id, $row->id, $row->name, (int) $row->stock, (int) $row->low_stock_threshold);
                $created++;
            }
        }

        $this->info("Alertas de stock bajo generadas: {$created}");
        return 0;
    }

    /**
     * A paid gym's dedicated storage is a MySQL database OR a Postgres
     * schema depending on which DB backs this deployment (CreateGymDatabase
     * ::provision()'s driver branch) — never both. Branching on the driver
     * here matters in production: this project actually runs on Postgres
     * (Supabase), and building the tenant connection off the 'mysql' config
     * unconditionally would silently fail for every paid gym.
     */
    private function dbConn(Gym $gym): \Illuminate\Database\ConnectionInterface
    {
        if (!$gym->isPaid()) {
            return DB::connection();
        }

        if (config('database.default') === 'mysql') {
            config(['database.connections.tenant' => array_merge(
                config('database.connections.mysql'),
                ['database' => $gym->db_name]
            )]);
        } else {
            config(['database.connections.tenant' => array_merge(
                config('database.connections.pgsql'),
                ['schema' => [$gym->db_name, 'public']]
            )]);
        }
        DB::purge('tenant');
        return DB::connection('tenant');
    }

    private function alreadyNotifiedToday(int $gymId, string $type, int $productId): bool
    {
        return GymNotification::where('gym_id', $gymId)
            ->where('type', $type)
            ->whereDate('created_at', Carbon::today())
            ->whereRaw("JSON_EXTRACT(data, '$.product_id') = ?", [$productId])
            ->exists();
    }
}
