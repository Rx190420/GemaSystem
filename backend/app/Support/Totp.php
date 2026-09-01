<?php

namespace App\Support;

/**
 * TOTP (RFC 6238, on top of the HOTP counter from RFC 4226) — the same
 * algorithm Google Authenticator, Authy, 1Password, etc. all speak. No
 * external package: this is ~40 lines of straight HMAC-SHA1 + base32, and
 * pulling in a Composer dependency isn't worth it just to avoid that.
 *
 * Replaces the old static OPERATOR_PIN env var for the operator console's
 * second login factor — a fixed PIN sitting in Railway's env vars forever is
 * exactly one leak away from being useless; a 6-digit code that rotates
 * every 30s and is only ever derived from a secret nobody types or sends
 * over the wire is the standard fix.
 */
class Totp
{
    private const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    private const PERIOD   = 30;
    private const DIGITS   = 6;

    /** Random base32 secret (160 bits / 32 chars) — enough entropy for real security margin. */
    public static function generateSecret(int $bytes = 20): string
    {
        return self::base32Encode(random_bytes($bytes));
    }

    /**
     * otpauth:// URI an authenticator app can import (via QR or, easier here
     * since this is a terminal setup step, typed manually as the "setup key").
     */
    public static function provisioningUri(string $secret, string $label, string $issuer): string
    {
        $params = http_build_query([
            'secret'    => $secret,
            'issuer'    => $issuer,
            'algorithm' => 'SHA1',
            'digits'    => self::DIGITS,
            'period'    => self::PERIOD,
        ]);

        return 'otpauth://totp/' . rawurlencode("{$issuer}:{$label}") . '?' . $params;
    }

    /** The 6-digit code valid for the given (or current) 30s time step. */
    public static function generateCode(string $secret, ?int $timestamp = null): string
    {
        $timestamp = $timestamp ?? time();
        $counter   = intdiv($timestamp, self::PERIOD);
        $key       = self::base32Decode($secret);

        // 8-byte big-endian counter, as RFC 4226 §5.2 requires.
        $binCounter = pack('N', 0) . pack('N', $counter);
        $hash       = hash_hmac('sha1', $binCounter, $key, true);

        // Dynamic truncation (RFC 4226 §5.3).
        $offset = ord($hash[19]) & 0x0f;
        $binary = ((ord($hash[$offset]) & 0x7f) << 24)
            | ((ord($hash[$offset + 1]) & 0xff) << 16)
            | ((ord($hash[$offset + 2]) & 0xff) << 8)
            | (ord($hash[$offset + 3]) & 0xff);

        $code = $binary % (10 ** self::DIGITS);

        return str_pad((string) $code, self::DIGITS, '0', STR_PAD_LEFT);
    }

    /**
     * Checks a submitted code against the current time step and one step
     * either side (±30s) — a small clock-drift/typing-delay allowance,
     * standard practice for TOTP verification.
     */
    public static function verify(string $secret, string $code, int $window = 1): bool
    {
        $code = trim($code);
        if (!preg_match('/^\d{6}$/', $code) || $secret === '') {
            return false;
        }

        $now = time();
        for ($i = -$window; $i <= $window; $i++) {
            if (hash_equals(self::generateCode($secret, $now + ($i * self::PERIOD)), $code)) {
                return true;
            }
        }

        return false;
    }

    private static function base32Encode(string $data): string
    {
        $bits = '';
        foreach (str_split($data) as $byte) {
            $bits .= str_pad(decbin(ord($byte)), 8, '0', STR_PAD_LEFT);
        }

        $output = '';
        foreach (str_split($bits, 5) as $chunk) {
            $chunk   = str_pad($chunk, 5, '0', STR_PAD_RIGHT);
            $output .= self::ALPHABET[bindec($chunk)];
        }

        return $output;
    }

    private static function base32Decode(string $secret): string
    {
        $secret = strtoupper(preg_replace('/[^A-Za-z2-7]/', '', $secret));

        $bits = '';
        foreach (str_split($secret) as $char) {
            $pos = strpos(self::ALPHABET, $char);
            if ($pos === false) {
                continue;
            }
            $bits .= str_pad(decbin($pos), 5, '0', STR_PAD_LEFT);
        }

        $bytes = '';
        foreach (str_split($bits, 8) as $byte) {
            if (strlen($byte) === 8) {
                $bytes .= chr(bindec($byte));
            }
        }

        return $bytes;
    }
}
