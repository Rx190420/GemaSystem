<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class TrialApproved extends Mailable
{
    use Queueable, SerializesModels;

    public string $gymName;
    public string $contactName;
    public string $username;
    public string $password;
    public string $trialDays;

    public function __construct(string $gymName, string $contactName, string $username, string $password, int $trialDays = 10)
    {
        $this->gymName     = $gymName;
        $this->contactName = $contactName;
        $this->username    = $username;
        $this->password    = $password;
        $this->trialDays   = $trialDays;
    }

    public function build(): self
    {
        return $this
            ->subject("¡Tu cuenta en GemaSystem ha sido aprobada! — {$this->gymName}")
            ->view('emails.trial_approved');
    }
}
