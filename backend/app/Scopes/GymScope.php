<?php

namespace App\Scopes;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Scope;
use Illuminate\Support\Facades\Auth;

class GymScope implements Scope
{
    public function apply(Builder $builder, Model $model): void
    {
        // Paid gyms have their own isolated database — no column filter needed
        if (app()->bound('gym.plan') && app('gym.plan') === 'paid') {
            return;
        }

        // Free gyms: filter by gym_id so gyms never see each other's data
        $user = Auth::guard('sanctum')->user();
        if ($user && $user->gym_id) {
            $builder->where($model->getTable() . '.gym_id', $user->gym_id);
        }
    }
}
