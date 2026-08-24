<?php

namespace App\Models;

use App\Support\SqlPortability;
use App\Traits\BelongsToGym;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Member extends Model
{
    use HasFactory, BelongsToGym;

    protected $fillable = [
        'gym_id', 'user_id', 'member_code', 'first_name', 'last_name', 'email', 'phone',
        'birth_date', 'gender', 'address', 'emergency_contact_name',
        'emergency_contact_phone', 'membership_type', 'discount_category',
        'membership_start', 'membership_end', 'status', 'qr_token',
    ];

    protected $casts = [
        'birth_date'       => 'date',
        'membership_start' => 'date',
        'membership_end'   => 'date',
    ];

    protected $appends = ['full_name', 'is_expired'];

    public function getFullNameAttribute(): string
    {
        return "{$this->first_name} {$this->last_name}";
    }

    public function getIsExpiredAttribute(): bool
    {
        return $this->membership_end && $this->membership_end->isPast();
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function visits()
    {
        return $this->hasMany(Visit::class);
    }

    public function memberships()
    {
        return $this->hasMany(Membership::class);
    }

    public function payments()
    {
        return $this->hasMany(Payment::class);
    }

    public function labels()
    {
        return $this->belongsToMany(Label::class, 'member_labels')->withTimestamps();
    }

    public function activeMembership()
    {
        return $this->hasOne(Membership::class)->where('status', 'active')->latestOfMany();
    }

    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    public function scopeSearch($query, string $term)
    {
        $like = SqlPortability::likeOperator();
        return $query->where(function ($q) use ($term, $like) {
            $q->where('first_name', $like, "%{$term}%")
              ->orWhere('last_name', $like, "%{$term}%")
              ->orWhere('email', $like, "%{$term}%")
              ->orWhere('phone', $like, "%{$term}%")
              ->orWhere('member_code', $like, "%{$term}%");
        });
    }
}
