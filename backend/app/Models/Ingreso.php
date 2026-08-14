<?php

namespace App\Models;

use App\Traits\BelongsToGym;
use Illuminate\Database\Eloquent\Model;

class Ingreso extends Model
{
    use BelongsToGym;

    protected $table = 'ingresos';

    protected $fillable = [
        'gym_id', 'member_id', 'concept', 'amount', 'payment_method',
        'origin', 'reference_id', 'reference_type', 'date', 'notes',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'date'   => 'date',
    ];

    public function member()
    {
        return $this->belongsTo(Member::class);
    }
}
