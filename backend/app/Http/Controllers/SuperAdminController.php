<?php

namespace App\Http\Controllers;

use App\Console\Commands\CreateGymDatabase;
use App\Mail\InvoiceReceiptMail;
use App\Mail\TrialApproved;
use App\Mail\TrialRejected;
use App\Mail\UserWelcome;
use App\Models\Gym;
use App\Models\SupportTicket;
use App\Models\TrialRequest;
use App\Models\User;
use App\Services\NotificationService;
use App\Services\RecaptchaService;
use App\Services\WhatsAppService;
use App\Support\DeferredMail;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Stripe\Stripe;
use Stripe\Subscription as StripeSubscription;

class SuperAdminController extends Controller
{
    // ── Overview ─────────────────────────────────────────────────────────────

    public function stats()
    {
        return response()->json([
            'pending_trials'    => TrialRequest::where('status', 'pending')->count(),
            'total_gyms'        => Gym::count(),
            'free_gyms'         => Gym::where('plan_type', 'free')->count(),
            'paid_gyms'         => Gym::where('plan_type', 'paid')->count(),
            'active_gyms'       => Gym::where('status', 'active')->count(),
            'total_users'       => User::where('extended_access', 0)->count(),
            'unread_messages'   => \App\Models\FormSubmission::where('status', 'new')->count(),
            'open_tickets'      => SupportTicket::where('status', 'open')->count(),
        ]);
    }

    // ── Trial requests ────────────────────────────────────────────────────────

    public function trialRequests(Request $request)
    {
        $status = $request->query('status', 'pending');

        $q = TrialRequest::orderByDesc('created_at');
        if ($status !== 'all') {
            $q->where('status', $status);
        }

        return response()->json($q->get());
    }

    public function approveTrial(Request $request, TrialRequest $trial)
    {
        if ($trial->status !== 'pending') {
            return response()->json(['message' => 'La solicitud ya fue procesada.'], 422);
        }

        $request->validate([
            'username'  => 'required|string|max:50|unique:users|regex:/^[a-zA-Z0-9_]+$/',
            'password'  => 'required|string|min:8|max:255',
            'notes'     => 'nullable|string|max:1000',
            'send_email'=> 'nullable|boolean',
        ]);

        // Check email uniqueness — email comes from the trial form, not from request
        if (User::where('email', $trial->email)->exists()) {
            return response()->json([
                'message' => 'Ya existe una cuenta registrada con el correo ' . $trial->email . '. El gym puede ya estar en el sistema.',
            ], 422);
        }

        $plainPassword = $request->password;

        $result = DB::transaction(function () use ($request, $trial, $plainPassword) {
            $gym = Gym::create([
                'name'                   => $trial->gym_name,
                'code'                   => Gym::generateUniqueCode($trial->gym_name),
                'plan'                   => 'weekly',
                'plan_type'              => 'free',
                'status'                 => 'trialing',
                'billing_status'         => 'active',
                'subscription_starts_at' => now(),
                'subscription_ends_at'   => now()->addDays(10),
            ]);

            $user = User::create([
                'gym_id'               => $gym->id,
                'username'             => $request->username,
                'email'                => $trial->email,
                'password'             => Hash::make($plainPassword),
                'role'                 => 'admin',
                'account_status'       => 'active',
                'onboarding_completed' => false,
            ]);

            $trial->update([
                'status'         => 'approved',
                'reviewed_by'    => $request->user()->id,
                'reviewed_at'    => now(),
                'operator_notes' => $request->input('notes'),
            ]);

            return compact('gym', 'user');
        });

        // Send welcome email with credentials (unless operator explicitly opted out)
        if ($request->input('send_email', true)) {
            DeferredMail::send($trial->email, new TrialApproved(
                $trial->gym_name,
                $trial->contact_name,
                $request->username,
                $plainPassword,
            ), "TrialApproved email failed for trial #{$trial->id}");

            if ($trial->phone) {
                WhatsAppService::trialApproved($trial->phone, $trial->gym_name, $trial->contact_name, $request->username);
            }
        }

        return response()->json([
            'message'    => 'Cuenta de prueba creada' . ($request->input('send_email', true) ? ' y correo enviado.' : '.'),
            'gym_id'     => $result['gym']->id,
            'user_id'    => $result['user']->id,
        ]);
    }

