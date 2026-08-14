<?php

namespace App\Models;

use App\Traits\BelongsToGym;
use Illuminate\Database\Eloquent\Model;

class ProductSale extends Model
{
    use BelongsToGym;

    protected $fillable = [
        'gym_id', 'product_id', 'member_id', 'quantity',
        'unit_price', 'unit_cost', 'total_amount', 'total_cost', 'profit', 'amount_paid',
        'payment_method', 'sold_by', 'date', 'notes',
    ];

    protected $casts = [
        'unit_price'   => 'decimal:2',
        'unit_cost'    => 'decimal:2',
        'total_amount' => 'decimal:2',
        'total_cost'   => 'decimal:2',
        'profit'       => 'decimal:2',
        'amount_paid'  => 'decimal:2',
        'quantity'     => 'integer',
        'date'         => 'date',
    ];

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function member()
    {
        return $this->belongsTo(Member::class);
    }

    public function seller()
    {
        return $this->belongsTo(User::class, 'sold_by');
    }
}
