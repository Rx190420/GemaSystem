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
}
