<?php

namespace App\Models;

use App\Traits\BelongsToGym;
use Illuminate\Database\Eloquent\Model;

class MembershipType extends Model
{
    use BelongsToGym;

    protected $table = 'membership_types';

    protected $fillable = ['name', 'color'];
}
