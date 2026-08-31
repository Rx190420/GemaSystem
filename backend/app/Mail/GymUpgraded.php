<?php

namespace App\Mail;

use App\Models\Gym;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

/**
 * Welcome-to-paid confirmation — sent in both trial→paid conversion paths:
 * immediately when an operator converts a gym without charging it
 * (SuperAdminController::convertTrialToPaid(), charge=false), and after a
 * successful payment when they did charge it
 * (StripeController::fulfillTrialUpgrade()). Same message either way — by
 * the time this arrives the gym is already active with its own schema, so
 * there's nothing left to distinguish from the recipient's side.
 */
class GymUpgraded extends Mailable
{
    use Queueable, SerializesModels;

    public string $gymName;
    public string $planLabel;

    public function __construct(Gym $gym)
    {
        $this->gymName   = $gym->name;
        $this->planLabel = GymUpgradePending::planLabel($gym->plan, $gym->plan_features);
    }

    public function build(): self
    {
        return $this
            ->subject("¡Tu cuenta en GemaSystem ya es de pago! — {$this->gymName}")
            ->view('emails.gym_upgraded');
    }
}
