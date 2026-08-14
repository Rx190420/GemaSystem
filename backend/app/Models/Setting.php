<?php

namespace App\Models;

use App\Traits\BelongsToGym;
use Illuminate\Database\Eloquent\Model;

class Setting extends Model
{
    use BelongsToGym;

    protected $fillable = ['gym_id', 'key', 'value', 'type', 'group', 'label'];

}
