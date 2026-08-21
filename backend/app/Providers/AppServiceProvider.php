<?php

namespace App\Providers;

use App\Support\MailIcons;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Facades\View;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;
use Laravel\Sanctum\Sanctum;

class AppServiceProvider extends ServiceProvider
{
    public function register()
    {
        //
    }

    public function boot()
    {
        // The 'personal_access_tokens' table already exists — created by our
        // own SQL import (gemasystem_supabase.sql / gemasystem_tenant_pgsql.sql),
        // not by Sanctum's bundled migration. Without this, Sanctum still
        // registers its own copy of that migration on every app boot, and
        // Railway's deploy-time `php artisan migrate` tries to CREATE TABLE a
        // table that's already there, crashing the deploy with "already exists".
        Sanctum::ignoreMigrations();

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
