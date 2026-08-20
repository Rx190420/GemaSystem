<?php

namespace App\Models;

use App\Traits\BelongsToGym;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class GymClass extends Model
{
    use HasFactory, BelongsToGym;

    protected $table = 'classes';

    protected $fillable = [
        'gym_id', 'name', 'color', 'description', 'trainer_id', 'capacity', 'duration', 'difficulty',
        'type', 'member_id', 'total_sessions', 'start_date',
    ];

    protected $casts = [
        'start_date' => 'date',
    ];

    public function trainer()
    {
        return $this->belongsTo(Trainer::class);
    }

    public function member()
    {
        return $this->belongsTo(Member::class);
    }

    public function schedules()
    {
        return $this->hasMany(ClassSchedule::class, 'class_id');
    }

    public function sessions()
    {
        return $this->hasMany(ClassSession::class, 'class_id')->orderBy('session_number');
    }

    public function visits()
    {
        return $this->hasMany(Visit::class, 'class_id');
    }
}
