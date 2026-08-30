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
        $files = [
            'LOGO'              => 'logo.png',
            'ICON_CHECK'        => 'icon-check.png',
            'ICON_CHECK_CIRCLE' => 'icon-check-circle.png',
            'ICON_RECEIPT'      => 'icon-receipt.png',
            'ICON_ALERT'        => 'icon-alert.png',
            'ICON_CLOCK'        => 'icon-clock.png',
            'ICON_CLOCK_URGENT' => 'icon-clock-urgent.png',
            'ICON_SHIELD'       => 'icon-shield.png',
            'ICON_HEADSET'      => 'icon-headset.png',
            'ICON_USER_CHECK'   => 'icon-user-check.png',
            'ICON_GIFT'         => 'icon-gift.png',
            'ICON_DUMBBELL'     => 'icon-dumbbell.png',
            'ICON_INFO'         => 'icon-info.png',
        ];

        return array_map(fn (string $file) => self::url($file), $files);
    }

    /**
     * Builds a cache-busted URL for a mail-asset file: {url}?v={mtime}.
     *
     * Without this, fixing a broken icon (like the squished logo — see git
     * history) doesn't actually fix anything for anyone who already opened
     * an older email or a preview pointing at the same URL: Gmail's image
     * proxy and browsers both cache images by URL, indefinitely by default
     * since this route sends no Cache-Control. Same URL in every email ever
     * sent means the very first cached copy wins forever, even after the
     * file on disk changes. Appending the file's mtime makes the URL itself
     * change whenever the file does, so there's nothing stale to serve.
     *
     * Tried a data: URI fallback here for local testing (APP_URL=localhost
     * is unreachable from Gmail's servers) — reverted it. Confirmed against
     * a real send: Gmail strips data: image sources from received HTML mail
     * regardless of size, same as it would a <script> tag. It isn't a
     * reachability problem inline base64 can sidestep; every mail client
     * has to actually support the scheme, and Gmail's inbox renderer
     * doesn't. See email-previews/ for a way to check the design locally
     * that doesn't route through a real inbox.
     */
    private static function url(string $file): string
    {
        $path = public_path("mail-assets/{$file}");
        $version = is_file($path) ? filemtime($path) : time();

        return asset("mail-assets/{$file}") . '?v=' . $version;
    }
}
