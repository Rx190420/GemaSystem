<?php

namespace App\Http\Controllers;

use App\Models\MembershipType;
use Illuminate\Http\Request;

class MembershipTypeController extends Controller
{
    public function index()
    {
        return response()->json(MembershipType::orderBy('name')->get());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name'  => 'required|string|max:100',
            'color' => 'nullable|string|max:7',
        ]);
        return response()->json(MembershipType::create($data), 201);
    }

    public function update(Request $request, MembershipType $membershipType)
    {
        $data = $request->validate([
            'name'  => 'required|string|max:100',
            'color' => 'nullable|string|max:7',
        ]);
        $membershipType->update($data);
        return response()->json($membershipType);
    }

    public function destroy(MembershipType $membershipType)
    {
        $membershipType->delete();
        return response()->json(['message' => 'Tipo eliminado.']);
    }
}
