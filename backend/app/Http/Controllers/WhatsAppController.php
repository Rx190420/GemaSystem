<?php

namespace App\Http\Controllers;

use App\Models\Setting;
use App\Models\WhatsAppLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class WhatsAppController extends Controller
{
    private function botUrl(): string
    {
        return rtrim(config('services.whatsapp.bot_url'), '/');
    }

    private function sessionId(): string
    {
        return 'gym_' . auth()->user()->gym_id;
    }

    private function http()
    {
        $r = Http::timeout(10);
        $s = config('services.whatsapp.bot_secret', '');
        return $s ? $r->withHeaders(['x-api-key' => $s]) : $r;
    }

    // ── Helpers for session-active flag ──────────────────────────────────────

    private function getWasConnected(): bool
    {
        try {
            return Setting::where('key', 'wa_session_active')->value('value') === '1';
        } catch (\Throwable) {
            return false;
        }
    }

    private function saveSessionActive(bool $active): void
    {
        try {
            Setting::updateOrCreate(
                ['key' => 'wa_session_active'],
                [
                    'value' => $active ? '1' : '0',
                    'type'  => 'boolean',
                    'group' => 'whatsapp',
                    'label' => 'Sesión WhatsApp activa',
                ]
            );
        } catch (\Throwable) {}
    }

    // ── Endpoints ─────────────────────────────────────────────────────────────

    public function status()
    {
        if (!config('services.whatsapp.enabled')) {
            return response()->json([
                'enabled'       => false,
                'started'       => false,
                'ready'         => false,
                'was_connected' => false,
            ]);
        }

        // Read persisted session flag before hitting the bot
        $wasConnected = $this->getWasConnected();

        try {
            $res  = $this->http()->get("{$this->botUrl()}/sessions/{$this->sessionId()}/status");
            $data = $res->json() ?? [];

            // Persist the "session is live" flag so it survives GemaSystem logout
            if (!empty($data['ready'])) {
                $this->saveSessionActive(true);
            }

            return response()->json(array_merge(
                ['enabled' => true, 'was_connected' => $wasConnected],
                $data
            ));
        } catch (\Throwable) {
            return response()->json([
                'enabled'       => true,
                'started'       => false,
                'ready'         => false,
                'was_connected' => $wasConnected,
                'error'         => 'Bot no disponible',
            ]);
        }
    }

    public function init()
    {
        try {
            $res = $this->http()->post("{$this->botUrl()}/sessions/{$this->sessionId()}/init");
            return response()->json($res->json());
        } catch (\Throwable $e) {
            return response()->json(['error' => 'No se pudo iniciar la sesión: ' . $e->getMessage()], 503);
        }
    }

    public function qr()
    {
        try {
            $res = $this->http()->get("{$this->botUrl()}/sessions/{$this->sessionId()}/qr");
            return response()->json($res->json(), $res->status());
        } catch (\Throwable $e) {
            return response()->json(['error' => 'No se pudo obtener el QR'], 503);
        }
    }

    public function disconnect()
    {
        try {
            $res = $this->http()->delete("{$this->botUrl()}/sessions/{$this->sessionId()}");

            // Clear the persisted flag — user explicitly disconnected
            $this->saveSessionActive(false);

            return response()->json($res->json());
        } catch (\Throwable $e) {
            return response()->json(['error' => 'No se pudo desconectar'], 503);
        }
    }

    public function logs(Request $request)
    {
        // BelongsToGym + GymScope handle isolation automatically:
        //   free gyms  → shared DB + WHERE gym_id = X
        //   paid gyms  → tenant DB (no gym_id column)
        $query = WhatsAppLog::query();
        $this->applySort($query, $request, ['recipient_name', 'message_type', 'sent_at'], 'sent_at', 'desc');
        $logs = $query->paginate($request->get('per_page', 12));
        return response()->json($logs);
    }

    public function deleteLog($id)
    {
        $log = WhatsAppLog::findOrFail($id);
        $log->delete();
        return response()->json(['ok' => true]);
    }
}
