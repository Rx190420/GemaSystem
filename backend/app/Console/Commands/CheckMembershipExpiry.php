<?php

namespace App\Console\Commands;

use App\Mail\MembershipReminder;
use App\Models\Gym;
use App\Models\GymNotification;
use App\Models\Member;
use App\Services\NotificationService;
use App\Services\WhatsAppService;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

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

            // Off by default — the in-app bell notice below always fires
            // regardless; these only control whether the member ALSO gets
            // messaged directly, and on which channel(s). See Settings →
            // Notificaciones. WhatsApp is additionally gated behind the
            // gym's own 'whatsapp' plan feature — a gym that never acquired
            // it can't have this setting on in the UI, but re-checking here
            // means a lapsed/downgraded plan stops sending too, not just
            // hides the toggle.
            $emailEnabled = DB::table('settings')
                ->where('gym_id', $gym->id)
                ->where('key', 'send_expiry_reminder_email')
                ->value('value') === '1';
            $waEnabled = $gym->hasFeature('whatsapp') && DB::table('settings')
                ->where('gym_id', $gym->id)
                ->where('key', 'send_expiry_reminder_whatsapp')
                ->value('value') === '1';

            $conn = $this->dbConn($gym);

            // ── Membresías que vencen exactamente en $alertDays días ─────────
            $expiring = $conn->table('memberships as m')
                ->join('members as mb', 'm.member_id', '=', 'mb.id')
                ->where('m.status', 'active')
                ->whereDate('m.end_date', $today->copy()->addDays($alertDays)->toDateString())
                ->when(!$gym->isPaid(), fn($q) => $q->where('m.gym_id', $gym->id))
                ->select('m.member_id', 'm.end_date', 'mb.first_name', 'mb.last_name', 'mb.email', 'mb.phone', 'mb.member_code')
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

                if ($emailEnabled && $row->email) {
                    $this->sendReminderEmail($conn, $row->member_id, $row->email, $alertDays, $row->end_date);
                }
                if ($waEnabled && $row->phone) {
                    WhatsAppService::membershipReminder(
                        $row->phone, $row->first_name, $row->member_code, $alertDays, $row->end_date, $gym->name, $gym->id
                    );
                }

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

    /**
     * Builds the Member model on whichever connection $conn actually is
     * (default, or the dynamically-repointed 'tenant' one for a paid gym —
     * see dbConn()) so MembershipReminder gets a real model instance, not
     * just the raw query row. withoutGlobalScopes() skips GymScope on
     * purpose: the row was already correctly scoped by the raw query above,
     * and for a paid gym GymScope wouldn't apply anyway (isolation is the
     * separate database itself, not the scope). Any failure here is logged
     * and swallowed — a bad email address or transient SMTP error shouldn't
     * abort the whole daily run for every other gym.
     */
    private function sendReminderEmail(\Illuminate\Database\ConnectionInterface $conn, int $memberId, string $email, int $daysLeft, string $endDate): void
    {
        try {
            $member = Member::on($conn->getName())->withoutGlobalScopes()->find($memberId);
            if (!$member) {
                return;
            }
            Mail::to($email)->send(new MembershipReminder($member, $daysLeft, $endDate));
        } catch (\Throwable $e) {
            Log::warning("CheckMembershipExpiry: reminder email failed for member {$memberId}: " . $e->getMessage());
        }
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

    private function alreadyNotifiedToday(int $gymId, string $type, int $memberId): bool
    {
        return GymNotification::where('gym_id', $gymId)
            ->where('type', $type)
            ->whereDate('created_at', Carbon::today())
            ->whereRaw("JSON_EXTRACT(data, '$.member_id') = ?", [$memberId])
            ->exists();
    }
}
