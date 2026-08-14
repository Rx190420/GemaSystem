<?php

namespace App\Models;

use App\Traits\BelongsToGym;
use Illuminate\Database\Eloquent\Model;

class DiscountCategory extends Model
{
    use BelongsToGym;

    protected $table = 'discount_categories';

    protected $fillable = ['name', 'discount_percent'];

    protected $casts = ['discount_percent' => 'decimal:2'];
}
