<?php

namespace App\Providers;

use App\Mail\Transport\ResendTransport;
use App\Support\MailIcons;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Facades\View;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;
use Laravel\Sanctum\Sanctum;

class AppServiceProvider extends ServiceProvider
{
    public function register()
    {
        // The 'personal_access_tokens' table already exists — created by our
        // own SQL import (gemasystem_supabase.sql / gemasystem_tenant_pgsql.sql),
        // not by Sanctum's bundled migration. This MUST live in register(),
        // not boot(): Laravel runs register() for every provider before
        // boot() runs for any of them, and Sanctum's own provider registers
        // its migration during ITS boot() — which fires before our
        // AppServiceProvider's boot() does (packages boot first). Calling
        // ignoreMigrations() from boot() was too late; Sanctum had already
        // queued the migration by then, so `php artisan migrate` kept trying
        // to CREATE TABLE a table that's already there and crashing the
        // deploy with "already exists".
        Sanctum::ignoreMigrations();
    }

    public function boot()
    {
        // Resend over their HTTP API instead of raw SMTP — Railway blocks
        // outbound SMTP entirely (every port), but HTTPS is never blocked.
        // See app/Mail/Transport/ResendTransport.php for the why/how.
        Mail::extend('resend', function (array $config) {
            return new ResendTransport($config['key']);
        });

        // Force HTTPS in production
        if ($this->app->environment('production')) {
            URL::forceScheme('https');
        }

        // Global default password rules
        Password::defaults(function () {
            return Password::min(8)
                ->mixedCase()
                ->numbers()
                ->uncompromised();
        });

        // Share the logo + icon set with every email view (layout AND the
        // child templates that @extend it). A plain @php block in the layout
        // isn't enough here: Blade renders a child's @section content before
        // the parent layout ever runs, so variables the parent defines in its
        // own @php block are out of scope inside the child's sections. A
        // composer shares data before rendering starts, so it works in both.
        View::composer('emails.*', function ($view) {
            $view->with(MailIcons::all());
        });
    }
}
