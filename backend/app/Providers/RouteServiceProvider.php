<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Foundation\Support\Providers\RouteServiceProvider as ServiceProvider;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Route;

class RouteServiceProvider extends ServiceProvider
{
    public const HOME = '/home';

    public function boot()
    {
        $this->configureRateLimiting();

        // Route-model-bound numeric IDs (e.g. GET /products/{product}) hit the
        // DB with whatever string arrives in the URL before Eloquent ever gets
        // a chance to say "not found". On Postgres, a non-numeric value like
        // /products/undefined blows up as an uncaught QueryException — SQLSTATE
        // 22P02 "invalid input syntax for type bigint" — which surfaces as a
        // raw 500 (stack trace and SQL included, with APP_DEBUG on) instead of
        // a clean 404. Constraining these to digits-only makes the router
        // reject non-numeric values itself, before any query runs.
        foreach (['product', 'member', 'gym', 'user', 'submission', 'ticket', 'gymNotification', 'trial'] as $param) {
            Route::pattern($param, '[0-9]+');
        }

        $this->routes(function () {
            Route::prefix('api')
                ->middleware('api')
                ->namespace($this->namespace)
                ->group(base_path('routes/api.php'));

            Route::middleware('web')
                ->namespace($this->namespace)
                ->group(base_path('routes/web.php'));
        });
    }

    protected function configureRateLimiting()
    {
        // ── Global API baseline ────────────────────────────────────────────────
        // Applied to every route via Kernel's 'api' middleware group.
        // Keyed per authenticated user (not per IP) so multiple devices
        // belonging to the same gym don't share a bucket.
        RateLimiter::for('api', function (Request $request) {
            $user = optional($request->user());
            return [
                // Per-user bucket: 60 req/min
                Limit::perMinute(60)->by('u:' . ($user->id ?: $request->ip())),
                // Per-IP hard ceiling: 300 req/min — absorbs legitimate
                // multi-tab use but blocks simple flooding bots
                Limit::perMinute(300)->by('ip:' . $request->ip()),
            ];
        });

        // ── WhatsApp bot initialization ───────────────────────────────────────
        // Spinning up a Puppeteer/Chromium session is expensive. Keyed by
        // gym_id so a rate-limited user can't bypass by rotating accounts
        // within the same gym.
        RateLimiter::for('whatsapp-init', function (Request $request) {
            $gymId = optional($request->user())->gym_id ?? $request->ip();
            return Limit::perMinutes(5, 3)
                ->by('wa-init:' . $gymId)
                ->response(fn () => response()->json([
                    'message' => 'Demasiados intentos de conexión. Espera unos minutos antes de volver a intentar.',
                ], 429));
        });

        // ── WhatsApp / e-mail member notifications ────────────────────────────
        // Prevents a single user from spamming members with mass messages.
        RateLimiter::for('wa-notify', function (Request $request) {
            return Limit::perMinute(20)
                ->by('wa-notify:' . (optional($request->user())->id ?? $request->ip()));
        });

        // ── Bulk data import ──────────────────────────────────────────────────
        // The /import endpoint parses & validates large CSV payloads in memory.
        // 2 actual imports per 10 minutes per user is plenty.
        RateLimiter::for('import', function (Request $request) {
            return Limit::perMinutes(10, 2)
                ->by('import:' . (optional($request->user())->id ?? $request->ip()))
                ->response(fn () => response()->json([
                    'message' => 'Importación en progreso o límite alcanzado. Espera 10 minutos.',
                ], 429));
        });

        // ── QR member scan (POS / reception desk) ────────────────────────────
        // Staff may scan members rapidly at peak hours. Key by IP so a shared
        // reception tablet isn't blocked by per-user limits.
        RateLimiter::for('scan-qr', function (Request $request) {
            return Limit::perMinute(120)->by('scan-qr:' . $request->ip());
        });

        // ── Authenticated password-change code ────────────────────────────────
        // Sends a one-time code by email; limit prevents email flooding.
        RateLimiter::for('password-change', function (Request $request) {
            return Limit::perMinutes(15, 3)
                ->by('pwd-change:' . (optional($request->user())->id ?? $request->ip()));
        });

        // ── Operator (super-admin) console ─────────────────────────────────
        // Already protected by operator PIN; keep a moderate limit to prevent
        // brute-force enumeration via operator endpoints.
        RateLimiter::for('operator', function (Request $request) {
            return Limit::perMinute(30)
                ->by('operator:' . (optional($request->user())->id ?? $request->ip()));
        });
    }
}
