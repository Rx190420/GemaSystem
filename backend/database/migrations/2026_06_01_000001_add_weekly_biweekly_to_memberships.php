<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE memberships MODIFY COLUMN type ENUM('monthly','quarterly','biannual','annual','weekly','biweekly') NOT NULL DEFAULT 'monthly'");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE memberships MODIFY COLUMN type ENUM('monthly','quarterly','biannual','annual') NOT NULL DEFAULT 'monthly'");
    }
};
