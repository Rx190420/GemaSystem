<?php

namespace App\Http\Controllers;

use App\Models\DiscountCategory;
use Illuminate\Http\Request;

class DiscountCategoryController extends Controller
{
    public function index()
    {
        return response()->json(DiscountCategory::orderBy('name')->get());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name'             => 'required|string|max:100',
            'discount_percent' => 'required|numeric|min:0|max:100',
        ]);

        $category = DiscountCategory::create($data);
        return response()->json($category, 201);
    }

    public function update(Request $request, DiscountCategory $discountCategory)
    {
        $data = $request->validate([
            'name'             => 'sometimes|required|string|max:100',
            'discount_percent' => 'sometimes|required|numeric|min:0|max:100',
        ]);

        $discountCategory->update($data);
        return response()->json($discountCategory);
    }

    public function destroy(DiscountCategory $discountCategory)
    {
        $discountCategory->delete();
        return response()->json(['message' => 'Categoría eliminada.']);
    }
}
