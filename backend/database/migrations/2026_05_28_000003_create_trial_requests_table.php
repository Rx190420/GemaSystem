<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateTrialRequestsTable extends Migration
{
    public function up(): void
    {
        Schema::create('trial_requests', function (Blueprint $table) {
            $table->id();
            $table->string('gym_name', 100);
            $table->string('contact_name', 100);
            $table->string('email', 150);
            $table->string('phone', 20)->nullable();
            $table->enum('status', ['pending', 'approved', 'rejected', 'cancelled'])
                  ->default('pending');
            $table->text('operator_notes')->nullable();
            $table->unsignedBigInteger('reviewed_by')->nullable(); // operator user_id
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();

            $table->index('status');
            $table->index('email');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('trial_requests');
    }
}
