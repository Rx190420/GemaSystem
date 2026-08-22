<?php

namespace App\Http\Middleware;

use Illuminate\Http\Middleware\TrustProxies as Middleware;
use Illuminate\Http\Request;

class TrustProxies extends Middleware
{
    /**
     * The trusted proxies for this application.
     *
     * Was left unset (null = trust none), so Laravel ignored every
     * X-Forwarded-* header Railway's edge proxy sends and built URLs
     * (url()/asset(), used for the QR/logo/icon images embedded in emails)
     * from the raw internal connection instead — an address unreachable
     * from outside Railway's network, which is why those images loaded fine
     * in the "before" version (a hardcoded absolute https://api.qrserver.com
     * URL, immune to this) but broke once they became url()/asset() calls.
     *
     * '*' is the standard, safe setting for platforms like Railway/Heroku/
     * Render: the app container is never reachable directly from the
     * internet, only through the platform's own edge proxy, so there's no
     * untrusted network path for a spoofed X-Forwarded-* header to arrive
     * through.
     *
     * @var array<int, string>|string|null
     */
    protected $proxies = '*';

    /**
     * The headers that should be used to detect proxies.
     *
     * @var int
     */
    protected $headers =
        Request::HEADER_X_FORWARDED_FOR |
        Request::HEADER_X_FORWARDED_HOST |
        Request::HEADER_X_FORWARDED_PORT |
        Request::HEADER_X_FORWARDED_PROTO |
        Request::HEADER_X_FORWARDED_AWS_ELB;
}