    public function rejectTrial(Request $request, TrialRequest $trial)
    {
        if ($trial->status !== 'pending') {
            return response()->json(['message' => 'La solicitud ya fue procesada.'], 422);
        }

        $request->validate([
            'notes'      => 'nullable|string|max:1000',
            'send_email' => 'nullable|boolean',
        ]);

        $trial->update([
            'status'         => 'rejected',
            'reviewed_by'    => $request->user()->id,
            'reviewed_at'    => now(),
            'operator_notes' => $request->input('notes'),
        ]);

        if ($request->input('send_email', true)) {
            DeferredMail::send($trial->email, new TrialRejected(
                $trial->gym_name,
                $trial->contact_name,
                $request->input('notes'),
            ), "TrialRejected email failed for trial #{$trial->id}");

            if ($trial->phone) {
                WhatsAppService::trialRejected($trial->phone, $trial->gym_name, $trial->contact_name, $request->input('notes'));
            }
        }

        return response()->json([
            'message' => 'Solicitud rechazada' . ($request->input('send_email', true) ? ' y notificación enviada.' : '.'),
        ]);
    }

    public function resendApprovalEmail(Request $request, TrialRequest $trial)
    {
        if ($trial->status !== 'approved') {
            return response()->json(['message' => 'Esta solicitud no está aprobada.'], 422);
        }

        $request->validate([
            'username' => 'required|string',
            'password' => 'required|string|min:8',
        ]);

        try {
            Mail::to($trial->email)->send(new TrialApproved(
                $trial->gym_name,
                $trial->contact_name,
                $request->username,
                $request->password,
            ));
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Error enviando correo: ' . $e->getMessage()], 500);
        }

        if ($trial->phone) {
            WhatsAppService::trialApproved($trial->phone, $trial->gym_name, $trial->contact_name, $request->username);
        }

        return response()->json(['message' => 'Correo de credenciales enviado a ' . $trial->email]);
    }

    public function resendRejectionEmail(Request $request, TrialRequest $trial)
    {
        if ($trial->status !== 'rejected') {
            return response()->json(['message' => 'Esta solicitud no está rechazada.'], 422);
        }

        try {
            Mail::to($trial->email)->send(new TrialRejected(
                $trial->gym_name,
                $trial->contact_name,
                $trial->operator_notes,
            ));
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Error enviando correo: ' . $e->getMessage()], 500);
        }

        if ($trial->phone) {
            WhatsAppService::trialRejected($trial->phone, $trial->gym_name, $trial->contact_name, $trial->operator_notes);
        }

        return response()->json(['message' => 'Notificación de rechazo enviada a ' . $trial->email]);
    }

    // ── Gyms list ─────────────────────────────────────────────────────────────

    public function gyms(Request $request)
    {
        $type = $request->query('type', 'all');

        $q = Gym::with(['users' => fn($q) => $q->where('role', 'admin')->select('id', 'gym_id', 'username', 'email', 'last_login', 'account_status')])
                 ->orderByDesc('created_at');

        if ($type !== 'all') {
            $q->where('plan_type', $type);
        }

        $gyms = $q->get()->map(function ($gym) {
            $sub  = $this->subscriptionInfo($gym);
            $data = $gym->toArray();
            $data['subscription']   = $sub;
            $data['admin']          = $gym->users->first();
            unset($data['users']);
            return $data;
        });

        return response()->json($gyms);
    }

    public function gymDetail(Gym $gym)
    {
        $users = User::where('gym_id', $gym->id)
                     ->select('id','username','email','role','account_status','restriction_reason','last_login','created_at')
                     ->get();

        // DB stats — paid gyms have dedicated DB, free gyms use shared
        $stats = $this->getGymStats($gym);

        return response()->json([
            'gym'          => $gym,
            'users'        => $users,
            'subscription' => $this->subscriptionInfo($gym),
            'stats'        => $stats,
            'contact'      => $this->gymContact($gym),
        ]);
    }

