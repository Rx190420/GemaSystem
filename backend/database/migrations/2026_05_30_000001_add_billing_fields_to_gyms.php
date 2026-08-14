<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddBillingFieldsToGyms extends Migration
{
    public function up(): void
    {
        Schema::table('gyms', function (Blueprint $table) {
            if (!Schema::hasColumn('gyms', 'billing_status')) {
                $table->enum('billing_status', ['active', 'payment_failed', 'cancelled', 'none'])
                      ->default('none')
                      ->after('status')
                      ->comment('Estado del ciclo de pago de Stripe');
            }
            if (!Schema::hasColumn('gyms', 'subscription_starts_at')) {
                $table->timestamp('subscription_starts_at')->nullable()
                      ->after('billing_status')
                      ->comment('Inicio del periodo actual de suscripción');
            }
            if (!Schema::hasColumn('gyms', 'subscription_ends_at')) {
                $table->timestamp('subscription_ends_at')->nullable()
                      ->after('subscription_starts_at')
                      ->comment('Fin del periodo actual de suscripción');
            }
            if (!Schema::hasColumn('gyms', 'last_payment_at')) {
                $table->timestamp('last_payment_at')->nullable()
                      ->after('subscription_ends_at')
                      ->comment('Fecha del último pago exitoso');
            }
        });
    }

    public function down(): void
    {
        Schema::table('gyms', function (Blueprint $table) {
            foreach (['billing_status', 'subscription_starts_at', 'subscription_ends_at', 'last_payment_at'] as $col) {
                if (Schema::hasColumn('gyms', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
}
