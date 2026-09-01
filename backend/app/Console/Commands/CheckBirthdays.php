<?php

namespace App\Console\Commands;

use App\Mail\MemberBirthdayMail;
use App\Models\Gym;
use App\Models\GymNotification;
use App\Models\Member;
use App\Services\NotificationService;
use App\Services\WhatsAppService;
use App\Support\SqlPortability;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * Daily birthday check — always posts the in-app "cumpleaños hoy" bell
 * notice (staff-facing, no setting needed for that part); ALSO messages the
 * member a greeting on whichever channel(s) the gym turned on in Settings →
 * Notificaciones (`send_birthday_email` / `send_birthday_whatsapp`). Both
 * off by default, matching how a brand-new setting key reads
 * (DB::table('settings')->value(...) === '1' is false for both "explicitly
 * off" and "never set"). WhatsApp is additionally re-checked against the
 * gym's own 'whatsapp' plan feature — see CheckMembershipExpiry for why.
 */
class CheckBirthdays extends Command
{
    protected $signature   = 'notifications:birthdays';
    protected $description = 'Notifica y felicita (si está habilitado) a los socios que cumplen años hoy.';

    public function handle(): int
    {
        $today   = Carbon::today();
        $month   = $today->month;
        $day     = $today->day;
        $created = 0;

        $whereMonthDay = SqlPortability::isPgsql()
            ? 'EXTRACT(MONTH FROM birth_date) = ? AND EXTRACT(DAY FROM birth_date) = ?'
            : 'MONTH(birth_date) = ? AND DAY(birth_date) = ?';

        $gyms = Gym::where('status', '!=', 'suspended')->get();

        foreach ($gyms as $gym) {
            $emailEnabled = DB::table('settings')
                ->where('gym_id', $gym->id)
                ->where('key', 'send_birthday_email')
                ->value('value') === '1';
            $waEnabled = $gym->hasFeature('whatsapp') && DB::table('settings')
                ->where('gym_id', $gym->id)
                ->where('key', 'send_birthday_whatsapp')
                ->value('value') === '1';

            $conn = $this->dbConn($gym);

            $members = $conn->table('members')
                ->whereNotNull('birth_date')
                ->where('status', 'active')
                ->whereRaw($whereMonthDay, [$month, $day])
                ->when(!$gym->isPaid(), fn ($q) => $q->where('gym_id', $gym->id))
                ->select('id', 'first_name', 'last_name', 'email', 'phone')
                ->get();

            foreach ($members as $row) {
                if ($this->alreadyNotifiedToday($gym->id, 'member_birthday', $row->id)) {
                    continue;
                }

                NotificationService::memberBirthday($gym->id, $row->id, "{$row->first_name} {$row->last_name}");

                if ($emailEnabled && $row->email) {
                    $this->sendBirthdayEmail($conn, $row->id, $row->email, $gym->name);
                }
                if ($waEnabled && $row->phone) {
                    WhatsAppService::birthdayGreeting($row->phone, $row->first_name, $gym->name, $gym->id);
                }

                $created++;
            }
        }

        $this->info("Felicitaciones de cumpleaños generadas: {$created}");
        return 0;
    }

    private function sendBirthdayEmail(\Illuminate\Database\ConnectionInterface $conn, int $memberId, string $email, ?string $gymName): void
    {
        try {
            $member = Member::on($conn->getName())->withoutGlobalScopes()->find($memberId);
            if (!$member) {
                return;
            }
            Mail::to($email)->send(new MemberBirthdayMail($member, $gymName));
        } catch (\Throwable $e) {
            Log::warning("CheckBirthdays: greeting email failed for member {$memberId}: " . $e->getMessage());
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
