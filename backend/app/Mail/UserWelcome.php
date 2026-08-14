<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class UserWelcome extends Mailable
{
    use Queueable, SerializesModels;

    public User   $user;
    public string $accessCode;

    public function __construct(User $user, string $accessCode)
    {
        $this->user       = $user;
        $this->accessCode = $accessCode;
    }

    public function build(): self
    {
        return $this
            ->subject('Bienvenido a GemaSystem — Tu código de acceso')
            ->view('emails.user_welcome');
    }
}
