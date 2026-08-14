<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class AddSchedulingToClasses extends Migration
{
    public function up()
    {
        Schema::table('classes', function (Blueprint $table) {
            if (!Schema::hasColumn('classes', 'start_date')) {
                $table->date('start_date')->nullable()->after('duration');
            }
        });

        Schema::table('class_sessions', function (Blueprint $table) {
            if (!Schema::hasColumn('class_sessions', 'status')) {
                $table->enum('status', ['pending', 'completed', 'missed'])->default('pending')->after('completed');
            }
        });

        if (Schema::hasColumn('class_sessions', 'completed')) {
            DB::table('class_sessions')->where('completed', true)->update(['status' => 'completed']);

            Schema::table('class_sessions', function (Blueprint $table) {
                $table->dropColumn('completed');
            });
        }
    }

    public function down()
    {
        Schema::table('class_sessions', function (Blueprint $table) {
            if (!Schema::hasColumn('class_sessions', 'completed')) {
                $table->boolean('completed')->default(false)->after('scheduled_date');
            }
        });

        if (Schema::hasColumn('class_sessions', 'status')) {
            DB::table('class_sessions')->where('status', 'completed')->update(['completed' => true]);

            Schema::table('class_sessions', function (Blueprint $table) {
                $table->dropColumn('status');
            });
        }

        Schema::table('classes', function (Blueprint $table) {
            if (Schema::hasColumn('classes', 'start_date')) {
                $table->dropColumn('start_date');
            }
        });
    }
}
