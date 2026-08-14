<?php

namespace App\Http\Controllers;

use App\Mail\TicketAccepted;
use App\Models\SupportTicket;
use App\Models\TicketMessage;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Mail;

class SupportTicketController extends Controller
{
    // ── Public + optionally authenticated: create ticket ─────────────────────

    public function store(Request $request)
    {
        $data = $request->validate([
            'name'     => 'required|string|max:120',
            'email'    => 'required|email|max:150',
            'category' => 'required|string|max:60',
            'subject'  => 'required|string|max:200',
            'message'  => 'required|string|min:10|max:2000',
        ]);

        // Resolve user — works whether called from public or auth route
        $user  = $request->user() ?? Auth::guard('sanctum')->user();
        $name  = $user ? ($user->username ?? $data['name']) : $data['name'];
        $email = $user ? $user->email : $data['email'];

        $ticket = SupportTicket::create([
            'user_id'       => $user?->id,
            'gym_id'        => $user?->gym_id,
            'ticket_number' => $this->generateTicketNumber(),
            'name'          => $name,
            'email'         => $email,
            'category'      => $data['category'],
            'subject'       => $data['subject'],
            'status'        => 'open',
        ]);

        TicketMessage::create([
            'ticket_id'   => $ticket->id,
            'sender_type' => 'user',
            'sender_id'   => $user?->id,
            'sender_name' => $name,
            'message'     => $data['message'],
        ]);

        return response()->json([
            'message'       => 'Ticket enviado. Te responderemos pronto.',
            'ticket_number' => $ticket->ticket_number,
            'ticket_id'     => $ticket->id,
        ], 201);
    }

    // ── Auth: list tickets for the current gym/user ───────────────────────────

    public function myTickets(Request $request)
    {
        $user = $request->user();

        $tickets = SupportTicket::with(['messages'])
            ->where(function ($q) use ($user) {
                $q->where('user_id', $user->id);
                if ($user->gym_id) {
                    $q->orWhere('gym_id', $user->gym_id);
                }
            })
            ->orderByDesc('updated_at')
            ->get()
            ->map(fn($t) => [
                'id'             => $t->id,
                'ticket_number'  => $t->ticket_number,
                'subject'        => $t->subject,
                'category'       => $t->category,
                'status'         => $t->status,
                'created_at'     => $t->created_at,
                'updated_at'     => $t->updated_at,
                'message_count'  => $t->messages->count(),
                'last_reply_by'  => $t->messages->last()?->sender_type,
            ]);

        return response()->json($tickets);
    }

    // ── Auth: show single ticket with all messages ────────────────────────────

    public function show(Request $request, SupportTicket $ticket)
    {
        $user = $request->user();

        if ($ticket->user_id !== $user->id && $ticket->gym_id !== $user->gym_id) {
            return response()->json(['message' => 'Acceso denegado.'], 403);
        }

        $ticket->load('messages');
        return response()->json($ticket);
    }

    // ── Auth: add message to a ticket (from user side) ────────────────────────

    public function addMessage(Request $request, SupportTicket $ticket)
    {
        $user = $request->user();

        if ($ticket->user_id !== $user->id && $ticket->gym_id !== $user->gym_id) {
            return response()->json(['message' => 'Acceso denegado.'], 403);
        }

        if (in_array($ticket->status, ['resolved', 'closed'])) {
            return response()->json(['message' => 'Este ticket ya está cerrado.'], 422);
        }

        $data = $request->validate(['message' => 'required|string|min:1|max:2000']);

        $msg = TicketMessage::create([
            'ticket_id'   => $ticket->id,
            'sender_type' => 'user',
            'sender_id'   => $user->id,
            'sender_name' => $user->username,
            'message'     => $data['message'],
        ]);

        $ticket->touch();

        return response()->json($msg, 201);
    }

    // ── Operator: list all tickets ────────────────────────────────────────────

    public function operatorIndex(Request $request)
    {
        $status = $request->query('status', 'all');

        $q = SupportTicket::withCount('messages')->orderByDesc('updated_at');
        if ($status !== 'all') {
            $q->where('status', $status);
        }

        $tickets = $q->limit(200)->get()->map(fn($t) => [
            'id'                   => $t->id,
            'ticket_number'        => $t->ticket_number,
            'name'                 => $t->name,
            'email'                => $t->email,
            'subject'              => $t->subject,
            'category'             => $t->category,
            'status'               => $t->status,
            'gym_id'               => $t->gym_id,
            'assigned_operator_id' => $t->assigned_operator_id,
            'created_at'           => $t->created_at,
            'updated_at'           => $t->updated_at,
            'message_count'        => $t->messages_count,
        ]);

        return response()->json($tickets);
    }

    // ── Operator: show ticket with messages ───────────────────────────────────

