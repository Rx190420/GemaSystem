<?php

namespace App\Models;

use App\Traits\BelongsToGym;
use Illuminate\Database\Eloquent\Model;

class Label extends Model
{
    use BelongsToGym;

    protected $fillable = ['gym_id', 'name', 'color'];

    public function members()
    {
        return $this->belongsToMany(Member::class, 'member_labels')->withTimestamps();
    }
}
