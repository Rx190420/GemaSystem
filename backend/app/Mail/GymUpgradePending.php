<?php

namespace App\Mail;

use App\Models\Gym;
use App\Services\NotificationService;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

/**
 * Sent the moment an operator converts a trial gym to paid with "charge" —
 * SuperAdminController::convertTrialToPaid(). The gym's login is already
 * blocked (see AuthController::login()'s 'upgrade_pending' branch) by the
 * time this arrives; $paymentUrl is a real, ready-to-use Stripe Checkout
 * link for the exact plan the operator chose, valid for 24h (if it's
 * expired by the time they open it, logging in offers a fresh one).
 */
class GymUpgradePending extends Mailable
{
    use Queueable, SerializesModels;

    public string $gymName;
    public string $planLabel;
    public int $amount;
    public string $paymentUrl;

    public function __construct(Gym $gym, string $paymentUrl)
    {
        $this->gymName    = $gym->name;
        $this->planLabel  = self::planLabel($gym->plan, $gym->plan_features);
        $this->amount     = self::planAmount($gym->plan, $gym->plan_features);
        $this->paymentUrl = $paymentUrl;
    }

    public function build(): self
    {
        return $this
            ->subject("Tu gimnasio ahora es parte de GemaSystem — completa tu pago")
            ->view('emails.gym_upgrade_pending');
    }

    public static function planLabel(?string $plan, ?array $features): string
    {
        if ($plan === 'basic') return 'Basic';
        if ($plan === 'full')  return 'Full';

        $labels = array_map(
            fn ($k) => NotificationService::FEATURE_LABELS[$k] ?? $k,
            array_keys(array_filter($features ?? []))
        );
        return $labels ? 'Custom (' . implode(', ', $labels) . ')' : 'Custom';
    }

    public static function planAmount(?string $plan, ?array $features): int
    {
        if ($plan === 'basic') return (int) config('plans.basic.price');
        if ($plan === 'full')  return (int) config('plans.full.price');

        $amount = (int) config('plans.basic.price');
        foreach (array_keys(array_filter($features ?? [])) as $key) {
            $amount += (int) (config("plans.addons.{$key}.price") ?? 0);
        }
        return $amount;
    }
}