    public function setBillingStatus(Request $request, Gym $gym)
    {
        $request->validate([
            'action' => 'required|in:suspend_now,suspend_on_expire,restore',
        ]);

        switch ($request->action) {
            case 'suspend_now':
                // Mark as payment_failed AND expire the subscription immediately → blocks login right now
                $gym->update([
                    'billing_status'       => 'payment_failed',
                    'subscription_ends_at' => now()->subSecond(), // set to past to trigger block
                ]);
                // Revoke all tokens so they're forced to re-login and see the block
                DB::table('personal_access_tokens')
                    ->whereIn('tokenable_id', User::where('gym_id', $gym->id)->pluck('id'))
                    ->where('tokenable_type', User::class)
                    ->delete();
                return response()->json(['message' => 'Suscripción suspendida. El acceso está bloqueado inmediatamente.']);

            case 'suspend_on_expire':
                // Mark as payment_failed but keep subscription_ends_at → blocks only when period ends
                $gym->update(['billing_status' => 'payment_failed']);
                return response()->json(['message' => 'Marcado como pago fallido. El acceso se bloqueará al vencer el período actual.']);

            case 'restore':
                // Undoes BOTH ways a gym ends up blocked, not just the
                // billing_status/status flip 'restore' used to do alone:
                //
                // 1. subscription_ends_at frozen in the past — set by
                //    suspend_now above, or by SuspendExpiredTrials once a
                //    trial/subscription naturally lapses. Gym::
                //    isBillingBlocked() (and AuthController::login()'s own
                //    lazy-expiry check) both gate access off this date, not
                //    just billing_status — leaving it in the past meant the
                //    very next login attempt re-suspended the gym on the
                //    spot, so "restore" looked like it worked (200 + success
                //    toast) but access never actually came back. Pushed
                //    forward 30 days as a grace window; a real Stripe
                //    webhook overwrites this with the true period end the
                //    next time the gym actually pays.
                // 2. users.account_status — SuspendExpiredTrials::doSuspend()
                //    suspends every user in the gym (and revokes their
                //    tokens) when it auto-suspends on expiry; suspend_now
                //    above only revokes tokens, doesn't touch account_status.
                //    Either way, AuthController::login() checks the USER's
                //    own account_status before it ever looks at gym billing,
                //    so a suspended user stayed locked out even after the
                //    gym itself was fully restored.
                $gym->update([
                    'billing_status'       => 'active',
                    'status'               => 'active',
                    'subscription_ends_at' => now()->addDays(30),
                ]);
                User::where('gym_id', $gym->id)
                    ->where('extended_access', 0)
                    ->where('account_status', 'suspended')
                    ->update(['account_status' => 'active']);
                return response()->json(['message' => 'Facturación restaurada. El gym puede volver a acceder.']);
        }
    }

    /**
     * Operator manual grant of one of Gym::GATED_FEATURES to any gym with an
     * active paid subscription — bypasses Stripe entirely, so it never
     * touches billing/the subscription price. The gym's own owner has the
     * same toggle self-service in Profile.jsx (StripeController::
     * updateGymExtras) — this operator version exists for cases handled on
     * the gym owner's behalf (support call, etc.) or to grant/revoke a gym
     * that isn't self-serving it. See Gym::hasFeature() for how a 'basic'
     * gym can gain a feature this way without being relabeled 'custom'.
     */
    public function updateExtras(Request $request, Gym $gym)
    {
        $request->validate([
            'feature' => 'required|in:' . implode(',', Gym::GATED_FEATURES),
            'enabled' => 'required|boolean',
        ]);

        if (!$gym->canGrantExtras()) {
            return response()->json([
                'message' => 'Solo se pueden agregar extras a cuentas con una suscripción de pago activa.',
            ], 422);
        }

        $label   = NotificationService::FEATURE_LABELS[$request->feature] ?? $request->feature;
        $enabled = $request->boolean('enabled');
        $gym->setExtra($request->feature, $enabled);

        if ($enabled) {
            NotificationService::extraGranted($gym->id, $request->feature);
        }

        return response()->json([
            'message' => $enabled ? "Extra \"{$label}\" activado." : "Extra \"{$label}\" desactivado.",
            'gym'     => $gym->fresh(),
        ]);
    }

