<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

class FixGymEnumValues extends Migration
{
    public function up(): void
    {
        // status: add 'suspended'
        DB::statement("ALTER TABLE gyms MODIFY COLUMN status ENUM('active','trialing','cancelled','suspended') NOT NULL DEFAULT 'active'");

        // billing_status: add 'payment_due' and 'trial_expired'
        DB::statement("ALTER TABLE gyms MODIFY COLUMN billing_status ENUM('active','payment_failed','cancelled','none','payment_due','trial_expired') NOT NULL DEFAULT 'none'");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE gyms MODIFY COLUMN status ENUM('active','trialing','cancelled') NOT NULL DEFAULT 'active'");
        DB::statement("ALTER TABLE gyms MODIFY COLUMN billing_status ENUM('active','payment_failed','cancelled','none') NOT NULL DEFAULT 'none'");
    }
}
