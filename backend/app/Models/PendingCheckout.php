<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PendingCheckout extends Model
{
    protected $fillable = [
        'stripe_session_id', 'gym_name', 'username',
        'first_name', 'paternal_surname', 'maternal_surname',
        'email', 'password', 'plan_id', 'plan_features', 'status',
    ];

    protected $casts = [
        'plan_features' => 'array',
    ];
}