    /**
     * Converts a free-trial gym (plan_type='free', shared 'public' schema)
     * into a paid one with its own dedicated schema — the operator picks the
     * plan and whether to charge for it.
     *
     * charge=false: activates immediately, no Stripe involved at all — a
     * comp'd upgrade (goodwill, a deal made outside the system, etc.).
     *
     * charge=true: the gym never entered a card (trial signups never go
     * through Stripe), so there's nothing to charge directly. Instead this
     * expires the trial on the spot (billing_status='payment_due', same
     * value isBillingBlocked()/AuthController::login() already understand —
     * see the comment there for why plan_type='free' is what disambiguates
     * this from a lapsed paid subscription reusing the same status) and
     * emails a ready-to-pay Stripe Checkout link for the exact plan chosen.
     * The gym only actually gets its schema provisioned and its trial data
     * migrated once that payment clears — see
     * StripeController::fulfillTrialUpgrade().
     */
    public function convertTrialToPaid(Request $request, Gym $gym)
    {
        if ($gym->plan_type !== 'free') {
            return response()->json(['message' => 'Este gym ya es una cuenta de pago.'], 422);
        }

        $request->validate([
            'plan'       => 'required|in:basic,full,custom',
            'features'   => 'required_if:plan,custom|array',
            'features.*' => 'in:' . implode(',', Gym::GATED_FEATURES),
            'charge'     => 'required|boolean',
        ]);

        $planFeatures = $request->plan === 'custom'
            ? array_fill_keys(array_values($request->input('features', [])), true)
            : ($request->plan === 'full' ? array_fill_keys(Gym::GATED_FEATURES, true) : null);

        $admin = $gym->users()->where('role', 'admin')->first();
        if (!$admin) {
            return response()->json(['message' => 'Este gym no tiene un usuario administrador para notificar.'], 422);
        }

        if (!$request->boolean('charge')) {
            DB::transaction(function () use ($gym, $request, $planFeatures) {
                $gym->update([
                    'plan'                   => $request->plan,
                    'plan_features'          => $planFeatures,
                    'plan_type'              => 'paid',
                    'status'                 => 'active',
                    'billing_status'         => 'active',
                    'subscription_starts_at' => now(),
                    'subscription_ends_at'   => now()->addMonth(),
                ]);
            });

            // CREATE SCHEMA commits on its own the instant it runs (same reason
            // fulfill() waits until after its transaction commits) — only safe
            // to run once the gym row above is durably saved.
            CreateGymDatabase::migrateAndProvision($gym);

            DeferredMail::send($admin->email, new \App\Mail\GymUpgraded($gym->fresh()), "GymUpgraded email failed for gym {$gym->id}");

            NotificationService::create(
                (int) $gym->id,
                'plan_changed',
                'Cuenta activada',
                'Tu cuenta ahora es de pago — ¡bienvenido! Este cambio no tuvo costo.',
                ['plan' => $request->plan]
            );

            return response()->json([
                'message' => "Gym convertido a pago (plan {$request->plan}), sin cobro.",
                'gym'     => $gym->fresh(),
            ]);
        }

        // charge=true — fix the target plan/features and expire the trial so
        // login shows the "pay to activate" screen, then email a Checkout
        // link for that exact plan. Nothing is provisioned/migrated yet.
        // The real subscription_ends_at gets saved first — revertConvertToPaid()
        // below is how the operator undoes this before the gym actually pays.
        $gym->update([
            'plan'                      => $request->plan,
            'plan_features'             => $planFeatures,
            'status'                    => 'suspended',
            'billing_status'            => 'payment_due',
            'pre_upgrade_trial_ends_at' => $gym->subscription_ends_at,
            'subscription_ends_at'      => now(),
        ]);

        try {
            $session = app(StripeController::class)->createTrialUpgradeSession($gym->fresh(), $admin->email);
        } catch (\Throwable $e) {
            Log::error("convertTrialToPaid: fallo al crear sesión de Stripe para gym {$gym->id}: " . $e->getMessage());
            return response()->json(['message' => 'No se pudo generar el link de pago: ' . $e->getMessage()], 500);
        }

        DeferredMail::send($admin->email, new \App\Mail\GymUpgradePending($gym->fresh(), $session->url), "GymUpgradePending email failed for gym {$gym->id}");

        return response()->json([
            'message'     => "Se envió el link de pago a {$admin->email}. El acceso del gym queda bloqueado hasta que paguen.",
            'payment_url' => $session->url,
            'gym'         => $gym->fresh(),
        ]);
    }

    /**
     * Undoes convertTrialToPaid(charge=true) before the gym actually pays —
     * restores normal trial access (status/billing_status, and the trial's
     * real expiration date saved right before it got expired-on-purpose to
     * gate login). Only valid in that exact pending-payment window: once
     * plan_type flips to 'paid' (the gym paid, or an operator later comp'd
     * it), this isn't reachable anymore — there's nothing left to "revert",
     * the gym is genuinely paid, with its own schema and migrated data.
     */
    public function revertConvertToPaid(Request $request, Gym $gym)
    {
        if ($gym->plan_type !== 'free' || $gym->billing_status !== 'payment_due') {
            return response()->json(['message' => 'Este gym no tiene una conversión a pago pendiente que revertir.'], 422);
        }

        $gym->update([
            'plan'                      => 'weekly', // standard trial default — see TrialRequest::approveTrial()
            'plan_features'             => null,
            'status'                    => 'trialing',
            'billing_status'            => 'active',
            'subscription_ends_at'      => $gym->pre_upgrade_trial_ends_at ?? now()->addDays(10),
            'pre_upgrade_trial_ends_at' => null,
        ]);

        NotificationService::create(
            (int) $gym->id,
            'plan_changed',
            'Conversión a pago cancelada',
            'Se canceló la conversión a plan de pago pendiente. Tu cuenta sigue en período de prueba gratuita.',
            []
        );

        return response()->json([
            'message' => 'Se revirtió la conversión a pago — el gym vuelve a su período de prueba normal.',
            'gym'     => $gym->fresh(),
        ]);
    }

