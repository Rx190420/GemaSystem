<?php

namespace App\Services;

use App\Models\WhatsAppLog;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class WhatsAppService
{
    public static function enabled(): bool
    {
        return config('services.whatsapp.enabled', false)
            && !empty(config('services.whatsapp.bot_url'));
    }

    public static function send(string $phone, string $message, ?int $gymId = null, ?array $logData = null): bool
    {
        if (!self::enabled()) return false;

        $to = self::normalizePhone($phone);
        if (!$to) return false;

        return self::callBot('/send', ['phone' => $to, 'message' => $message], $gymId, $logData);
    }

    // ── Internal HTTP caller ──────────────────────────────────────────────────

    private static function callBot(string $endpoint, array $payload, ?int $gymId = null, ?array $logData = null): bool
    {
        // All bot send endpoints are session-scoped; skip if no gym context
        if (!$gymId) return false;

        $botUrl = rtrim(config('services.whatsapp.bot_url'), '/');
        $secret = config('services.whatsapp.bot_secret', '');

        $url = "{$botUrl}/sessions/gym_{$gymId}{$endpoint}";

        try {
            $request = Http::timeout(15);
            if ($secret) {
                $request = $request->withHeaders(['x-api-key' => $secret]);
            }

            $response = $request->post($url, $payload);

            if ($response->failed()) {
                Log::warning("WhatsApp{$endpoint} [gym={$gymId}] failed [{$payload['phone']}]: " . $response->body());
                return false;
            }

            if ($logData !== null) {
                try {
                    WhatsAppLog::create([
                        'gym_id'          => $gymId,
                        'recipient_phone' => $payload['phone'] ?? '',
                        'recipient_name'  => $logData['name'] ?? null,
                        'message_type'    => $logData['type'] ?? 'Mensaje',
                        'message_preview' => $logData['preview'] ?? substr($payload['message'] ?? $payload['caption'] ?? '', 0, 250),
                    ]);
                } catch (\Throwable) {}
            }

            return true;
        } catch (\Throwable $e) {
            Log::warning("WhatsApp{$endpoint} exception: " . $e->getMessage());
            return false;
        }
    }

    // ── Message builders ──────────────────────────────────────────────────────

    public static function memberWelcome(
        string $phone,
        string $firstName,
        string $memberCode,
        ?string $gymName,
        ?string $endDate,
        ?string $qrToken = null,
        ?int $gymId = null
    ): void {
        if (!self::enabled()) return;

        $to = self::normalizePhone($phone);
        if (!$to) return;

        $gym     = $gymName ? " en *{$gymName}*" : '';
        $exp     = $endDate ? "\n📅 Membresía vigente hasta: *{$endDate}*" : '';
        $caption = "👋 ¡Hola, {$firstName}! Bienvenido{$gym}.\n\n"
            . "Tu membresía ha sido registrada exitosamente.\n\n"
            . "🆔 Número de socio: *{$memberCode}*{$exp}\n\n"
            . "Presenta este código QR en recepción para registrar tu entrada. ¡Mucho éxito! 💪";

        $log = ['type' => 'Bienvenida', 'name' => $firstName, 'preview' => substr($caption, 0, 250)];

        if ($qrToken) {
            self::callBot('/send-qr', [
                'phone'    => $to,
                'qr_value' => $qrToken,
                'caption'  => $caption,
            ], $gymId, $log);
        } else {
            self::callBot('/send', ['phone' => $to, 'message' => $caption], $gymId, $log);
        }
    }

    public static function membershipReminder(
        string $phone,
        string $firstName,
        string $memberCode,
        int $daysLeft,
        string $endDate,
        ?string $gymName,
        ?int $gymId = null
    ): void {
        $gym = $gymName ? " de *{$gymName}*" : '';

        if ($daysLeft === 0) {
            $msg = "⚠️ Hola, *{$firstName}*{$gym}\n\n"
                . "Tu membresía *vence hoy* ({$endDate}).\n\n"
                . "Acércate a recepción para renovarla y seguir entrenando sin interrupciones.\n\n"
                . "Socio: *{$memberCode}*";
        } elseif ($daysLeft <= 7) {
            $dias = $daysLeft === 1 ? '1 día' : "{$daysLeft} días";
            $msg = "⏳ Hola, *{$firstName}*{$gym}\n\n"
                . "Tu membresía vence en *{$dias}* (el {$endDate}).\n\n"
                . "Renuévala en recepción para no perder el acceso.\n\n"
                . "Socio: *{$memberCode}*";
        } else {
            $msg = "📅 Hola, *{$firstName}*{$gym}\n\n"
                . "Tu membresía vence el *{$endDate}* (en {$daysLeft} días).\n\n"
                . "Socio: *{$memberCode}*";
        }

        self::send($phone, $msg, $gymId, ['type' => 'Recordatorio membresía', 'name' => $firstName]);
    }

    public static function birthdayGreeting(
        string $phone,
        string $firstName,
        ?string $gymName,
        ?int $gymId = null
    ): void {
        $gym = $gymName ? " de *{$gymName}*" : '';

        self::send($phone,
            "🎂 ¡Feliz cumpleaños, *{$firstName}*!\n\n"
            . "Todo el equipo{$gym} te desea un día increíble.\n\n"
            . "¡Sigue entrenando fuerte! 💪🎉",
            $gymId,
            ['type' => 'Felicitación cumpleaños', 'name' => $firstName]
        );
    }

    public static function renewalInvitation(
        string $phone,
        string $firstName,
        string $memberCode,
        ?string $endDate,
        ?string $gymName,
        ?int $gymId = null
    ): void {
        $gym = $gymName ? " en *{$gymName}*" : '';
        $exp = $endDate ? "\n📅 Tu membresía actual vence el *{$endDate}*." : '';

        self::send($phone,
            "🏋️ Hola, *{$firstName}*!\n\n"
            . "Te invitamos a renovar tu membresía{$gym} y seguir alcanzando tus metas.{$exp}\n\n"
            . "Acércate a recepción o habla con nosotros para renovar.\n\n"
            . "Socio: *{$memberCode}* 💪",
            $gymId,
            ['type' => 'Invitación a renovar', 'name' => $firstName]
        );
    }

    public static function userWelcome(string $phone, string $gymName, string $contactName, string $username): void
    {
        self::send($phone,
            "🎉 ¡Hola, *{$contactName}*!\n\n"
            . "Tu cuenta en *GemaSystem* para *{$gymName}* ha sido activada.\n\n"
            . "Usuario: *{$username}*\n\n"
            . "Revisa tu correo para obtener tu contraseña temporal e iniciar sesión.\n\n"
            . "_GemaSystem_",
            null,
            ['type' => 'Bienvenida plataforma', 'name' => $contactName]
        );
    }

    public static function trialApproved(string $phone, string $gymName, string $contactName, string $username): void
    {
        self::send($phone,
            "✅ ¡Hola, *{$contactName}*!\n\n"
            . "Tu solicitud para *{$gymName}* fue *aprobada*.\n\n"
            . "Usuario: *{$username}*\n\n"
            . "Revisa tu correo para obtener tu contraseña e iniciar sesión en GemaSystem.\n\n"
            . "_GemaSystem_",
            null,
            ['type' => 'Solicitud aprobada', 'name' => $contactName]
        );
    }

    public static function trialRejected(string $phone, string $gymName, string $contactName, ?string $reason): void
    {
        $reasonLine = $reason ? "\nMotivo: {$reason}\n" : '';

        self::send($phone,
            "ℹ️ Hola, *{$contactName}*.\n\n"
            . "Tu solicitud para *{$gymName}* no pudo ser aprobada en este momento.{$reasonLine}\n"
            . "Para más información, comunícate con soporte de GemaSystem.\n\n"
            . "_GemaSystem_",
            null,
            ['type' => 'Solicitud rechazada', 'name' => $contactName]
        );
    }

    public static function invoiceReceipt(string $phone, string $gymName, string $planLabel, string $amount, string $currency, string $periodEnd, ?int $gymId = null): void
    {
        self::send($phone,
            "✅ *Pago recibido*\n\n"
            . "Gimnasio: *{$gymName}*\n"
            . "Plan: *{$planLabel}*\n"
            . "Monto: *{$amount} {$currency}*\n"
            . "Vigente hasta: *{$periodEnd}*\n\n"
            . "Gracias por tu pago. ¡Sigue adelante! 💪\n\n"
            . "_GemaSystem_",
            $gymId,
            ['type' => 'Recibo de pago']
        );
    }

    public static function paymentFailed(string $phone, string $gymName, string $planLabel, string $amount, string $currency, int $daysRemaining, ?int $gymId = null): void
    {
        $accessLine = $daysRemaining > 0
            ? "Tu acceso sigue activo por *{$daysRemaining} " . ($daysRemaining === 1 ? 'día' : 'días') . "* más."
            : "Tu acceso podría verse interrumpido pronto.";

        self::send($phone,
            "⚠️ *No se pudo procesar tu pago*\n\n"
            . "Gimnasio: *{$gymName}*\n"
            . "Plan: *{$planLabel}* — {$amount} {$currency}\n\n"
            . "{$accessLine}\n\n"
            . "Actualiza tu método de pago para evitar interrupciones.\n\n"
            . "_GemaSystem_",
            $gymId,
            ['type' => 'Pago fallido']
        );
    }

    // ── Phone normalizer ──────────────────────────────────────────────────────

    private static function normalizePhone(string $phone): ?string
    {
        $clean = preg_replace('/[^\d+]/', '', $phone);

        if (str_starts_with($clean, '+') && strlen($clean) >= 10) return $clean;
        if (preg_match('/^\d{10}$/', $clean))  return '+52' . $clean;
        if (preg_match('/^52\d{10}$/', $clean)) return '+' . $clean;
        if (strlen($clean) >= 7) return '+' . $clean;

        return null;
    }
}
