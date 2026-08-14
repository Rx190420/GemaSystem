<?php

namespace App\Models;

use App\Traits\BelongsToGym;
use Illuminate\Database\Eloquent\Model;

class WhatsAppLog extends Model
{
    use BelongsToGym;

    protected $table = 'whatsapp_logs';
    public $timestamps = false;

    protected $fillable = [
        'gym_id',           // used by shared DB; stripped by BelongsToGym for tenant DBs
        'recipient_phone',
        'recipient_name',
        'message_type',
        'message_preview',
        'sent_at',
    ];

    protected $casts = [
        'sent_at' => 'datetime',
    ];
}