    /**
     * The driver-branch CreateGymDatabase::provision() uses — a paid gym's
     * dedicated storage is a MySQL database OR a Postgres schema depending on
     * which DB backs this deployment, never both. Shared by every place here
     * that needs to read a DIFFERENT gym's data than the authenticated
     * operator's own connection (stats, contact info, ...). This used to be
     * duplicated inline and always built the tenant connection off the
     * 'mysql' config unconditionally, so on a Postgres/Supabase deployment
     * (this project's actual driver) connecting to a paid gym's tenant
     * schema silently failed every time.
     */
    private function gymConnection(Gym $gym): \Illuminate\Database\ConnectionInterface
    {
        if (!$gym->isPaid()) {
            return DB::connection();
        }

        if (config('database.default') === 'mysql') {
            config(['database.connections.tenant' => array_merge(
                config('database.connections.mysql'),
                ['database' => $gym->db_name]
            )]);
        } else {
            config(['database.connections.tenant' => array_merge(
                config('database.connections.pgsql'),
                ['schema' => [$gym->db_name, 'public']]
            )]);
        }
        DB::purge('tenant');
        return DB::connection('tenant');
    }

    /**
     * The gym's own business contact details — phone/email/address filled in
     * by the gym itself under Settings → General, same `settings` key-value
     * table SettingController reads/writes. Not to be confused with the
     * trial_requests contact_name/phone captured at signup time: that data
     * only exists for trial-originated gyms and is never copied onto the
     * Gym/User record on approval (see approveTrial()), so it can't be
     * relied on here for every gym — this settings-table read works for any
     * gym regardless of how it was created, and always reflects what the
     * gym has on file right now.
     */
    private function gymContact(Gym $gym): array
    {
        try {
            $conn = $this->gymConnection($gym);
            $rows = $conn->table('settings')
                ->when(!$gym->isPaid(), fn ($q) => $q->where('gym_id', $gym->id))
                ->whereIn('key', ['gym_phone', 'gym_email', 'gym_address'])
                ->pluck('value', 'key');

            return [
                'phone'   => $rows['gym_phone']   ?? null,
                'email'   => $rows['gym_email']   ?? null,
                'address' => $rows['gym_address'] ?? null,
            ];
        } catch (\Throwable $e) {
            \Log::warning("gymContact failed for gym {$gym->id}: " . $e->getMessage());
            return ['phone' => null, 'email' => null, 'address' => null];
        }
    }

    private function getGymStats(Gym $gym): array
    {
        try {
            $conn  = $this->gymConnection($gym);
            $where = $gym->isPaid() ? [] : ['gym_id' => $gym->id];

            // Conditional aggregation instead of a separate COUNT() per flavor —
            // each of these is a network round-trip to Supabase, so 8 sequential
            // queries visibly added up ("tarda en mostrar"). CASE WHEN is
            // standard SQL (unlike whereMonth/whereYear's date-function
            // rewriting), so this stays portable across the mysql/pgsql split
            // above without needing a second raw-SQL branch here.
            $memberStats = $conn->table('members')
                ->when(!empty($where), fn($q) => $q->where($where))
                ->selectRaw("COUNT(*) as total, SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_count")
                ->first();

            $visits = $conn->table('visits')
                ->when(!empty($where), fn($q) => $q->where($where))
                ->count();

            $visitsThisMonth = $conn->table('visits')
                ->when(!empty($where), fn($q) => $q->where($where))
                ->whereMonth('visit_date', now()->month)
                ->whereYear('visit_date', now()->year)
                ->count();

            $membershipStats = $conn->table('memberships')
                ->when(!empty($where), fn($q) => $q->where($where))
                ->selectRaw("COUNT(*) as total, SUM(CASE WHEN status = 'active' AND end_date >= ? THEN 1 ELSE 0 END) as active_count", [now()->toDateString()])
                ->first();

            $paymentStats = $conn->table('payments')
                ->when(!empty($where), fn($q) => $q->where($where))
                ->selectRaw("COUNT(*) as total, SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as revenue")
                ->first();

            return [
                'members'           => (int) $memberStats->total,
                'activeMembers'     => (int) $memberStats->active_count,
                'visits'            => $visits,
                'visitsThisMonth'   => $visitsThisMonth,
                'memberships'       => (int) $membershipStats->total,
                'activeMemberships' => (int) $membershipStats->active_count,
                'payments'          => (int) $paymentStats->total,
                'revenue'           => (float) $paymentStats->revenue,
            ];
        } catch (\Throwable $e) {
            \Log::warning("getGymStats failed for gym {$gym->id}: " . $e->getMessage());
            return [];
        }
    }

    // ── Session management ────────────────────────────────────────────────────

