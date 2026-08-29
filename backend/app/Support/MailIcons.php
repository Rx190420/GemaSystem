<?php

namespace App\Support;

/**
 * Icons shared by every email template (resources/views/emails), served as
 * real hosted files at {APP_URL}/mail-assets/*.png instead of inline base64
 * data-URIs.
 *
 * Previously these were data:image/svg+xml;base64,... URIs — Resend flagged
 * this explicitly ("Imágenes de host en el dominio de envío"): mail clients,
 * Gmail especially, treat inline/off-domain image sources as a phishing
 * signal, since spam evades image-scanning that way. Actual files served
 * from the sending app's own domain read as legitimate.
 *
 * They were then real hosted .svg files, which fixed that — but Gmail (web,
 * Android, iOS) doesn't render SVG at all in an <img src>, regardless of
 * where it's hosted; the icon-badge and the nav logo just came out blank.
 * Re-exported as PNG (96×96, upscaled from the same paths so they still
 * look sharp at the 12-26px display sizes the templates use) fixes that —
 * every mail client rasterizes plain PNG fine. Source .svg files still live
 * in public/mail-assets/ in case they ever need re-exporting.
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
            'LOGO'              => asset('mail-assets/logo.png'),
            'ICON_CHECK'        => asset('mail-assets/icon-check.png'),
            'ICON_CHECK_CIRCLE' => asset('mail-assets/icon-check-circle.png'),
            'ICON_RECEIPT'      => asset('mail-assets/icon-receipt.png'),
            'ICON_ALERT'        => asset('mail-assets/icon-alert.png'),
            'ICON_CLOCK'        => asset('mail-assets/icon-clock.png'),
            'ICON_CLOCK_URGENT' => asset('mail-assets/icon-clock-urgent.png'),
            'ICON_SHIELD'       => asset('mail-assets/icon-shield.png'),
            'ICON_HEADSET'      => asset('mail-assets/icon-headset.png'),
            'ICON_USER_CHECK'   => asset('mail-assets/icon-user-check.png'),
            'ICON_GIFT'         => asset('mail-assets/icon-gift.png'),
            'ICON_DUMBBELL'     => asset('mail-assets/icon-dumbbell.png'),
            'ICON_INFO'         => asset('mail-assets/icon-info.png'),
        ];
    }
}
