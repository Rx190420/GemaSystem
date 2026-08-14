<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tenant database schema for paid gyms.
 *
 * - NO gym_id on any table (DB itself is the isolation boundary)
 * - Column names MUST match what the application models/controllers expect
 *   (same names as the shared gemasystem schema, just without gym_id)
 */
class CreateTenantSchema extends Migration
{
    public function up(): void
    {
        // ── Members ───────────────────────────────────────────────────────────
        Schema::create('members', function (Blueprint $table) {
            $table->id();
            $table->string('member_code', 20)->unique()->nullable();
            $table->string('first_name', 100);
            $table->string('last_name', 100);
            $table->string('email', 150)->unique()->nullable();
            $table->string('phone', 20)->nullable();
            $table->date('birth_date')->nullable();
            $table->enum('gender', ['male', 'female', 'other'])->nullable();
            $table->text('address')->nullable();
            $table->string('emergency_contact_name', 100)->nullable();
            $table->string('emergency_contact_phone', 20)->nullable();
            $table->string('membership_type', 50)->default('Básica');
            $table->string('discount_category', 100)->nullable();
            $table->date('membership_start')->nullable();
            $table->date('membership_end')->nullable();
            $table->enum('status', ['active', 'inactive', 'suspended'])->default('active');
            $table->string('qr_token', 64)->unique()->nullable();
            $table->string('photo_url')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        // ── Trainers ──────────────────────────────────────────────────────────
        Schema::create('trainers', function (Blueprint $table) {
            $table->id();
            $table->string('first_name', 100);
            $table->string('last_name', 100);
            $table->string('email', 150)->unique()->nullable();
            $table->string('phone', 20)->nullable();
            $table->string('specialty', 150)->nullable();
            $table->text('bio')->nullable();
            $table->date('hire_date')->nullable();
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->timestamps();
        });

        // ── Classes ───────────────────────────────────────────────────────────
        Schema::create('classes', function (Blueprint $table) {
            $table->id();
            $table->string('name', 150);
            $table->text('description')->nullable();
            $table->unsignedBigInteger('trainer_id')->nullable();
            $table->integer('capacity')->default(20);
            $table->integer('duration')->default(60);
            $table->enum('difficulty', ['beginner', 'intermediate', 'advanced'])->default('beginner');
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->timestamps();

            $table->foreign('trainer_id')->references('id')->on('trainers')->nullOnDelete();
        });

        Schema::create('class_schedules', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('class_id');
            $table->enum('day_of_week', ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']);
            $table->time('start_time');
            $table->time('end_time');
            $table->string('room', 50)->nullable();
            $table->timestamps();

            $table->foreign('class_id')->references('id')->on('classes')->cascadeOnDelete();
        });

        // ── Memberships ───────────────────────────────────────────────────────
        // NOTE: column 'type' (not 'plan') matches Membership model and controllers
        Schema::create('memberships', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('member_id');
            $table->enum('type', ['monthly', 'quarterly', 'biannual', 'annual'])->default('monthly');
            $table->date('start_date');
            $table->date('end_date');
            $table->decimal('amount', 10, 2)->default(0);
            $table->enum('payment_method', ['cash', 'card', 'transfer'])->default('cash');
            $table->enum('status', ['active', 'expired', 'cancelled'])->default('active');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->foreign('member_id')->references('id')->on('members')->cascadeOnDelete();
        });

        // ── Visits ────────────────────────────────────────────────────────────
        // NOTE: column 'visit_date' (not 'visited_at') matches Visit model and controllers
        Schema::create('visits', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('member_id');
            $table->datetime('visit_date')->useCurrent();
            $table->enum('visit_type', ['training', 'class', 'consultation', 'other'])->default('training');
            $table->unsignedBigInteger('class_id')->nullable();
            $table->unsignedBigInteger('trainer_id')->nullable();
            $table->text('notes')->nullable();
            $table->decimal('price', 10, 2)->nullable();
            $table->enum('payment_method', ['cash', 'card', 'transfer'])->nullable();
            $table->timestamps();

            $table->index('visit_date');
            $table->foreign('member_id')->references('id')->on('members')->cascadeOnDelete();
            $table->foreign('class_id')->references('id')->on('classes')->nullOnDelete();
            $table->foreign('trainer_id')->references('id')->on('trainers')->nullOnDelete();
        });

        // ── Payments ──────────────────────────────────────────────────────────
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('member_id');
            $table->unsignedBigInteger('membership_id')->nullable();
            $table->decimal('amount', 10, 2);
            $table->date('payment_date');
            $table->enum('payment_method', ['cash', 'card', 'transfer'])->default('cash');
            $table->string('reference', 255)->nullable();
            $table->text('notes')->nullable();
            $table->enum('status', ['pending', 'completed', 'failed', 'refunded'])->default('completed');
            $table->timestamps();

            $table->foreign('member_id')->references('id')->on('members')->cascadeOnDelete();
            $table->foreign('membership_id')->references('id')->on('memberships')->nullOnDelete();
        });

        // ── Labels ────────────────────────────────────────────────────────────
        Schema::create('labels', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100);
            $table->string('color', 7)->default('#6366f1');
            $table->timestamps();
        });

        Schema::create('member_labels', function (Blueprint $table) {
            $table->unsignedBigInteger('member_id');
            $table->unsignedBigInteger('label_id');
            $table->timestamps(); // created_at + updated_at — required by withTimestamps()
            $table->primary(['member_id', 'label_id']);

            $table->foreign('member_id')->references('id')->on('members')->cascadeOnDelete();
            $table->foreign('label_id')->references('id')->on('labels')->cascadeOnDelete();
        });

        // ── Membership types ──────────────────────────────────────────────────
        Schema::create('membership_types', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100);
            $table->timestamps();
        });

        // ── Discount categories ───────────────────────────────────────────────
        Schema::create('discount_categories', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100);
            $table->decimal('discount_percent', 5, 2)->default(0.00);
            $table->timestamps();
        });

        // ── Ingresos ──────────────────────────────────────────────────────────
        Schema::create('ingresos', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('member_id')->nullable();
            $table->string('concept', 255);
            $table->decimal('amount', 10, 2);
            $table->enum('payment_method', ['cash', 'card', 'transfer'])->default('cash');
            $table->enum('origin', ['membership', 'visit', 'manual'])->default('manual');
            $table->unsignedBigInteger('reference_id')->nullable();
            $table->string('reference_type', 100)->nullable();
            $table->date('date');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index('date');
            $table->foreign('member_id')->references('id')->on('members')->nullOnDelete();
        });

        // ── Settings ──────────────────────────────────────────────────────────
        // NOTE: NO gym_id column — the entire DB belongs to one gym
        // Matches Setting model fields (key, value, type, group, label)
        Schema::create('settings', function (Blueprint $table) {
            $table->id();
            $table->string('key', 100)->unique();
            $table->text('value')->nullable();
            $table->string('type', 20)->default('string');
            $table->string('group', 50)->default('general');
            $table->string('label', 150)->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('discount_categories');
        Schema::dropIfExists('membership_types');
        Schema::dropIfExists('member_labels');
        Schema::dropIfExists('labels');
        Schema::dropIfExists('payments');
        Schema::dropIfExists('visits');
        Schema::dropIfExists('memberships');
        Schema::dropIfExists('ingresos');
        Schema::dropIfExists('class_schedules');
        Schema::dropIfExists('classes');
        Schema::dropIfExists('trainers');
        Schema::dropIfExists('members');
        Schema::dropIfExists('settings');
    }
}
