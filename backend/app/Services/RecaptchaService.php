<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class RecaptchaService
{
    private const VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';

    /**
     * Verify a reCAPTCHA v2 token with Google. Returns false on any failure —
     * missing token, missing secret key, network error, or a rejected token —
     * so callers can safely treat "not verified" as "reject the request."
     */
    public static function verify(?string $token, ?string $remoteIp = null): bool
    {
        if (empty($token)) {
            return false;
        }

        $secret = config('services.recaptcha.secret_key');
        if (empty($secret)) {
            Log::error('RecaptchaService: RECAPTCHA_SECRET_KEY no está configurada — rechazando por seguridad.');
            return false;
        }

        try {
            $response = Http::asForm()->post(self::VERIFY_URL, [
                'secret'   => $secret,
                'response' => $token,
                'remoteip' => $remoteIp,
            ]);

            $result = $response->json();

            if (! ($result['success'] ?? false)) {
                Log::info('RecaptchaService: verificación rechazada — ' . json_encode($result['error-codes'] ?? []));
                return false;
            }

            return true;
        } catch (\Throwable $e) {
            Log::error('RecaptchaService: error al contactar a Google — ' . $e->getMessage());
            return false;
        }
    }
}
