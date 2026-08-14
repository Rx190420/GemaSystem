<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ClassSchedule extends Model
{
    public $timestamps = false;

    protected $fillable = ['class_id', 'day_of_week', 'start_time', 'end_time', 'room'];

    public function gymClass()
    {
        return $this->belongsTo(GymClass::class, 'class_id');
    }
}
