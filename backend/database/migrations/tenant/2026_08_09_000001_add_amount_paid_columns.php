<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Tenant mirror of 2026_08_09_000001_add_amount_paid_columns — see that file for rationale.
class AddAmountPaidColumns extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('visits') && !Schema::hasColumn('visits', 'amount_paid')) {
            Schema::table('visits', function (Blueprint $table) {
                $table->decimal('amount_paid', 10, 2)->nullable()->after('price');
            });
        }

        if (Schema::hasTable('memberships') && !Schema::hasColumn('memberships', 'amount_paid')) {
            Schema::table('memberships', function (Blueprint $table) {
                $table->decimal('amount_paid', 10, 2)->nullable()->after('amount');
            });
        }

        if (Schema::hasTable('product_sales') && !Schema::hasColumn('product_sales', 'amount_paid')) {
            Schema::table('product_sales', function (Blueprint $table) {
                $table->decimal('amount_paid', 10, 2)->nullable()->after('total_amount');
            });
        }

        if (Schema::hasTable('payments') && !Schema::hasColumn('payments', 'amount_paid')) {
            Schema::table('payments', function (Blueprint $table) {
                $table->decimal('amount_paid', 10, 2)->nullable()->after('amount');
            });
        }
    }

    public function down(): void
    {
        foreach (['visits', 'memberships', 'product_sales', 'payments'] as $table) {
            if (Schema::hasTable($table) && Schema::hasColumn($table, 'amount_paid')) {
                Schema::table($table, function (Blueprint $t) {
                    $t->dropColumn('amount_paid');
                });
            }
        }
    }
}
