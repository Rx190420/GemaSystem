<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FormSubmission extends Model
{
    protected $fillable = [
        'type', 'name', 'email', 'company', 'subject', 'message',
        'rating', 'role', 'category', 'budget', 'contact_method', 'status',
    ];

    protected $attributes = ['status' => 'new'];
}
