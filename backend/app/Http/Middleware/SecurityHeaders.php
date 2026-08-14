<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class SecurityHeaders
{
    public function handle(Request $request, Closure $next)
    {
        $response = $next($request);

        // ── Clickjacking protection ───────────────────────────────────────────
        $response->headers->set('X-Frame-Options', 'DENY');

        // ── MIME-type sniffing prevention ─────────────────────────────────────
        $response->headers->set('X-Content-Type-Options', 'nosniff');

        // ── XSS protection (legacy browsers) ─────────────────────────────────
        $response->headers->set('X-XSS-Protection', '1; mode=block');

        // ── Referrer policy ───────────────────────────────────────────────────
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');

        // ── Permissions policy — disable unused browser features ──────────────
        $response->headers->set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');

        // ── Content-Security-Policy for API responses ─────────────────────────
        // This is a pure JSON API — forbid all resource loading, framing, etc.
        $response->headers->set('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");

        // ── HSTS — enforce HTTPS in production ───────────────────────────────
        if (app()->environment('production')) {
            $response->headers->set(
                'Strict-Transport-Security',
                'max-age=31536000; includeSubDomains; preload'
            );
        }

        // ── Remove server fingerprint headers ─────────────────────────────────
        $response->headers->remove('X-Powered-By');
        $response->headers->remove('Server');

        return $response;
    }
}
