<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Adds tenant isolation fields to the gyms table.
 *
 *  plan_type  'free'  → shared gemasystem DB, GymScope applies
 *             'paid'  → dedicated gemasystem_gym_{id} DB, GymScope skipped
 *  db_name    null for free; 'gemasystem_gym_{id}' for paid
 */
class AddPlanTypeToGyms extends Migration
{
    public function up(): void
    {
        Schema::table('gyms', function (Blueprint $table) {
            if (!Schema::hasColumn('gyms', 'plan_type')) {
                $table->enum('plan_type', ['free', 'paid'])
                      ->default('free')
                      ->after('plan')
                      ->comment('free = shared DB | paid = dedicated DB');
            }

            if (!Schema::hasColumn('gyms', 'db_name')) {
                $table->string('db_name')->nullable()
                      ->after('plan_type')
                      ->comment('Database name for paid gyms, e.g. gemasystem_gym_7');
            }
        });

        // Mark all existing gyms as free (safe default)
        DB::table('gyms')->whereNull('plan_type')->update(['plan_type' => 'free']);
    }

    public function down(): void
    {
        Schema::table('gyms', function (Blueprint $table) {
            $table->dropColumn(array_filter(['plan_type', 'db_name'], function ($col) {
                return Schema::hasColumn('gyms', $col);
            }));
        });
    }
}
