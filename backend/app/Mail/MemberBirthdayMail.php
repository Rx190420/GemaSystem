<?php

namespace App\Mail;

use App\Models\Member;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class MemberBirthdayMail extends Mailable
{
    use Queueable, SerializesModels;

    public Member $member;
    public ?string $gymName;

    public function __construct(Member $member, ?string $gymName = null)
    {
        $this->member  = $member;
        $this->gymName = $gymName;
    }

    public function build(): self
    {
        return $this
            ->subject("¡Feliz cumpleaños, {$this->member->first_name}! 🎂")
            ->view('emails.member_birthday');
    }
}
