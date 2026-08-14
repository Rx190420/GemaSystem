<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class PasswordResetCodeMail extends Mailable
{
    use Queueable, SerializesModels;

    public string $code;
    public string $userName;
    public bool   $isChange;

    public function __construct(string $code, string $userName, bool $isChange = false)
    {
        $this->code     = $code;
        $this->userName = $userName;
        $this->isChange = $isChange;
    }

    public function build(): self
    {
        $subject = $this->isChange
            ? 'Código para cambiar tu contraseña — GemaSystem'
            : 'Recupera tu contraseña — GemaSystem';

        return $this
            ->subject($subject)
            ->view('emails.password-reset-code');
    }
}
