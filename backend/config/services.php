<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'mailgun' => [
        'domain' => env('MAILGUN_DOMAIN'),
        'secret' => env('MAILGUN_SECRET'),
        'endpoint' => env('MAILGUN_ENDPOINT', 'api.mailgun.net'),
    ],

    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'whatsapp' => [
        'enabled'    => env('WHATSAPP_ENABLED', false),
        'bot_url'    => env('WHATSAPP_BOT_URL', 'http://127.0.0.1:3001'),
        'bot_secret' => env('WHATSAPP_BOT_SECRET', ''),
    ],

    'stripe' => [
        'key'            => env('STRIPE_PUBLISHABLE_KEY'),
        'secret'         => env('STRIPE_SECRET_KEY'),
        'webhook_secret' => env('STRIPE_WEBHOOK_SECRET'),
        'price_weekly'   => env('STRIPE_PRICE_WEEKLY'),
        'price_monthly'  => env('STRIPE_PRICE_MONTHLY'),
        'price_annual'   => env('STRIPE_PRICE_ANNUAL'),
    ],

    'superadmin' => [
        // Second factor beyond auth:sanctum + operator PIN, required only for
        // the "delete this gym permanently" action — SuperAdminController::deleteGym().
        'delete_secret' => env('SUPERADMIN_DELETE_SECRET'),
    ],

    'recaptcha' => [
        'secret_key' => env('RECAPTCHA_SECRET_KEY'),
    ],

];
