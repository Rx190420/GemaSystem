<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_sales', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('product_id');
            $table->unsignedBigInteger('member_id')->nullable();
            $table->unsignedInteger('quantity');
            $table->decimal('unit_price', 10, 2);
            $table->decimal('unit_cost', 10, 2);
            $table->decimal('total_amount', 10, 2);
            $table->decimal('total_cost', 10, 2);
            $table->decimal('profit', 10, 2)->default(0);
            $table->enum('payment_method', ['cash', 'card', 'transfer'])->default('cash');
            // No FK: the tenant DB has no `users` table (auth stays centralized).
            $table->unsignedBigInteger('sold_by')->nullable();
            $table->date('date');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index('date');
            $table->index('product_id');
            $table->index('member_id');

            $table->foreign('product_id')->references('id')->on('products');
            $table->foreign('member_id')->references('id')->on('members')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_sales');
    }
};
