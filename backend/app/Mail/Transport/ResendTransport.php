<?php

namespace App\Mail\Transport;

use Illuminate\Mail\Transport\Transport;
use Illuminate\Support\Facades\Http;
use Swift_Mime_SimpleMessage;
use Swift_TransportException;

/**
 * Sends mail through Resend's HTTP API (https://api.resend.com/emails)
 * instead of raw SMTP.
 *
 * Why this exists: Railway blocks outbound SMTP entirely — confirmed via
 * production logs, both port 465 (implicit TLS) and 587 (STARTTLS) time out
 * at the plain TCP level, before any TLS/auth negotiation even starts. HTTPS
 * (443) is never blocked, so an HTTP-API-based mailer is the only way to
 * send transactional mail from this Railway deployment.
 *
 * Not using the official resend/resend-laravel package: composer isn't
 * installed on this machine, so composer.json/composer.lock can't be safely
 * regenerated here (hand-editing composer.json without a matching lock
 * update means `composer install` on Railway would just ignore the new
 * requirement). This is a small, self-contained Swift_Transport — same
 * pattern Laravel's own bundled MailgunTransport uses — built on the HTTP
 * client (Guzzle) already shipped with the framework, zero new dependencies.
 *
 * Only handles what this app's Mailables actually produce (HTML/text body,
 * to/cc/bcc/reply-to) — none of them use ->attach(), so file attachments
 * aren't implemented here.
 */
class ResendTransport extends Transport
{
    public function __construct(protected string $apiKey)
    {
    }

    public function send(Swift_Mime_SimpleMessage $message, &$failedRecipients = null)
    {
        $this->beforeSendPerformed($message);

        $from = $this->formatAddresses($message->getFrom());
        $to   = $this->formatAddresses($message->getTo());

        $payload = [
            'from'    => $from[0] ?? config('mail.from.address'),
            'to'      => $to,
            'subject' => $message->getSubject() ?? '',
        ];

        if ($cc = $this->formatAddresses($message->getCc())) {
            $payload['cc'] = $cc;
        }
        if ($bcc = $this->formatAddresses($message->getBcc())) {
            $payload['bcc'] = $bcc;
        }
        if ($replyTo = $this->formatAddresses($message->getReplyTo())) {
            $payload['reply_to'] = $replyTo[0];
        }

        [$html, $text] = $this->extractBodies($message);
        if ($html !== null) $payload['html'] = $html;
        if ($text !== null) $payload['text'] = $text;
        if ($html === null && $text === null) $payload['text'] = ''; // Resend requires at least one body

        $response = Http::withToken($this->apiKey)
            ->timeout(15)
            ->post('https://api.resend.com/emails', $payload);

        if ($response->failed()) {
            throw new Swift_TransportException(
                'Resend API request failed ('.$response->status().'): '.$response->body()
            );
        }

        $this->sendPerformed($message);

        return $this->numberOfRecipients($message);
    }

    /** @return string[] e.g. ["Name <email@x.com>", "other@x.com"] */
    protected function formatAddresses(?array $addresses): array
    {
        if (!$addresses) return [];

        $out = [];
        foreach ($addresses as $email => $name) {
            $out[] = $name ? "{$name} <{$email}>" : $email;
        }
        return $out;
    }

    /** @return array{0: ?string, 1: ?string} [$html, $text] */
    protected function extractBodies(Swift_Mime_SimpleMessage $message): array
    {
        $html = null;
        $text = null;

        $contentType = $message->getContentType();
        $body        = $message->getBody();

        if (str_contains((string) $contentType, 'html')) {
            $html = $body;
        } elseif (str_contains((string) $contentType, 'text/plain')) {
            $text = $body;
        }

        // Mailables with both an HTML view and a plaintext fallback render
        // as a multipart message — the alternate part shows up as a child.
        foreach ($message->getChildren() as $child) {
            if (!$child instanceof Swift_Mime_SimpleMessage) continue;

            $childType = (string) $child->getContentType();
            if ($html === null && str_contains($childType, 'html')) {
                $html = $child->getBody();
            } elseif ($text === null && str_contains($childType, 'text/plain')) {
                $text = $child->getBody();
            }
        }

        return [$html, $text];
    }
}
