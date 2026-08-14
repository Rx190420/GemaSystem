<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'gym_id', 'username', 'first_name', 'paternal_surname', 'maternal_surname',
        'email', 'password', 'role',
        'access_code', 'access_code_plain', 'access_code_changes', 'last_login',
        'onboarding_completed', 'account_status', 'restriction_reason',
    ];

    // extended_access and access_code_plain are intentionally NOT in $fillable
    protected $hidden = ['password', 'remember_token', 'access_code', 'access_code_plain', 'extended_access'];

    protected $casts = [
        'last_login'            => 'datetime',
        'access_code_changes'   => 'integer',
        'gym_id'                => 'integer',
        'onboarding_completed'  => 'boolean',
        'extended_access'       => 'integer',
    ];

    // Convenience accessor, e.g. for the welcome email / dashboard greeting —
    // not auto-appended to JSON, callers opt in explicitly ($user->full_name).
    public function getFullNameAttribute(): ?string
    {
        $parts = array_filter([$this->first_name, $this->paternal_surname, $this->maternal_surname]);
        return $parts ? implode(' ', $parts) : null;
    }

    public function gym()
    {
        return $this->belongsTo(Gym::class);
    }

    public function member()
    {
        return $this->hasOne(Member::class);
    }

    public function trainer()
    {
        return $this->hasOne(Trainer::class);
    }
}
