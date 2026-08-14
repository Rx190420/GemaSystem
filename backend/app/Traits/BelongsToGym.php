<?php

namespace App\Traits;

use App\Scopes\GymScope;
use Illuminate\Support\Facades\Auth;

trait BelongsToGym
{
    protected static function bootBelongsToGym(): void
    {
        static::addGlobalScope(new GymScope);

        static::creating(function ($model) {
            $isPaid = app()->bound('gym.plan') && app('gym.plan') === 'paid';

            if ($isPaid) {
                // Tenant DB tables have no gym_id or user_id columns — strip them
                unset($model->gym_id, $model->user_id);
                return;
            }

            // Shared DB: auto-inject gym_id if not already set
            $user = Auth::guard('sanctum')->user();
            if ($user && $user->gym_id && empty($model->gym_id)) {
                $model->gym_id = $user->gym_id;
            }
        });
    }

    /**
     * Dynamically resolve the database connection:
     *  - paid  → 'tenant' (dedicated DB provisioned for this gym)
     *  - free  → default 'mysql' (shared gemasystem DB, GymScope applies)
     */
    public function getConnectionName(): string
    {
        if (app()->bound('gym.plan') && app('gym.plan') === 'paid') {
            return 'tenant';
        }

        return $this->connection ?? config('database.default');
    }
}
