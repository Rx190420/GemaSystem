<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

class AddTenantColumns extends Migration
{
    public function up()
    {
        // ── users: access_code columns + gym_id ──────────────────────────────
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'access_code')) {
                $table->string('access_code')->nullable()->after('password');
            }
            if (!Schema::hasColumn('users', 'access_code_plain')) {
                $table->string('access_code_plain')->nullable()->after('access_code');
            }
            if (!Schema::hasColumn('users', 'access_code_changes')) {
                $table->unsignedInteger('access_code_changes')->default(0)->after('access_code_plain');
            }
            if (!Schema::hasColumn('users', 'gym_id')) {
                $table->unsignedBigInteger('gym_id')->nullable()->after('id');
                $table->index('gym_id');
            }
        });

        // ── members ───────────────────────────────────────────────────────────
        if (!Schema::hasColumn('members', 'gym_id')) {
            Schema::table('members', function (Blueprint $table) {
                $table->unsignedBigInteger('gym_id')->nullable()->after('id');
                $table->index('gym_id');
            });
        }

        // ── trainers ──────────────────────────────────────────────────────────
        if (!Schema::hasColumn('trainers', 'gym_id')) {
            Schema::table('trainers', function (Blueprint $table) {
                $table->unsignedBigInteger('gym_id')->nullable()->after('id');
                $table->index('gym_id');
            });
        }

        // ── classes ───────────────────────────────────────────────────────────
        if (!Schema::hasColumn('classes', 'gym_id')) {
            Schema::table('classes', function (Blueprint $table) {
                $table->unsignedBigInteger('gym_id')->nullable()->after('id');
                $table->index('gym_id');
            });
        }

        // ── memberships ───────────────────────────────────────────────────────
        if (!Schema::hasColumn('memberships', 'gym_id')) {
            Schema::table('memberships', function (Blueprint $table) {
                $table->unsignedBigInteger('gym_id')->nullable()->after('id');
                $table->index('gym_id');
            });
        }

        // ── visits ────────────────────────────────────────────────────────────
        if (!Schema::hasColumn('visits', 'gym_id')) {
            Schema::table('visits', function (Blueprint $table) {
                $table->unsignedBigInteger('gym_id')->nullable()->after('id');
                $table->index('gym_id');
            });
        }

        // ── payments ──────────────────────────────────────────────────────────
        if (!Schema::hasColumn('payments', 'gym_id')) {
            Schema::table('payments', function (Blueprint $table) {
                $table->unsignedBigInteger('gym_id')->nullable()->after('id');
                $table->index('gym_id');
            });
        }

        // ── labels ────────────────────────────────────────────────────────────
        if (!Schema::hasColumn('labels', 'gym_id')) {
            Schema::table('labels', function (Blueprint $table) {
                $table->unsignedBigInteger('gym_id')->nullable()->after('id');
                $table->index('gym_id');
            });
        }

        // ── settings ──────────────────────────────────────────────────────────
        if (Schema::hasTable('settings') && !Schema::hasColumn('settings', 'gym_id')) {
            Schema::table('settings', function (Blueprint $table) {
                $table->unsignedBigInteger('gym_id')->nullable()->after('id');
                $table->index('gym_id');
            });

            // Drop old unique on key if it exists, add composite unique(gym_id, key)
            try {
                DB::statement('ALTER TABLE settings DROP INDEX settings_key_unique');
            } catch (\Throwable $e) {
                // Index may not exist — ignore
            }

            try {
                DB::statement('ALTER TABLE settings ADD UNIQUE KEY settings_gym_key_unique (gym_id, `key`)');
            } catch (\Throwable $e) {
                // May already exist — ignore
            }
        }
    }

    public function down()
    {
        $drops = [
            'users'       => ['gym_id', 'access_code', 'access_code_plain', 'access_code_changes'],
            'members'     => ['gym_id'],
            'trainers'    => ['gym_id'],
            'classes'     => ['gym_id'],
            'memberships' => ['gym_id'],
            'visits'      => ['gym_id'],
            'payments'    => ['gym_id'],
            'labels'      => ['gym_id'],
        ];

        foreach ($drops as $table => $columns) {
            Schema::table($table, function (Blueprint $t) use ($columns) {
                $existing = array_filter($columns, fn ($c) => Schema::hasColumn($t->getTable(), $c));
                if ($existing) {
                    $t->dropColumn(array_values($existing));
                }
            });
        }

        if (Schema::hasTable('settings') && Schema::hasColumn('settings', 'gym_id')) {
            Schema::table('settings', function (Blueprint $table) {
                $table->dropColumn('gym_id');
            });
        }
    }
}
