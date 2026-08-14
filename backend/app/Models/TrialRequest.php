<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TrialRequest extends Model
{
    protected $fillable = [
        'gym_name', 'contact_name', 'email', 'phone',
        'status', 'operator_notes', 'reviewed_by', 'reviewed_at',
    ];

    protected $casts = [
        'reviewed_at' => 'datetime',
    ];

    public function scopePending($q) { return $q->where('status', 'pending'); }
}
