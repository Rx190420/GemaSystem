<?php

namespace App\Mail;

use Carbon\Carbon;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class PaymentFailedMail extends Mailable
{
    use Queueable, SerializesModels;

    public string  $gymName;
    public string  $planLabel;
    public string  $amount;
    public string  $currency;
    public int     $daysRemaining;
    public ?Carbon $suspensionDate;
    public int     $attemptCount;
    public ?Carbon $nextAttemptDate;

    public function __construct(
        string  $gymName,
        string  $planLabel,
        string  $amount,
        string  $currency,
        int     $daysRemaining,
        ?Carbon $suspensionDate,
        int     $attemptCount,
        ?Carbon $nextAttemptDate
    ) {
        $this->gymName         = $gymName;
        $this->planLabel       = $planLabel;
        $this->amount          = $amount;
        $this->currency        = $currency;
        $this->daysRemaining   = $daysRemaining;
        $this->suspensionDate  = $suspensionDate;
        $this->attemptCount    = $attemptCount;
        $this->nextAttemptDate = $nextAttemptDate;
    }

    public function build(): self
    {
        return $this
            ->subject("⚠️ Problema con tu pago — Plan {$this->planLabel} · GemaSystem")
            ->view('emails.payment_failed');
    }
}
