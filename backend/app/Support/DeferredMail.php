<?php

namespace App\Support;

use Illuminate\Mail\Mailable;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * Sends a Mailable AFTER the HTTP response has already gone out to the
 * client, instead of blocking the whole request on the mail provider's
 * network round-trip (Resend/SES: typically 300ms-2s, sometimes more).
 * Uses Laravel's built-in dispatch(...)->afterResponse() — no queue worker,
 * no Redis, no extra Railway service: the same PHP process keeps running
 * for a moment after flushing the response, same request lifecycle, just
 * deferred to the very end of it.
 *
 * Only use this where the response does NOT depend on whether the send
 * succeeds or fails (a "fire and forget" side effect — a welcome email
 * after creating a member/account, a receipt after a webhook already
 * fulfilled). Anywhere the endpoint's whole job IS confirming "the email
 * was sent" (a dedicated resend/notify button with its own success/error
 * toast) must keep calling Mail::to(...)->send(...) directly, so a real
 * failure still reaches the caller instead of a response claiming success
 * before the send even ran.
 */
class DeferredMail
{
    public static function send(string $to, Mailable $mailable, string $context): void
    {
        dispatch(function () use ($to, $mailable, $context) {
            try {
                Mail::to($to)->send($mailable);
            } catch (\Throwable $e) {
                Log::warning("{$context}: " . $e->getMessage());
            }
        })->afterResponse();
    }
}
