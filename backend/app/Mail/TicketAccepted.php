<?php

namespace App\Mail;

use App\Models\SupportTicket;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class TicketAccepted extends Mailable
{
    use Queueable, SerializesModels;

    public SupportTicket $ticket;

    public function __construct(SupportTicket $ticket)
    {
        $this->ticket = $ticket;
    }

    public function build(): self
    {
        return $this
            ->subject("Tu ticket #{$this->ticket->ticket_number} está siendo atendido — GemaSystem Soporte")
            ->view('emails.ticket_accepted');
    }
}
