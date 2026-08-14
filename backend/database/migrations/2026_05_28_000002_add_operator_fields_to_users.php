<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddOperatorFieldsToUsers extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Hidden feature-flag column — value 1 = system operator (super-admin)
            // Named innocuously; hidden from all API responses via User::$hidden
            if (!Schema::hasColumn('users', 'extended_access')) {
                $table->tinyInteger('extended_access')->default(0)->after('remember_token');
            }

            // Account lifecycle status — controls login & session access
            if (!Schema::hasColumn('users', 'account_status')) {
                $table->enum('account_status', ['active', 'suspended', 'restricted'])
                      ->default('active')
                      ->after('extended_access');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            foreach (['extended_access', 'account_status'] as $col) {
                if (Schema::hasColumn('users', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
}
