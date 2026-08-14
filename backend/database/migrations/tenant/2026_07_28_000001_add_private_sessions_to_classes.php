<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddPrivateSessionsToClasses extends Migration
{
    public function up(): void
    {
        Schema::table('classes', function (Blueprint $table) {
            if (!Schema::hasColumn('classes', 'type')) {
                $table->enum('type', ['group', 'private'])->default('group')->after('difficulty');
            }
            if (!Schema::hasColumn('classes', 'member_id')) {
                $table->unsignedBigInteger('member_id')->nullable()->after('type');
                $table->foreign('member_id')->references('id')->on('members')->nullOnDelete();
            }
            if (!Schema::hasColumn('classes', 'total_sessions')) {
                $table->unsignedInteger('total_sessions')->nullable()->after('member_id');
            }
        });

        if (!Schema::hasTable('class_sessions')) {
            Schema::create('class_sessions', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('class_id');
                $table->unsignedInteger('session_number');
                $table->date('scheduled_date')->nullable();
                $table->boolean('completed')->default(false);
                $table->timestamp('completed_at')->nullable();
                $table->text('notes')->nullable();
                $table->timestamps();

                $table->foreign('class_id')->references('id')->on('classes')->cascadeOnDelete();
                $table->unique(['class_id', 'session_number']);
            });
        }

        // Tenant schema never had this column at all (see shared-DB migration for details).
        if (!Schema::hasColumn('trainers', 'certifications')) {
            Schema::table('trainers', function (Blueprint $table) {
                $table->string('certifications', 255)->nullable()->after('specialty');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('class_sessions');

        Schema::table('classes', function (Blueprint $table) {
            $table->dropForeign(['member_id']);
            $table->dropColumn(['type', 'member_id', 'total_sessions']);
        });
    }
}
