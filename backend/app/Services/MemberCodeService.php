<?php

namespace App\Services;

use App\Models\Gym;
use App\Models\Member;
use Illuminate\Support\Facades\DB;

/**
 * Assigns each member a gym-specific code (e.g. "ABC-0001") and a random QR
 * token. The prefix comes from the gym's 3-letter abbreviation (see
 * Gym::generateUniqueCode) so codes from different gyms are never confused
 * with each other, even when displayed side by side (e.g. in SuperAdmin).
 */
class MemberCodeService
{
    /** Resolves the current gym's code, generating and persisting one if it's still missing. */
    public static function gymPrefix(): string
    {
        $gymId = auth()->user()?->gym_id;
        $gym   = $gymId ? Gym::find($gymId) : null;

        if (!$gym) {
            return 'GYM';
        }

        if (!$gym->code) {
            $gym->code = Gym::generateUniqueCode($gym->name, $gym->id);
            $gym->save();
        }

        return $gym->code;
    }

    /** Next sequential code for the given prefix, scoped to the current gym's members. */
    public static function next(string $prefix): string
    {
        try {
            return DB::transaction(function () use ($prefix) {
                $last = Member::whereNotNull('member_code')
                    ->where('member_code', 'like', $prefix . '-%')
                    ->orderByDesc('id')
                    ->lockForUpdate()
                    ->value('member_code');

                $n = 1;
                if ($last && preg_match('/-(\d+)$/', $last, $m)) {
                    $n = (int) $m[1] + 1;
                }

                return $prefix . '-' . str_pad($n, 4, '0', STR_PAD_LEFT);
            });
        } catch (\Throwable $e) {
            return $prefix . '-' . str_pad(random_int(1, 9999), 4, '0', STR_PAD_LEFT);
        }
    }

    public static function qrToken(): string
    {
        return bin2hex(random_bytes(16));
    }
}
