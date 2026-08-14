<?php

namespace App\Models;

use App\Traits\BelongsToGym;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Trainer extends Model
{
    use HasFactory, BelongsToGym;

    protected $fillable = [
        'gym_id', 'user_id', 'first_name', 'last_name', 'email',
        'phone', 'specialty', 'certifications', 'bio', 'hire_date', 'status',
    ];

    protected $casts = ['hire_date' => 'date'];

    protected $appends = ['full_name'];

    public function getFullNameAttribute(): string
    {
        return "{$this->first_name} {$this->last_name}";
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function classes()
    {
        return $this->hasMany(GymClass::class, 'trainer_id');
    }

    public function visits()
    {
        return $this->hasMany(Visit::class);
    }

    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }
}