    public function suspendGym(Request $request, Gym $gym)
    {
        $reason = $request->reason ?? null;

        DB::table('personal_access_tokens')
            ->whereIn('tokenable_id', User::where('gym_id', $gym->id)->pluck('id'))
            ->where('tokenable_type', User::class)
            ->delete();

        User::where('gym_id', $gym->id)
            ->where('extended_access', 0)
            ->update(['account_status' => 'suspended', 'restriction_reason' => $reason]);

        return response()->json(['message' => 'Sesiones suspendidas y tokens revocados.']);
    }

    public function restrictGym(Request $request, Gym $gym)
    {
        $reason = $request->reason ?? null;

        User::where('gym_id', $gym->id)
            ->where('extended_access', 0)
            ->update(['account_status' => 'restricted', 'restriction_reason' => $reason]);

        return response()->json(['message' => 'Acceso restringido.']);
    }

    public function activateGym(Gym $gym)
    {
        User::where('gym_id', $gym->id)
            ->where('extended_access', 0)
            ->update(['account_status' => 'active', 'restriction_reason' => null]);

        return response()->json(['message' => 'Acceso activado.']);
    }

    public function suspendUser(Request $request, User $user)
    {
        DB::table('personal_access_tokens')
            ->where('tokenable_id', $user->id)
            ->where('tokenable_type', User::class)
            ->delete();

        $user->update(['account_status' => 'suspended', 'restriction_reason' => $request->reason ?? null]);
        return response()->json(['message' => 'Usuario suspendido.']);
    }

    public function restrictUser(Request $request, User $user)
    {
        $user->update(['account_status' => 'restricted', 'restriction_reason' => $request->reason ?? null]);
        return response()->json(['message' => 'Usuario restringido.']);
    }

    public function activateUser(User $user)
    {
        $user->update(['account_status' => 'active', 'restriction_reason' => null]);
        return response()->json(['message' => 'Usuario activado.']);
    }

    // ── Credentials ───────────────────────────────────────────────────────────

    public function changePassword(Request $request, User $user)
    {
        $request->validate(['password' => 'required|string|min:8']);

        // Revoke all tokens so they must log in again
        $user->tokens()->delete();
        $user->update(['password' => Hash::make($request->password)]);

        return response()->json(['message' => 'Contraseña actualizada.']);
    }

    public function changeSecurityCode(Request $request, User $user)
    {
        $request->validate(['code' => 'required|string|min:4|max:20']);

        $plain = $request->code;
        $user->update([
            'access_code'       => Hash::make($plain),
            'access_code_plain' => $plain,
        ]);

        return response()->json(['message' => 'Código de seguridad actualizado.']);
    }

    public function removeSecurityCode(User $user)
    {
        $user->update(['access_code' => null, 'access_code_plain' => null]);
        return response()->json(['message' => 'Código de seguridad eliminado.']);
    }

    // ── Email resends ─────────────────────────────────────────────────────────
    // Every email GemaSystem can actually send this user again from what's
    // already on record — no fabricated data. Welcome always works (the access
    // code is stored in the clear precisely so it can be resent); the invoice
    // receipt only applies if there's a real Stripe subscription/invoice behind it.

    public function resendWelcomeEmail(User $user)
    {
        if (empty($user->access_code_plain)) {
            return response()->json([
                'message' => 'Este usuario no tiene un código de acceso guardado — no se puede reconstruir el correo de bienvenida.',
            ], 422);
        }

        try {
            Mail::to($user->email)->send(new UserWelcome($user, $user->access_code_plain));
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Error enviando correo: ' . $e->getMessage()], 500);
        }

        return response()->json(['message' => 'Correo de bienvenida reenviado a ' . $user->email]);
    }

    public function resendInvoiceEmail(User $user)
    {
        $gym = $user->gym;

        if (!$gym || !$gym->stripe_subscription_id) {
            return response()->json(['message' => 'Este gym no tiene una suscripción de Stripe.'], 422);
        }

        Stripe::setApiKey(config('services.stripe.secret'));

        try {
            $invoices = \Stripe\Invoice::all(['subscription' => $gym->stripe_subscription_id, 'limit' => 1]);
            $invoice  = $invoices->data[0] ?? null;

            if (!$invoice) {
                return response()->json(['message' => 'No se encontró ningún recibo de pago en Stripe para este gym.'], 404);
            }

            Mail::to($user->email)->send(new InvoiceReceiptMail(
                gymName:     $gym->name,
                planLabel:   $gym->plan === 'weekly' ? 'Semanal' : 'Mensual',
                amount:      number_format(($invoice->amount_paid ?? 0) / 100, 2),
                currency:    strtoupper($invoice->currency ?? 'MXN'),
                periodStart: $gym->subscription_starts_at,
                periodEnd:   $gym->subscription_ends_at,
                invoiceId:   $invoice->id ?? null,
                invoiceUrl:  $invoice->hosted_invoice_url ?? null,
                invoicePdf:  $invoice->invoice_pdf ?? null,
            ));
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Error enviando recibo: ' . $e->getMessage()], 500);
        }

        return response()->json(['message' => 'Recibo de pago reenviado a ' . $user->email]);
    }

