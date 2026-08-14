<?php

namespace App\Console\Commands;

use App\Models\Gym;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class SuspendExpiredTrials extends Command
{
    protected $signature   = 'gyms:suspend-expired';
    protected $description = 'Suspende automáticamente los gyms cuyo período (trial gratuito o suscripción paga) ha vencido.';

    public function handle(): int
    {
        $this->info('Verificando gyms con período vencido...');
        $suspended = 0;

        // Gyms gratuitos con trial vencido
        $expiredFree = Gym::where('plan_type', 'free')
            ->whereNotNull('subscription_ends_at')
            ->where('subscription_ends_at', '<', now())
            ->where('status', '!=', 'suspended')
            ->get();

        foreach ($expiredFree as $gym) {
            $this->doSuspend($gym, 'trial_expired');
            $this->line("  ✓ [FREE] Gym #{$gym->id} ({$gym->name}) — trial venció el {$gym->subscription_ends_at->toDateString()}");
            $suspended++;
        }

        // Gyms de pago con suscripción vencida (2 horas de gracia para webhooks de Stripe)
        $expiredPaid = Gym::where('plan_type', 'paid')
            ->whereNotNull('subscription_ends_at')
            ->where('subscription_ends_at', '<', now()->subHours(2))
            ->where('status', '!=', 'suspended')
            ->get();

        foreach ($expiredPaid as $gym) {
            $this->doSuspend($gym, 'payment_due');
            $this->line("  ✓ [PAID] Gym #{$gym->id} ({$gym->name}) — suscripción venció el {$gym->subscription_ends_at->toDateString()}");
            $suspended++;
        }

        if ($suspended === 0) {
            $this->info('No hay gyms con período vencido.');
        } else {
            $this->info("Suspendidos: {$suspended} gym(s).");
        }

        return 0;
    }

    private function doSuspend(Gym $gym, string $billingStatus): void
    {
        $gym->update([
            'status'         => 'suspended',
            'billing_status' => $billingStatus,
        ]);

        $userIds = User::where('gym_id', $gym->id)->pluck('id');

        // Revocar todos los tokens activos
        DB::table('personal_access_tokens')
            ->whereIn('tokenable_id', $userIds)
            ->where('tokenable_type', User::class)
            ->delete();

        // Suspender todos los usuarios del gym (incluyendo si tienen miembros registrados)
        User::where('gym_id', $gym->id)
            ->where('extended_access', 0)
            ->update(['account_status' => 'suspended']);
    }
}
