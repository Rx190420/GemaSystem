<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class AddProductOriginToIngresosTable extends Migration
{
    public function up(): void
    {
        // Some already-provisioned tenant databases predate the `ingresos` table
        // (schema drift from earlier tenant provisioning) — skip rather than fail.
        if (! Schema::hasTable('ingresos')) {
            return;
        }

        DB::statement("ALTER TABLE ingresos MODIFY COLUMN origin ENUM('membership','visit','manual','product') NOT NULL DEFAULT 'manual'");
    }

    public function down(): void
    {
        if (! Schema::hasTable('ingresos')) {
            return;
        }

        DB::statement("ALTER TABLE ingresos MODIFY COLUMN origin ENUM('membership','visit','manual') NOT NULL DEFAULT 'manual'");
    }
}
