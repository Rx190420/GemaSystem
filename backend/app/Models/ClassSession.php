<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ClassSession extends Model
{
    protected $table = 'class_sessions';

    protected $fillable = ['class_id', 'session_number', 'scheduled_date', 'status', 'completed_at', 'notes'];

    protected $casts = [
        'scheduled_date' => 'date',
        'completed_at'   => 'datetime',
    ];

    public function gymClass()
    {
        return $this->belongsTo(GymClass::class, 'class_id');
    }
}
