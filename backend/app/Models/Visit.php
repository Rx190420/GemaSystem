<?php

namespace App\Models;

use App\Traits\BelongsToGym;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Visit extends Model
{
    use HasFactory, BelongsToGym;

    public $timestamps = false;

    protected $fillable = ['gym_id', 'member_id', 'visit_date', 'visit_type', 'class_id', 'trainer_id', 'notes', 'price', 'payment_method', 'amount_paid'];

    protected $casts = ['visit_date' => 'datetime', 'price' => 'decimal:2', 'amount_paid' => 'decimal:2'];

    public function member()
    {
        return $this->belongsTo(Member::class);
    }

    public function gymClass()
    {
        return $this->belongsTo(GymClass::class, 'class_id');
    }

    public function trainer()
    {
        return $this->belongsTo(Trainer::class);
    }
}
