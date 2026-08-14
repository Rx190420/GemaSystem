<?php

namespace App\Mail;

use App\Models\Member;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class MembershipReminder extends Mailable
{
    use Queueable, SerializesModels;

    public Member $member;
    public int $daysLeft;
    public string $endDate;

    public function __construct(Member $member, int $daysLeft, string $endDate)
    {
        $this->member   = $member;
        $this->daysLeft = $daysLeft;
        $this->endDate  = $endDate;
    }

    public function build(): self
    {
        $subject = $this->daysLeft === 0
            ? 'Tu membresía vence hoy'
            : ($this->daysLeft <= 7
                ? "Tu membresía vence en {$this->daysLeft} día(s)"
                : "Recordatorio: {$this->daysLeft} días restantes de membresía");

        return $this
            ->subject($subject)
            ->view('emails.membership_reminder');
    }
}
