<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('support_tickets')) {
            Schema::create('support_tickets', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('user_id')->nullable()->index();
                $table->unsignedBigInteger('gym_id')->nullable()->index();
                $table->string('ticket_number', 20)->unique();
                $table->string('name', 120);
                $table->string('email', 150);
                $table->string('category', 60)->nullable();
                $table->string('subject', 200);
                $table->enum('status', ['open', 'accepted', 'resolved', 'closed'])->default('open')->index();
                $table->unsignedBigInteger('assigned_operator_id')->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('ticket_messages')) {
            Schema::create('ticket_messages', function (Blueprint $table) {
                $table->id();
                $table->foreignId('ticket_id')->constrained('support_tickets')->cascadeOnDelete();
                $table->enum('sender_type', ['user', 'operator']);
                $table->unsignedBigInteger('sender_id')->nullable();
                $table->string('sender_name', 120);
                $table->text('message');
                $table->timestamps();
            });
        }

        if (!Schema::hasColumn('gyms', 'subscription_ends_at')) {
            Schema::table('gyms', function (Blueprint $table) {
                $table->timestamp('subscription_ends_at')->nullable()->after('status');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('ticket_messages');
        Schema::dropIfExists('support_tickets');
    }
};
