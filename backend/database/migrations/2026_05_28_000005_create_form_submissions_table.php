<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Stores all public form submissions from landing pages:
 *   type = 'review'   → landing page user reviews
 *   type = 'ticket'   → support tickets (from /support)
 *   type = 'contact'  → project inquiries (from /proyectos)
 */
class CreateFormSubmissionsTable extends Migration
{
    public function up(): void
    {
        Schema::create('form_submissions', function (Blueprint $table) {
            $table->id();
            $table->enum('type', ['review', 'ticket', 'contact'])->index();
            $table->string('name',    120)->nullable();
            $table->string('email',   150)->nullable();
            $table->string('company', 120)->nullable();
            $table->string('subject', 200)->nullable();
            $table->text('message')->nullable();
            $table->string('rating', 10)->nullable();  // for reviews: 1-5
            $table->string('role',   80)->nullable();  // reviewer role / tab
            $table->string('category', 60)->nullable(); // ticket category / project type
            $table->string('budget',  40)->nullable();  // contact budget
            $table->string('contact_method', 30)->nullable(); // email|whatsapp|call
            $table->enum('status', ['new', 'read', 'archived'])->default('new')->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('form_submissions');
    }
}