    // ── Paid gym DB management ────────────────────────────────────────────────

    public function paidGymDbStats(Gym $gym)
    {
        if (!$gym->isPaid()) {
            return response()->json(['message' => 'Este gym no tiene base de datos dedicada.'], 422);
        }

        if (config('database.default') === 'mysql') {
            config(['database.connections.tenant' => array_merge(
                config('database.connections.mysql'),
                ['database' => $gym->db_name]
            )]);
        } else {
            config(['database.connections.tenant' => array_merge(
                config('database.connections.pgsql'),
                ['schema' => [$gym->db_name, 'public']]
            )]);
        }
        DB::purge('tenant');

        $counts = [
            'members'     => DB::connection('tenant')->table('members')->count(),
            'visits'      => DB::connection('tenant')->table('visits')->count(),
            'payments'    => DB::connection('tenant')->table('payments')->count(),
            'memberships' => DB::connection('tenant')->table('memberships')->count(),
        ];

        return response()->json([
            'gym'    => $gym->only('id', 'name', 'db_name', 'status'),
            'counts' => $counts,
        ]);
    }

    // ── Danger zone: delete gym permanently ───────────────────────────────────

    /**
     * Irreversibly wipes a gym: its dedicated schema/DB (paid) or every
     * gym_id-scoped row in the shared schema (free) via
     * CreateGymDatabase::destroy(), its users, and the gym record itself.
     * Best-effort cancels the Stripe subscription so billing actually stops
     * too — a data wipe alone would leave the customer's card being charged
     * for a gym that no longer exists.
     *
     * Gated by SUPERADMIN_DELETE_SECRET on top of the usual
     * auth:sanctum + operator PIN — a second factor specifically for this
     * one destructive action, so it can't happen from a operator session
     * alone (a wrong click, a compromised session).
     */
    public function deleteGym(Request $request, Gym $gym)
    {
        $request->validate(['secret' => 'required|string']);

        $expected = config('services.superadmin.delete_secret');
        if (empty($expected) || !hash_equals($expected, (string) $request->secret)) {
            return response()->json(['message' => 'Clave secreta incorrecta.'], 403);
        }

        $gymId           = $gym->id;
        $gymName         = $gym->name;
        $stripeSubId     = $gym->stripe_subscription_id;
        $userIds         = User::where('gym_id', $gymId)->pluck('id');

        try {
            DB::transaction(function () use ($gym, $gymId, $userIds) {
                DB::table('personal_access_tokens')
                    ->whereIn('tokenable_id', $userIds)
                    ->where('tokenable_type', User::class)
                    ->delete();

                CreateGymDatabase::destroy($gym);

                User::where('gym_id', $gymId)->delete();

                $gym->delete();
            });
        } catch (\Throwable $e) {
            Log::error("deleteGym failed for gym {$gymId} ({$gymName}): " . $e->getMessage());
            return response()->json(['message' => 'Error eliminando el gym: ' . $e->getMessage()], 500);
        }

        if ($stripeSubId) {
            try {
                Stripe::setApiKey(config('services.stripe.secret'));
                StripeSubscription::cancel($stripeSubId);
            } catch (\Throwable $e) {
                Log::warning("deleteGym: no se pudo cancelar la suscripción de Stripe {$stripeSubId} para gym {$gymId}: " . $e->getMessage());
            }
        }

        Log::warning("Gym {$gymId} (\"{$gymName}\") eliminado permanentemente vía panel de operador.");

        return response()->json(['message' => "Gym \"{$gymName}\" eliminado permanentemente."]);
    }

    // ── Trial requests (public submit endpoint) ───────────────────────────────

    public function submitTrial(Request $request)
    {
        $data = $request->validate([
            'gym_name'        => 'required|string|max:100',
            'contact_name'    => 'required|string|max:100',
            'email'           => 'required|email|max:150',
            'phone'           => 'nullable|string|max:20',
            'recaptcha_token' => 'required|string',
        ]);

        if (! RecaptchaService::verify($data['recaptcha_token'], $request->ip())) {
            return response()->json(['message' => 'No pudimos verificar que eres humano. Intenta de nuevo.'], 422);
        }
        unset($data['recaptcha_token']);

        // Prevent duplicate pending requests from same email
        if (TrialRequest::where('email', $data['email'])->where('status', 'pending')->exists()) {
            return response()->json(['message' => 'Ya tienes una solicitud pendiente con ese correo.'], 422);
        }

        $trial = TrialRequest::create($data);

        return response()->json(['message' => 'Solicitud enviada. Te contactaremos pronto.', 'id' => $trial->id], 201);
    }

