<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Replaces the single free-text `full_name` with the three-part Mexican
        // naming convention (nombres / apellido paterno / apellido materno) —
        // matches what invoicing and official documents actually ask for.
        foreach (['pending_checkouts', 'users'] as $tableName) {
            Schema::table($tableName, function (Blueprint $table) {
                $table->string('first_name')->nullable()->after('full_name');
                $table->string('paternal_surname')->nullable()->after('first_name');
                $table->string('maternal_surname')->nullable()->after('paternal_surname');
            });

            // Best-effort backfill for any row already carrying a full_name — can't
            // reliably split into three parts, so it lands entirely in first_name
            // rather than guessing wrong at which word is which surname.
            DB::table($tableName)->whereNotNull('full_name')->where('full_name', '!=', '')
                ->update(['first_name' => DB::raw('full_name')]);

            Schema::table($tableName, function (Blueprint $table) {
                $table->dropColumn('full_name');
            });
        }
    }

    public function down(): void
    {
        foreach (['pending_checkouts', 'users'] as $tableName) {
            Schema::table($tableName, function (Blueprint $table) {
                $table->string('full_name')->nullable();
            });

            DB::table($tableName)->update(['full_name' => DB::raw(
                "TRIM(CONCAT_WS(' ', first_name, paternal_surname, maternal_surname))"
            )]);

            Schema::table($tableName, function (Blueprint $table) {
                $table->dropColumn(['first_name', 'paternal_surname', 'maternal_surname']);
            });
        }
    }
};
