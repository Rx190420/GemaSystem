<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Tenant mirror of 2026_08_13_000001_add_color_to_membership_types_table — see that file for rationale.
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
