<?php

namespace App\Mail;

use Carbon\Carbon;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class InvoiceReceiptMail extends Mailable
{
    use Queueable, SerializesModels;

    public string  $gymName;
    public string  $planLabel;
    public string  $amount;
    public string  $currency;
    public ?Carbon $periodStart;
    public ?Carbon $periodEnd;
    public ?string $invoiceId;
    public ?string $invoiceUrl;
    public ?string $invoicePdf;

    public function __construct(
        string  $gymName,
        string  $planLabel,
        string  $amount,
        string  $currency,
        ?Carbon $periodStart,
        ?Carbon $periodEnd,
        ?string $invoiceId,
        ?string $invoiceUrl,
        ?string $invoicePdf
    ) {
        $this->gymName     = $gymName;
        $this->planLabel   = $planLabel;
        $this->amount      = $amount;
        $this->currency    = $currency;
        $this->periodStart = $periodStart;
        $this->periodEnd   = $periodEnd;
        $this->invoiceId   = $invoiceId;
        $this->invoiceUrl  = $invoiceUrl;
        $this->invoicePdf  = $invoicePdf;
    }

    public function build(): self
    {
        return $this
            ->subject("Recibo de pago — Plan {$this->planLabel} · GemaSystem")
            ->view('emails.invoice_receipt');
    }
}