    public function operatorShow(SupportTicket $ticket)
    {
        $ticket->load(['messages', 'gym:id,name']);
        return response()->json($ticket);
    }

    // ── Operator: reply to ticket ─────────────────────────────────────────────

    public function operatorMessage(Request $request, SupportTicket $ticket)
    {
        $data = $request->validate(['message' => 'required|string|min:1|max:2000']);
        $user = $request->user();

        $msg = TicketMessage::create([
            'ticket_id'   => $ticket->id,
            'sender_type' => 'operator',
            'sender_id'   => $user->id,
            'sender_name' => 'Soporte GemaSystem',
            'message'     => $data['message'],
        ]);

        $ticket->touch();

        return response()->json($msg, 201);
    }

    // ── Operator: accept ticket (sends email) ─────────────────────────────────

    public function accept(Request $request, SupportTicket $ticket)
    {
        if ($ticket->status !== 'open') {
            return response()->json(['message' => 'El ticket ya fue procesado.'], 422);
        }

        $user = $request->user();

        $ticket->update([
            'status'               => 'accepted',
            'assigned_operator_id' => $user->id,
        ]);

        try {
            Mail::to($ticket->email)->send(new TicketAccepted($ticket));
        } catch (\Throwable $e) {
            \Log::warning("Ticket email failed for ticket {$ticket->id}: " . $e->getMessage());
        }

        return response()->json(['message' => 'Ticket aceptado. Se notificó al usuario por correo.']);
    }

    // ── Operator: resolve/close ticket ───────────────────────────────────────

    public function resolve(SupportTicket $ticket)
    {
        $ticket->update(['status' => 'resolved']);
        return response()->json(['message' => 'Ticket marcado como resuelto.']);
    }

    public function close(SupportTicket $ticket)
    {
        $ticket->update(['status' => 'closed']);
        return response()->json(['message' => 'Ticket cerrado.']);
    }

    // ── Public: reply to ticket by number + email ────────────────────────────

    public function publicReply(Request $request)
    {
        $request->validate([
            'ticket_number' => 'required|string',
            'email'         => 'required|email',
            'message'       => 'required|string|min:1|max:2000',
        ]);

        $ticket = SupportTicket::where('ticket_number', strtoupper(trim($request->ticket_number)))
            ->where('email', strtolower(trim($request->email)))
            ->first();

        if (!$ticket) {
            return response()->json(['message' => 'Ticket no encontrado.'], 404);
        }

        if (in_array($ticket->status, ['resolved', 'closed'])) {
            return response()->json(['message' => 'Este ticket ya está cerrado y no acepta respuestas.'], 422);
        }

        $msg = TicketMessage::create([
            'ticket_id'   => $ticket->id,
            'sender_type' => 'user',
            'sender_id'   => null,
            'sender_name' => $ticket->name,
            'message'     => trim($request->message),
        ]);

        $ticket->touch();

        return response()->json([
            'id'          => $msg->id,
            'sender_type' => $msg->sender_type,
            'sender_name' => $msg->sender_name,
            'message'     => $msg->message,
            'created_at'  => $msg->created_at->toIso8601String(),
        ], 201);
    }

    // ── Public: lookup ticket by number + email ──────────────────────────────

    public function publicLookup(Request $request)
    {
        $request->validate([
            'ticket_number' => 'required|string',
            'email'         => 'required|email',
        ]);

        $ticket = SupportTicket::with('messages')
            ->where('ticket_number', strtoupper(trim($request->ticket_number)))
            ->where('email', strtolower(trim($request->email)))
            ->first();

        if (!$ticket) {
            return response()->json(['message' => 'Ticket no encontrado. Verifica el número y el correo.'], 404);
        }

        return response()->json([
            'id'             => $ticket->id,
            'ticket_number'  => $ticket->ticket_number,
            'name'           => $ticket->name,
            'subject'        => $ticket->subject,
            'category'       => $ticket->category,
            'status'         => $ticket->status,
            'priority'       => $ticket->priority ?? 'mid',
            'created_at'     => $ticket->created_at->toIso8601String(),
            'updated_at'     => $ticket->updated_at->toIso8601String(),
            'messages'       => $ticket->messages->map(fn($m) => [
                'id'          => $m->id,
                'sender_type' => $m->sender_type,
                'sender_name' => $m->sender_name,
                'message'     => $m->message,
                'created_at'  => $m->created_at->toIso8601String(),
            ]),
        ]);
    }

    // ── Helper ────────────────────────────────────────────────────────────────

    private function generateTicketNumber(): string
    {
        $year   = now()->year;
        $random = str_pad((string) random_int(1000, 999999), 6, '0', STR_PAD_LEFT);
        return sprintf('TKT-%d-%s', $year, $random);
    }
}
