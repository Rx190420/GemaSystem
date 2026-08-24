<?php

namespace App\Http\Controllers;

class PlanController extends Controller
{
    /**
     * Public — powers the pricing UI on Landing/Register/Profile. Reads
     * straight from config/plans.php so there is exactly one place these
     * numbers live; the frontend never hardcodes a price.
     */
    public function index()
    {
        return response()->json(config('plans'));
    }
}
