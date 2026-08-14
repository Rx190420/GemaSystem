<?php

namespace App\Http\Controllers;

use App\Models\FormSubmission;
use Illuminate\Http\Request;

class FormSubmissionController extends Controller
{
    // ── Public: submit any form ───────────────────────────────────────────────

    public function store(Request $request)
    {
        $type = $request->validate(['type' => 'required|in:review,ticket,contact'])['type'];

        $rules = match ($type) {
            'review'  => [
                'name'    => 'required|string|max:120',
                'email'   => 'nullable|email|max:150',
                'role'    => 'nullable|string|max:80',
                'rating'  => 'required|integer|min:1|max:5',
                'message' => 'required|string|min:10|max:1000',
            ],
            'ticket'  => [
                'name'     => 'required|string|max:120',
                'email'    => 'required|email|max:150',
                'category' => 'required|string|max:60',
                'subject'  => 'required|string|max:200',
                'message'  => 'required|string|min:20|max:2000',
            ],
            'contact' => [
                'name'           => 'required|string|max:120',
                'email'          => 'required|email|max:150',
                'company'        => 'nullable|string|max:120',
                'category'       => 'required|string|max:60',  // project type
                'message'        => 'required|string|min:20|max:2000',
                'budget'         => 'nullable|string|max:40',
                'contact_method' => 'nullable|string|max:30',
            ],
        };

        $data = $request->validate($rules);
        $data['type'] = $type;

        FormSubmission::create($data);

        $messages = [
            'review'  => '¡Gracias! Tu reseña será revisada y publicada pronto.',
            'ticket'  => 'Ticket enviado. Te responderemos en menos de 24 horas.',
            'contact' => 'Solicitud enviada. Me pondré en contacto contigo pronto.',
        ];

        return response()->json(['message' => $messages[$type]], 201);
    }

    // ── Operator: list submissions ────────────────────────────────────────────

    public function index(Request $request)
    {
        $type   = $request->query('type', 'all');
        $status = $request->query('status', 'all');

        $q = FormSubmission::orderByDesc('created_at');

        if ($type !== 'all')   $q->where('type',   $type);
        if ($status !== 'all') $q->where('status', $status);

        return response()->json($q->limit(200)->get());
    }

    public function markRead(FormSubmission $submission)
    {
        $submission->update(['status' => 'read']);
        return response()->json(['message' => 'Marcado como leído.']);
    }

    public function archive(FormSubmission $submission)
    {
        $submission->update(['status' => 'archived']);
        return response()->json(['message' => 'Archivado.']);
    }
}
