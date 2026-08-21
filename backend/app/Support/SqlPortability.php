<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;

/**
 * MySQL-only date functions (YEAR(), MONTH(), DATE_FORMAT()) used to be safe
 * to sprinkle around in DB::raw()/whereRaw() because the app only ever ran
 * against MySQL. Now that gyms can run on Postgres/Supabase too, those calls
 * throw "function year(date) does not exist" instead of just being slow —
 * this centralizes the portable equivalents so every controller uses the
 * same driver check instead of duplicating it.
 */
class SqlPortability
{
    public static function isPgsql(): bool
    {
        return DB::connection()->getDriverName() === 'pgsql';
    }

    /** Raw SQL selecting the year part of a date/timestamp column, aliased "year". */
    public static function yearExpr(string $column): string
    {
        return self::isPgsql() ? "EXTRACT(YEAR FROM {$column}) as year" : "YEAR({$column}) as year";
    }

    /** Raw SQL selecting the month part of a date/timestamp column, aliased "month". */
    public static function monthExpr(string $column): string
    {
        return self::isPgsql() ? "EXTRACT(MONTH FROM {$column}) as month" : "MONTH({$column}) as month";
    }

    /** Raw SQL selecting the day-of-month part of a date/timestamp column, aliased "day". */
    public static function dayExpr(string $column): string
    {
        return self::isPgsql() ? "EXTRACT(DAY FROM {$column}) as day" : "DAY({$column}) as day";
    }

    /**
     * Raw SQL for "column formatted as 'YYYY-MM' equals ?" — pair with a
     * ['2026-08'] binding via whereRaw()/orWhereRaw(). MySQL's
     * DATE_FORMAT(column, '%Y-%m') has no Postgres equivalent; TO_CHAR is the
     * portable substitute there.
     */
    public static function yearMonthEquals(string $column): string
    {
        return self::isPgsql()
            ? "TO_CHAR({$column}, 'YYYY-MM') = ?"
            : "DATE_FORMAT({$column}, '%Y-%m') = ?";
    }
}
