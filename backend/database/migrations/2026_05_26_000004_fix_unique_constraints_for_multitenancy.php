<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class FixUniqueConstraintsForMultitenancy extends Migration
{
    public function up()
    {
        // members: (email) → (gym_id, email) & (member_code) → (gym_id, member_code)
        $this->swap('members', 'members_email_unique',       '(`email`)',                 'members_gym_email_unique',       '(`gym_id`,`email`)');
        $this->swap('members', 'members_member_code_unique', '(`member_code`)',            'members_gym_member_code_unique', '(`gym_id`,`member_code`)');

        // labels: (name) → (gym_id, name) - only if table exists
        if (Schema::hasTable('labels')) {
            $this->swap('labels', 'labels_name_unique', '(`name`)', 'labels_gym_name_unique', '(`gym_id`,`name`)');
        }

        // settings: (key) → (gym_id, key)
        $this->swap('settings', 'settings_key_unique', '(`key`)', 'settings_gym_key_unique', '(`gym_id`,`key`)');
    }

    public function down()
    {
        $this->swap('members', 'members_gym_email_unique',       '(`gym_id`,`email`)',       'members_email_unique',       '(`email`)');
        $this->swap('members', 'members_gym_member_code_unique', '(`gym_id`,`member_code`)', 'members_member_code_unique', '(`member_code`)');
        if (Schema::hasTable('labels')) {
            $this->swap('labels',  'labels_gym_name_unique',         '(`gym_id`,`name`)',        'labels_name_unique',         '(`name`)');
        }
        $this->swap('settings','settings_gym_key_unique',        '(`gym_id`,`key`)',         'settings_key_unique',        '(`key`)');
    }

    private function swap(string $table, string $oldIndex, string $oldCols, string $newIndex, string $newCols): void
    {
        try {
            DB::statement("ALTER TABLE `{$table}` DROP INDEX `{$oldIndex}`");
        } catch (\Throwable $e) { /* already gone */ }

        try {
            DB::statement("ALTER TABLE `{$table}` ADD UNIQUE KEY `{$newIndex}` {$newCols}");
        } catch (\Throwable $e) { /* already exists */ }
    }
}
