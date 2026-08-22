<?php

namespace App\Support;

/**
 * Icons shared by every email template (resources/views/emails), served as
 * real hosted files at {APP_URL}/mail-assets/*.svg instead of inline base64
 * data-URIs.
 *
 * Previously these were data:image/svg+xml;base64,... URIs — Resend flagged
 * this explicitly ("Imágenes de host en el dominio de envío"): mail clients,
 * Gmail especially, treat inline/off-domain image sources as a phishing
 * signal, since spam evades image-scanning that way. Actual files served
 * from the sending app's own domain read as legitimate.
 *
 * The .svg files themselves live in public/mail-assets/ — generated once
 * from the original base64 strings, not hand-authored (see git history if
 * they ever need regenerating from scratch).
 *
 * Bound to every `emails.*` view via a View::composer in AppServiceProvider —
 * NOT via the layout's own @php block. Blade's @extends evaluates a child
 * template's @section content before the parent layout ever runs, so
 * variables the parent defines in its own @php block are invisible inside
 * the child's sections. A composer shares data before rendering starts,
 * which works for parent and child alike.
 */
class MailIcons
{
    public static function all(): array
    {
        return [
            'LOGO'              => asset('mail-assets/logo.svg'),
            'ICON_CHECK'        => asset('mail-assets/icon-check.svg'),
            'ICON_CHECK_CIRCLE' => asset('mail-assets/icon-check-circle.svg'),
            'ICON_RECEIPT'      => asset('mail-assets/icon-receipt.svg'),
            'ICON_ALERT'        => asset('mail-assets/icon-alert.svg'),
            'ICON_CLOCK'        => asset('mail-assets/icon-clock.svg'),
            'ICON_CLOCK_URGENT' => asset('mail-assets/icon-clock-urgent.svg'),
            'ICON_SHIELD'       => asset('mail-assets/icon-shield.svg'),
            'ICON_HEADSET'      => asset('mail-assets/icon-headset.svg'),
            'ICON_USER_CHECK'   => asset('mail-assets/icon-user-check.svg'),
            'ICON_GIFT'         => asset('mail-assets/icon-gift.svg'),
            'ICON_DUMBBELL'     => asset('mail-assets/icon-dumbbell.svg'),
            'ICON_INFO'         => asset('mail-assets/icon-info.svg'),
        ];
    }
}
