<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AccessCodeController extends Controller
{
    const MAX_CHANGES = 5;

    public function show(Request $request)
    {
        $user = $request->user();

        return response()->json([
            'has_code'          => $user->access_code !== null,
            'code'              => $user->access_code_plain,
            'changes_used'      => (int) $user->access_code_changes,
            'changes_remaining' => max(0, self::MAX_CHANGES - (int) $user->access_code_changes),
        ]);
    }

    public function update(Request $request)
    {
        $user = $request->user();

        if ((int) $user->access_code_changes >= self::MAX_CHANGES) {
            return response()->json([
                'message' => 'Has alcanzado el límite máximo de cambios permitidos (5).',
            ], 422);
        }

        $request->validate([
            'code' => 'required|string|min:6|max:30',
        ]);

        $user->update([
            'access_code'         => Hash::make($request->code),
            'access_code_plain'   => $request->code,
            'access_code_changes' => $user->access_code_changes + 1,
        ]);

        return response()->json([
            'message'           => 'Código de acceso actualizado correctamente.',
            'changes_used'      => (int) $user->access_code_changes,
            'changes_remaining' => max(0, self::MAX_CHANGES - (int) $user->access_code_changes),
        ]);
    }
}
