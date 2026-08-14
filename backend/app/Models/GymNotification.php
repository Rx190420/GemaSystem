<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class GymNotification extends Model
{
    protected $fillable = ['gym_id', 'type', 'title', 'body', 'data', 'read_at'];

    protected $casts = [
        'data'    => 'array',
        'read_at' => 'datetime',
    ];

    public function scopeForGym($query, int $gymId)
    {
        return $query->where('gym_id', $gymId);
    }

    public function scopeUnread($query)
    {
        return $query->whereNull('read_at');
    }
}
