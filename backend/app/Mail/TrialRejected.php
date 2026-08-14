<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class TrialRejected extends Mailable
{
    use Queueable, SerializesModels;

    public string $gymName;
    public string $contactName;
    public ?string $reason;

    public function __construct(string $gymName, string $contactName, ?string $reason = null)
    {
        $this->gymName     = $gymName;
        $this->contactName = $contactName;
        $this->reason      = $reason;
    }

    public function build(): self
    {
        return $this
            ->subject("Actualización sobre tu solicitud — GemaSystem")
            ->view('emails.trial_rejected');
    }
}
