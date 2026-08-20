<?php

namespace App\Http\Controllers;

use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Foundation\Bus\DispatchesJobs;
use Illuminate\Foundation\Validation\ValidatesRequests;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller as BaseController;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Exists;
use Illuminate\Validation\Rules\Unique;

class Controller extends BaseController
{
    use AuthorizesRequests, DispatchesJobs, ValidatesRequests;

    /** True when the current user belongs to a paid (tenant) gym. */
    protected function isPaid(): bool
    {
        return app()->bound('gym.plan') && app('gym.plan') === 'paid';
    }

    /**
     * Returns a validation rule that checks if a value exists in the correct DB for the current gym.
     * Paid gyms: queries the tenant connection directly (bypasses dot-notation string parsing).
     * Free gyms: queries the shared DB filtered by gym_id.
     *
     * @return Exists|\Closure
     */
    protected function existsInGym(string $table, string $column = 'id')
    {
        if ($this->isPaid()) {
            return function ($attribute, $value, $fail) use ($table, $column) {
                $exists = DB::connection('tenant')->table($table)->where($column, $value)->exists();
                if (! $exists) {
                    $fail("El valor seleccionado para {$attribute} no es válido.");
                }
            };
        }

        $gymId = auth()->user()?->gym_id;
        $rule  = Rule::exists($table, $column);
        if ($gymId) {
            $rule->where('gym_id', $gymId);
        }
        return $rule;
    }

    /**
     * Returns a validation rule that enforces uniqueness in the correct DB for the current gym.
     * Paid gyms: queries the tenant connection directly (bypasses dot-notation string parsing).
     * Free gyms: queries the shared DB filtered by gym_id.
     *
     * @return Unique|\Closure
     */
    protected function uniqueForGym(string $table, string $column = 'name', ?int $ignoreId = null)
    {
        if ($this->isPaid()) {
            return function ($attribute, $value, $fail) use ($table, $column, $ignoreId) {
                $query = DB::connection('tenant')->table($table)->where($column, $value);
                if ($ignoreId !== null) {
                    $query->where('id', '!=', $ignoreId);
                }
                if ($query->exists()) {
                    $fail("El campo {$attribute} ya está en uso.");
                }
            };
        }

        $gymId = auth()->user()?->gym_id;
        $rule  = Rule::unique($table, $column);
        if ($ignoreId !== null) {
            $rule->ignore($ignoreId);
        }
        if ($gymId) {
            $rule->where('gym_id', $gymId);
        }
        return $rule;
    }

    /**
     * Applies ?sort_by=&sort_dir= to a query builder, restricted to $allowed
     * column names — prevents sorting by an arbitrary/unindexed or relation
     * column via a hand-crafted request. Falls back to the table's normal
     * default order when no (valid) sort param is present.
     */
    protected function applySort($query, Request $request, array $allowed, string $defaultColumn, string $defaultDir = 'asc')
    {
        $sortBy  = $request->get('sort_by');
        $sortDir = $request->get('sort_dir') === 'desc' ? 'desc' : 'asc';

        if ($sortBy && in_array($sortBy, $allowed, true)) {
            return $query->orderBy($sortBy, $sortDir);
        }

        return $query->orderBy($defaultColumn, $defaultDir);
    }
}
