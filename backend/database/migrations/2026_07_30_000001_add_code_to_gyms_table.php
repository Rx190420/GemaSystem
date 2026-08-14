<?php

use App\Models\Gym;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddCodeToGymsTable extends Migration
{
    public function up()
    {
        Schema::table('gyms', function (Blueprint $table) {
            $table->string('code', 3)->nullable()->unique()->after('name');
        });

        // Backfill existing gyms so member-code generation always has a prefix to use.
        Gym::whereNull('code')->orderBy('id')->get()->each(function (Gym $gym) {
            $gym->update(['code' => Gym::generateUniqueCode($gym->name, $gym->id)]);
        });
    }

    public function down()
    {
        Schema::table('gyms', function (Blueprint $table) {
            $table->dropUnique(['code']);
            $table->dropColumn('code');
        });
    }
}
