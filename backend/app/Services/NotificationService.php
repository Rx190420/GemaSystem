<?php

namespace App\Services;

use App\Models\Gym;
use App\Models\GymNotification;
use App\Models\Member;
use App\Services\WhatsAppService;

class NotificationService
{
    public static function create(int $gymId, string $type, string $title, string $body, array $data = []): void
    {
        try {
            GymNotification::create([
                'gym_id' => $gymId,
                'type'   => $type,
                'title'  => $title,
                'body'   => $body,
                'data'   => $data ?: null,
            ]);
        } catch (\Throwable $e) {
            \Log::warning("NotificationService::create failed [{$type}]: " . $e->getMessage());
        }
    }

    public static function memberRegistered(Member $member, int $gymId): void
    {
        self::create(
            $gymId,
            'member_registered',
            'Nuevo socio registrado',
            "{$member->first_name} {$member->last_name} se registró como nuevo socio.",
            [
                'member_id'   => $member->id,
                'member_name' => "{$member->first_name} {$member->last_name}",
                'member_code' => $member->member_code,
            ]
        );

        if ($member->phone) {
            $gymName = Gym::find($gymId)?->name;
            WhatsAppService::memberWelcome(
                $member->phone,
                $member->first_name,
                $member->member_code,
                $gymName,
                $member->membership_end?->format('d/m/Y'),
                $member->qr_token,
                $gymId
            );
        }
    }

    public static function paymentReceived(int $gymId, ?int $memberId, ?string $memberName, float $amount, string $concept): void
    {
        $formatted = '$' . number_format($amount, 2);
        $body = $memberName
            ? "{$memberName} realizó un pago de {$formatted} por {$concept}."
            : "Se registró un pago de {$formatted} — {$concept}.";

        self::create(
            $gymId,
            'payment_received',
            "Pago registrado — {$formatted}",
            $body,
            [
                'member_id'   => $memberId,
                'member_name' => $memberName,
                'amount'      => $amount,
                'concept'     => $concept,
            ]
        );
    }

    public static function visitMilestone(Member $member, int $gymId, int $totalVisits): void
    {
        self::create(
            $gymId,
            'visit_milestone',
            "¡Hito desbloqueado — {$totalVisits} visitas!",
            "{$member->first_name} {$member->last_name} alcanzó {$totalVisits} visitas al gimnasio.",
            [
                'member_id'   => $member->id,
                'member_name' => "{$member->first_name} {$member->last_name}",
                'visit_count' => $totalVisits,
            ]
        );
    }

    public static function membershipExpiring(int $gymId, int $memberId, string $memberName, string $endDate, int $daysLeft): void
    {
        $formatted = \Carbon\Carbon::parse($endDate)->format('d/m/Y');
        self::create(
            $gymId,
            'membership_expiring',
            "Membresía próxima a vencer",
            "{$memberName} tiene una membresía que vence el {$formatted} (en {$daysLeft} días).",
            [
                'member_id'   => $memberId,
                'member_name' => $memberName,
                'end_date'    => $endDate,
                'days_left'   => $daysLeft,
            ]
        );

        $member = Member::find($memberId);
        if ($member?->phone) {
            $gymName = Gym::find($gymId)?->name;
            WhatsAppService::membershipReminder($member->phone, $member->first_name, $member->member_code, $daysLeft, $formatted, $gymName, $gymId);
        }
    }

    public static function membershipExpired(int $gymId, int $memberId, string $memberName, string $endDate): void
    {
        $formatted = \Carbon\Carbon::parse($endDate)->format('d/m/Y');
        self::create(
            $gymId,
            'membership_expired',
            "Membresía vencida",
            "La membresía de {$memberName} venció el {$formatted}.",
            [
                'member_id'   => $memberId,
                'member_name' => $memberName,
                'end_date'    => $endDate,
            ]
        );

        $member = Member::find($memberId);
        if ($member?->phone) {
            $gymName = Gym::find($gymId)?->name;
            WhatsAppService::membershipReminder($member->phone, $member->first_name, $member->member_code, 0, $formatted, $gymName, $gymId);
        }
    }

    /** Human labels for Gym::GATED_FEATURES — shared by every place that needs to show one. */
    public const FEATURE_LABELS = [
        'whatsapp' => 'WhatsApp', 'products' => 'Productos', 'classes' => 'Clases',
        'import'   => 'Importar datos', 'export' => 'Exportar reportes',
    ];

    /**
     * An operator manually granted an extra for free (SuperAdminController::
     * updateExtras) — a case handled outside normal billing (support call,
     * goodwill, etc.), so this one's wording is explicit about not being
     * charged. The gym's own self-service purchase uses extraPurchased()
     * below instead, which IS a real Stripe charge.
     */
    public static function extraGranted(int $gymId, string $featureKey): void
    {
        $label = self::FEATURE_LABELS[$featureKey] ?? $featureKey;
        self::create(
            $gymId,
            'plan_changed',
            'Nuevo extra activado',
            "Se activó el extra \"{$label}\" en tu cuenta, sin costo. "
                . 'Este extra no se cobra automáticamente cada mes — para conservarlo tendrás que pagarlo manualmente. '
                . 'Si no ves el cambio reflejado, cierra sesión y vuelve a entrar.',
            ['feature' => $featureKey, 'manual_billing' => true]
        );
    }

    /**
     * The gym owner just paid (one-time, self-service) for an individual
     * extra — StripeController::fulfillExtraPurchase. Unlike a plan itself,
     * this purchase isn't a recurring Stripe line item: it's only valid
     * through the CURRENT subscription. plan_features gets fully overwritten
     * every time fulfill()/fulfillPlanChange() run (a fresh subscription or
     * a plan change), so a lapsed-then-renewed subscription naturally loses
     * every previously-purchased extra — this notification is also the
     * documented place that tells the gym that's expected, not a bug.
     */
    /**
     * @param string[] $featureKeys One or more extras bought together in a
     *   single checkout (Profile.jsx lets the gym select several before
     *   paying once) — $totalPrice is their combined price, not per-item.
     */
    public static function extraPurchased(int $gymId, array $featureKeys, int $totalPrice): void
    {
        $labels    = array_map(fn ($k) => self::FEATURE_LABELS[$k] ?? $k, $featureKeys);
        $labelList = count($labels) === 1 ? "\"{$labels[0]}\"" : implode(', ', array_map(fn ($l) => "\"{$l}\"", $labels));
        $title     = count($labels) === 1 ? 'Extra comprado' : 'Extras comprados';

        self::create(
            $gymId,
            'plan_changed',
            $title,
            "Compraste {$labelList} por \${$totalPrice} MXN. Quedan activos mientras dure tu suscripción actual — "
                . 'si tu suscripción termina y compras una nueva, estos extras no se conservan y tendrás que volver a comprarlos. '
                . 'Si no ves el cambio reflejado, cierra sesión y vuelve a entrar.',
            ['features' => $featureKeys, 'total_price' => $totalPrice, 'tied_to_current_subscription' => true]
        );
    }
}
