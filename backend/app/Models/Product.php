<?php

namespace App\Models;

use App\Traits\BelongsToGym;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class Product extends Model
{
    use BelongsToGym;

    protected $fillable = [
        'gym_id', 'name', 'description', 'sku', 'category',
        'price', 'cost', 'stock', 'unlimited_stock', 'low_stock_threshold',
        'image_path', 'status',
    ];

    protected $casts = [
        'price'                => 'decimal:2',
        'cost'                 => 'decimal:2',
        'stock'                => 'integer',
        'unlimited_stock'      => 'boolean',
        'low_stock_threshold'  => 'integer',
    ];

    protected $appends = ['image_url'];

    public function getImageUrlAttribute(): ?string
    {
        return $this->image_path ? Storage::disk('public')->url($this->image_path) : null;
    }

    public function sales()
    {
        return $this->hasMany(ProductSale::class);
    }

    public function scopeLowStock($query)
    {
        return $query->where('unlimited_stock', false)
            ->whereNotNull('stock')
            ->whereColumn('stock', '<=', 'low_stock_threshold')
            ->where('stock', '>', 0);
    }

    public function scopeOutOfStock($query)
    {
        return $query->where('unlimited_stock', false)
            ->whereNotNull('stock')
            ->where('stock', '<=', 0);
    }
}
