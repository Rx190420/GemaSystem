<?php

namespace App\Console\Commands;

use App\Models\Gym;
use App\Models\GymNotification;
use App\Services\NotificationService;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class CheckMembershipExpiry extends Command
{
    protected $signature   = 'notifications:membership-expiry';
    protected $description = 'Genera notificaciones de membresías próximas a vencer o ya vencidas.';

    public function handle(): int
    {
        $today   = Carbon::today();
        $created = 0;

        $gyms = Gym::where('status', '!=', 'suspended')->get();

        foreach ($gyms as $gym) {
            $alertDays = (int) DB::table('settings')
                ->where('gym_id', $gym->id)
                ->where('key', 'expiry_alert_days')
                ->value('value') ?: 7;

            $conn = $this->dbConn($gym);

            // ── Membresías que vencen exactamente en $alertDays días ─────────
            $expiring = $conn->table('memberships as m')
                ->join('members as mb', 'm.member_id', '=', 'mb.id')
                ->where('m.status', 'active')
                ->whereDate('m.end_date', $today->copy()->addDays($alertDays)->toDateString())
                ->when(!$gym->isPaid(), fn($q) => $q->where('m.gym_id', $gym->id))
                ->select('m.member_id', 'm.end_date', 'mb.first_name', 'mb.last_name')
                ->get();

            foreach ($expiring as $row) {
                if ($this->alreadyNotifiedToday($gym->id, 'membership_expiring', $row->member_id)) {
                    continue;
                }
                NotificationService::membershipExpiring(
                    $gym->id,
                    $row->member_id,
                    "{$row->first_name} {$row->last_name}",
                    $row->end_date,
                    $alertDays
                );
                $created++;
            }

            // ── Membresías activas que ya vencieron ───────────────────────────
            $expired = $conn->table('memberships as m')
                ->join('members as mb', 'm.member_id', '=', 'mb.id')
                ->where('m.status', 'active')
                ->whereDate('m.end_date', '<', $today->toDateString())
                ->when(!$gym->isPaid(), fn($q) => $q->where('m.gym_id', $gym->id))
                ->select('m.id as membership_id', 'm.member_id', 'm.end_date',
                         'mb.first_name', 'mb.last_name')
                ->get();

            foreach ($expired as $row) {
                if ($this->alreadyNotifiedToday($gym->id, 'membership_expired', $row->member_id)) {
                    continue;
                }
                NotificationService::membershipExpired(
                    $gym->id,
                    $row->member_id,
                    "{$row->first_name} {$row->last_name}",
                    $row->end_date
                );
                // Mark membership as expired so it won't show up again tomorrow
                $conn->table('memberships')
                    ->where('id', $row->membership_id)
                    ->update(['status' => 'expired', 'updated_at' => now()]);
                $created++;
            }
        }

        $this->info("Notificaciones de membresía generadas: {$created}");
        return 0;
    }

    private function dbConn(Gym $gym): \Illuminate\Database\ConnectionInterface
    {
        if ($gym->isPaid()) {
            config(['database.connections.tenant' => array_merge(
                config('database.connections.mysql'),
                ['database' => $gym->db_name]
            )]);
            DB::purge('tenant');
            return DB::connection('tenant');
        }
        return DB::connection();
    }

    private function alreadyNotifiedToday(int $gymId, string $type, int $memberId): bool
    {
        return GymNotification::where('gym_id', $gymId)
            ->where('type', $type)
            ->whereDate('created_at', Carbon::today())
            ->whereRaw("JSON_EXTRACT(data, '$.member_id') = ?", [$memberId])
            ->exists();
    }
}
