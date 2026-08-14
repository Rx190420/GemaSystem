<?php

namespace App\Mail;

use App\Models\Member;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class MemberWelcome extends Mailable
{
    use Queueable, SerializesModels;

    public Member $member;

    public function __construct(Member $member)
    {
        $this->member = $member;
    }

    public function build(): self
    {
        return $this
            ->subject('Bienvenido a GemaSystem — Tu acceso')
            ->view('emails.member_welcome');
    }
}
