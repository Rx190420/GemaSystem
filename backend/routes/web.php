<?php

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Here is where you can register web routes for your application. These
| routes are loaded by the RouteServiceProvider within a group which
| contains the "web" middleware group. Now create something great!
|
*/

Route::get('/', function () {
    return view('welcome');
});

// ── QR proxy for welcome emails ─────────────────────────────────────────────
// The member_welcome email embeds a QR image. It used to point straight at
// api.qrserver.com — Resend flags that as "images not hosted on your sending
// domain" (a phishing heuristic most mail clients share). This route fetches
// the same QR from that service server-side and re-serves it from our own
// domain, so the recipient's mail client only ever sees a first-party image
// URL; api.qrserver.com becomes an invisible implementation detail. No new
// exposure versus before — the email already put the raw qr_token in a
// public, unauthenticated URL, just at a different host.
Route::get('/mail-assets/qr/{token}', function (string $token) {
    $response = Http::timeout(8)->get('https://api.qrserver.com/v1/create-qr-code/', [
        'size'    => '140x140',
        'data'    => $token,
        'color'   => '09090b',
        'bgcolor' => 'ffffff',
    ]);

    abort_unless($response->successful(), 502, 'No se pudo generar el código QR.');

    return response($response->body())
        ->header('Content-Type', 'image/png')
        ->header('Cache-Control', 'public, max-age=86400'); // same QR every time for a given token
})->where('token', '[a-zA-Z0-9]+');



