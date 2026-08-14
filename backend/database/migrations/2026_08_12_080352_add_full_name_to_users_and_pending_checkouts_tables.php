<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Name of the person responsible for the account — collected at signup,
        // separate from `username` (the login handle). Nullable/backfill-safe
        // since it doesn't exist for accounts created before this column.
        Schema::table('pending_checkouts', function (Blueprint $table) {
            $table->string('full_name')->nullable()->after('gym_name');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->string('full_name')->nullable()->after('username');
        });
    }

    public function down(): void
    {
        Schema::table('pending_checkouts', function (Blueprint $table) {
            $table->dropColumn('full_name');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('full_name');
        });
    }
};
