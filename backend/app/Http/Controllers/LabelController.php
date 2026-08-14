<?php

namespace App\Http\Controllers;

use App\Models\Label;
use App\Models\Member;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class LabelController extends Controller
{
    public function index()
    {
        return response()->json(Label::orderBy('name')->get());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name'  => ['required', 'string', 'max:100', $this->uniqueForGym('labels', 'name')],
            'color' => 'required|string|max:7|regex:/^#[0-9a-fA-F]{6}$/',
        ]);

        return response()->json(Label::create($data), 201);
    }

    public function update(Request $request, Label $label)
    {
        $data = $request->validate([
            'name'  => ['sometimes', 'string', 'max:100', $this->uniqueForGym('labels', 'name', $label->id)],
            'color' => 'sometimes|string|max:7|regex:/^#[0-9a-fA-F]{6}$/',
        ]);

        $label->update($data);

        return response()->json($label);
    }

    public function destroy(Label $label)
    {
        $label->delete();
        return response()->json(['message' => 'Etiqueta eliminada.']);
    }

    public function attachToMember(Request $request, Member $member)
    {
        $request->validate(['label_id' => ['required', $this->existsInGym('labels')]]);

        $member->labels()->syncWithoutDetaching([$request->label_id]);

        return response()->json(['message' => 'Etiqueta asignada.']);
    }

    public function detachFromMember(Member $member, Label $label)
    {
        $gymId = auth()->user()->gym_id;
        // gym_id is null on tenant-DB members (already scoped by DB), only check when present
        if (($member->gym_id !== null && $member->gym_id !== $gymId) || $label->gym_id !== $gymId) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        $member->labels()->detach($label->id);

        return response()->json(['message' => 'Etiqueta removida.']);
    }
}
