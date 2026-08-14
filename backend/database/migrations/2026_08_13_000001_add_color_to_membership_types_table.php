<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Lets each gym assign a color to its own membership types (Premium, VIP,
 * Estudiante, ...) so custom types can be told apart at a glance in the UI
 * instead of every one of them falling back to the same default badge color.
 */
class AddColorToMembershipTypesTable extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('membership_types') && !Schema::hasColumn('membership_types', 'color')) {
            Schema::table('membership_types', function (Blueprint $table) {
                $table->string('color', 7)->nullable()->after('name');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('membership_types') && Schema::hasColumn('membership_types', 'color')) {
            Schema::table('membership_types', function (Blueprint $table) {
                $table->dropColumn('color');
            });
        }
    }
}