    // ── Suspension check manual ───────────────────────────────────────────────

    public function runSuspensionCheck()
    {
        $suspended = 0;
        $details   = [];

        // Gyms gratuitos con trial vencido
        $expiredFree = Gym::where('plan_type', 'free')
            ->whereNotNull('subscription_ends_at')
            ->where('subscription_ends_at', '<', now())
            ->where('status', '!=', 'suspended')
            ->get();

        foreach ($expiredFree as $gym) {
            $this->doSuspendGym($gym, 'trial_expired');
            $details[]  = ['id' => $gym->id, 'name' => $gym->name, 'reason' => 'trial_expired'];
            $suspended++;
        }

        // Gyms de pago con suscripción vencida (2 horas de gracia para webhooks Stripe)
        $expiredPaid = Gym::where('plan_type', 'paid')
            ->whereNotNull('subscription_ends_at')
            ->where('subscription_ends_at', '<', now()->subHours(2))
            ->where('status', '!=', 'suspended')
            ->get();

        foreach ($expiredPaid as $gym) {
            $this->doSuspendGym($gym, 'payment_due');
            $details[]  = ['id' => $gym->id, 'name' => $gym->name, 'reason' => 'payment_due'];
            $suspended++;
        }

        return response()->json([
            'suspended' => $suspended,
            'details'   => $details,
            'message'   => $suspended > 0
                ? "{$suspended} gym(s) suspendidos automáticamente."
                : 'No hay gyms con período vencido.',
        ]);
    }

    private function doSuspendGym(Gym $gym, string $billingStatus): void
    {
        $gym->update([
            'status'         => 'suspended',
            'billing_status' => $billingStatus,
        ]);

        $userIds = User::where('gym_id', $gym->id)->pluck('id');

        DB::table('personal_access_tokens')
            ->whereIn('tokenable_id', $userIds)
            ->where('tokenable_type', User::class)
            ->delete();

        User::where('gym_id', $gym->id)
            ->where('extended_access', 0)
            ->update(['account_status' => 'suspended']);
    }

    // ── Helper ────────────────────────────────────────────────────────────────

    private function subscriptionInfo(Gym $gym): array
    {
        $endsAt      = $gym->subscription_ends_at;
        $startsAt    = $gym->subscription_starts_at;
        $lastPayment = $gym->last_payment_at;
        $days        = $endsAt ? (int) now()->diffInDays(Carbon::parse($endsAt), false) : null;

        if ($gym->plan_type === 'free') {
            if ($gym->billing_status === 'trial_expired' || ($days !== null && $days < 0)) {
                $subStatus = 'expired';
            } elseif ($days !== null && $days <= 3) {
                $subStatus = 'expiring_soon';
            } elseif ($days !== null && $days <= 7) {
                $subStatus = 'expiring';
            } else {
                $subStatus = 'trial';
            }

            return [
                'plan'           => 'free',
                'billing_status' => $gym->billing_status ?? 'active',
                'sub_status'     => $subStatus,
                'starts_at'      => $startsAt?->toISOString(),
                'ends_at'        => $endsAt?->toISOString(),
                'last_payment'   => null,
                'days_remaining' => $days,
                'is_blocked'     => $gym->isBillingBlocked(),
            ];
        }

        if ($gym->billing_status === 'cancelled') {
            $subStatus = 'cancelled';
        } elseif ($gym->billing_status === 'payment_failed') {
            $subStatus = $days !== null && $days < 0 ? 'expired' : 'payment_failed';
        } elseif ($endsAt === null) {
            $subStatus = 'unknown';
        } elseif ($days < 0) {
            $subStatus = 'expired';
        } elseif ($days <= 3) {
            $subStatus = 'expiring_soon';
        } elseif ($days <= 7) {
            $subStatus = 'expiring';
        } else {
            $subStatus = 'active';
        }

        return [
            'plan'           => $gym->plan,
            'billing_status' => $gym->billing_status ?? 'none',
            'sub_status'     => $subStatus,
            'starts_at'      => $startsAt?->toISOString(),
            'ends_at'        => $endsAt?->toISOString(),
            'last_payment'   => $lastPayment?->toISOString(),
            'days_remaining' => $days,
            'is_blocked'     => $gym->isBillingBlocked(),
        ];
    }
}
