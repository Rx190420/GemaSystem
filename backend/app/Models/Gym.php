<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Gym extends Model
{
    protected $fillable = [
        'name', 'code', 'plan', 'plan_type', 'plan_features', 'db_name',
        'stripe_subscription_id', 'stripe_customer_id',
        'status', 'billing_status',
        'subscription_starts_at', 'subscription_ends_at', 'last_payment_at',
    ];

    protected $casts = [
        'plan_features'           => 'array',
        'subscription_starts_at'  => 'datetime',
        'subscription_ends_at'    => 'datetime',
        'last_payment_at'         => 'datetime',
    ];

    /** Billing plans that predate per-feature gating — always full access. */
    public const LEGACY_PLANS = ['weekly', 'monthly', 'annual'];

    /** The 5 toggleable extras on the 'custom' plan (also all included on 'full'). */
    public const GATED_FEATURES = ['whatsapp', 'products', 'classes', 'import', 'export'];

    /**
     * Whether this gym's plan includes the given feature key (one of
     * self::GATED_FEATURES).
     *
     * Free/trial gyms (plan_type='free') always get full access — checked by
     * plan_type, not by the 'plan' string, so this can't silently break if a
     * trial ever gets created/approved with a different plan value than
     * today's 'weekly' default. Legacy paid plans (weekly/monthly/annual)
     * and 'full' also always return true, unchanged from how the app has
     * always behaved for them. 'basic' always returns false. 'custom' reads
     * its own toggle state from plan_features. Anything else fails closed
     * (false).
     */
    public function hasFeature(string $key): bool
    {
        if ($this->plan_type === 'free') return true;
        if (in_array($this->plan, self::LEGACY_PLANS, true)) return true;
        if ($this->plan === 'full')  return true;
        if ($this->plan === 'basic') return false;
        if ($this->plan === 'custom') return (bool) (($this->plan_features ?? [])[$key] ?? false);
        return false;
    }

    /** Feature-key => bool map for every gated feature — handed straight to the frontend. */
    public function featureMap(): array
    {
        return array_combine(
            self::GATED_FEATURES,
            array_map(fn ($key) => $this->hasFeature($key), self::GATED_FEATURES)
        );
    }

    /**
     * True when the gym should be blocked from accessing the system.
     * Covers: expired free trials, expired paid subscriptions, payment failures.
     */
    public function isBillingBlocked(): bool
    {
        // Already suspended — always blocked
        if ($this->status === 'suspended') return true;

        // Free trial: blocked when period expired
        if ($this->plan_type === 'free') return $this->isTrialExpired();

        // Paid: blocked when subscription_ends_at is past (with 2h grace for webhook delays)
        if ($this->isSubscriptionExpired()) return true;

        // Legacy: blocked when billing explicitly marked as failed/cancelled
        if (in_array($this->billing_status, ['payment_failed', 'cancelled', 'payment_due'])) {
            if ($this->subscription_ends_at && $this->subscription_ends_at->isFuture()) return false;
            return true;
        }

        return false;
    }

    /** True when this is a free trial gym whose trial period has passed. */
    public function isTrialExpired(): bool
    {
        if ($this->plan_type !== 'free') return false;
        if (!$this->subscription_ends_at)  return false;
        return $this->subscription_ends_at->isPast();
    }

    /**
     * True when a paid subscription's end date has passed (2h grace period for Stripe webhooks).
     * Only applies to paid gyms.
     */
    public function isSubscriptionExpired(): bool
    {
        if ($this->plan_type !== 'paid')    return false;
        if (!$this->subscription_ends_at)   return false;
        // 2-hour grace period to allow Stripe webhook to update the date before suspending
        return $this->subscription_ends_at->addHours(2)->isPast();
    }

    /** Returns true when this gym has its own dedicated database. */
    public function isPaid(): bool
    {
        return $this->plan_type === 'paid' && !empty($this->db_name);
    }

    public function users()
    {
        return $this->hasMany(User::class);
    }

    public function settings()
    {
        return $this->hasMany(Setting::class);
    }

    /**
     * Builds a 3-letter, uppercase abbreviation from the gym name (first letter of
     * each of the first 3 words, or the first 3 letters if the name is shorter).
     * Missing letters are filled randomly. Collisions against other gyms are
     * resolved by mutating a letter and retrying, so every gym ends up unique.
     */
    public static function generateUniqueCode(string $name, ?int $ignoreId = null): string
    {
        $words = array_values(array_filter(
            preg_split('/[^A-Za-z]+/', $name),
            fn ($w) => $w !== ''
        ));

        if (count($words) >= 3) {
            $base = $words[0][0] . $words[1][0] . $words[2][0];
        } else {
            $base = mb_substr(implode('', $words), 0, 3);
        }

        $base = strtoupper($base);
        while (mb_strlen($base) < 3) {
            $base .= chr(random_int(65, 90));
        }

        $code  = $base;
        $tries = 0;
        while (static::codeTaken($code, $ignoreId) && $tries < 50) {
            $code = mb_substr($base, 0, 2) . chr(random_int(65, 90));
            $tries++;
        }

        while (static::codeTaken($code, $ignoreId)) {
            $code = chr(random_int(65, 90)) . chr(random_int(65, 90)) . chr(random_int(65, 90));
        }

        return $code;
    }

    private static function codeTaken(string $code, ?int $ignoreId): bool
    {
        $query = static::where('code', $code);
        if ($ignoreId) {
            $query->where('id', '!=', $ignoreId);
        }
        return $query->exists();
    }
}
