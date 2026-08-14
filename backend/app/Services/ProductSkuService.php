<?php

namespace App\Services;

use App\Models\Product;
use Illuminate\Support\Facades\DB;

/**
 * Auto-generates a readable SKU (e.g. "PROT-0001") when a product is
 * created without one. Mirrors MemberCodeService's locked-sequential
 * pattern so concurrent creates don't collide.
 */
class ProductSkuService
{
    public static function generate(string $name): string
    {
        $prefix     = self::prefixFromName($name);
        $connection = (new Product())->getConnectionName();

        try {
            return DB::connection($connection)->transaction(function () use ($prefix, $connection) {
                $last = Product::on($connection)
                    ->where('sku', 'like', $prefix . '-%')
                    ->orderByDesc('id')
                    ->lockForUpdate()
                    ->value('sku');

                $n = 1;
                if ($last && preg_match('/-(\d+)$/', $last, $m)) {
                    $n = (int) $m[1] + 1;
                }

                return $prefix . '-' . str_pad($n, 4, '0', STR_PAD_LEFT);
            });
        } catch (\Throwable $e) {
            return $prefix . '-' . str_pad(random_int(1, 9999), 4, '0', STR_PAD_LEFT);
        }
    }

    private static function prefixFromName(string $name): string
    {
        $letters = strtoupper(preg_replace('/[^A-Za-z]/', '', $name));
        $prefix  = substr($letters, 0, 4);
        return $prefix !== '' ? $prefix : 'PRD';
    }
}
