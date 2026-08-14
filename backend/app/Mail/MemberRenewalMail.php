<?php

namespace App\Mail;

use App\Models\Member;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class MemberRenewalMail extends Mailable
{
    use Queueable, SerializesModels;

    public Member $member;
    public ?string $gymName;
    public ?string $endDate;

    public function __construct(Member $member, ?string $gymName = null, ?string $endDate = null)
    {
        $this->member  = $member;
        $this->gymName = $gymName;
        $this->endDate = $endDate;
    }

    public function build(): self
    {
        return $this
            ->subject('¡Te invitamos a renovar tu membresía!')
            ->view('emails.member_renewal');
    }
}
