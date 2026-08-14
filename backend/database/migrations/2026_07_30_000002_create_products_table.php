<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('gym_id');
            $table->string('name', 150);
            $table->text('description')->nullable();
            $table->string('sku', 60)->nullable();
            $table->string('category', 100)->nullable();
            $table->decimal('price', 10, 2);
            $table->decimal('cost', 10, 2)->default(0);
            $table->unsignedInteger('stock')->nullable();
            $table->boolean('unlimited_stock')->default(false);
            $table->unsignedInteger('low_stock_threshold')->default(5);
            $table->string('image_path')->nullable();
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->timestamps();

            $table->index(['gym_id', 'status']);
            $table->unique(['gym_id', 'sku']);
            $table->foreign('gym_id')->references('id')->on('gyms')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};
