<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pending_checkouts', function (Blueprint $table) {
            $table->id();
            $table->string('stripe_session_id')->nullable()->unique();
            $table->string('gym_name');
            $table->string('username');
            $table->string('email')->index();
            $table->string('password');
            $table->string('plan_id'); // weekly, monthly, annual
            $table->string('status')->default('pending'); // pending, completed
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pending_checkouts');
    }
};
