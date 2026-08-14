<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SupportTicket extends Model
{
    protected $fillable = [
        'user_id', 'gym_id', 'ticket_number', 'name', 'email',
        'category', 'subject', 'status', 'assigned_operator_id',
    ];

    public function messages()
    {
        return $this->hasMany(TicketMessage::class, 'ticket_id')->orderBy('created_at');
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function gym()
    {
        return $this->belongsTo(Gym::class);
    }

    public function assignedOperator()
    {
        return $this->belongsTo(User::class, 'assigned_operator_id');
    }
}
