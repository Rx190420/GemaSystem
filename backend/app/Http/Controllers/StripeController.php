<?php

namespace App\Http\Controllers;

use App\Console\Commands\CreateGymDatabase;
use App\Mail\InvoiceReceiptMail;
use App\Mail\PaymentFailedMail;
use App\Mail\UserWelcome;
use App\Models\Gym;
use App\Http\Controllers\PasswordResetController;
use App\Models\PendingCheckout;
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
use Stripe\Checkout\Session as StripeSession;
use Stripe\Exception\SignatureVerificationException;
use Stripe\Stripe;
use Stripe\Subscription as StripeSubscription;
use Stripe\Webhook;

class StripeController extends Controller
{
    private function boot(): void
    {
        Stripe::setApiKey(config('services.stripe.secret'));
    }

    // ── New checkout (first-time or resubscription) ───────────────────────────

    public function createCheckoutSession(Request $request)
    {
        $request->validate([
            // Broad here — both branches below now accept the full 5-plan set.
            // Resubscription used to be locked to weekly/monthly only; a gym
            // that lapsed on Basic/Full/Custom needs to reactivate onto THOSE,
            // not be offered legacy plans it never had — see
            // createResubscriptionSession()'s comment for the actual pricing.
            'plan_id'         => 'required|in:weekly,monthly,basic,full,custom',
            'email'           => 'required|email|max:150',
            'password'        => 'required|string|max:255',
            'features'        => 'required_if:plan_id,custom|array',
            'features.*'      => 'in:' . implode(',', Gym::GATED_FEATURES),
        ]);

        $planId   = $request->plan_id;
        $email    = $request->email;
        $password = $request->password;

        // ── Check if this is a resubscription ────────────────────────────────
        $existingUser = User::where('email', $email)->first();

        if ($existingUser) {
            // Verify the account's *existing* password — this isn't setting a new
            // one, so it must not be held to the new-password complexity rules.
            // No reCAPTCHA needed here: the modal that calls this already
            // authenticated the account via the login form a moment earlier, which
            // is a stronger anti-bot signal than a checkbox — see Landing.jsx's
            // reactivateNow(). Requiring a token this call never sends made every
            // reactivation attempt fail validation before it could even check.
            if (!Hash::check($password, $existingUser->password)) {
                return response()->json(['message' => 'Las credenciales no son correctas.'], 422);
            }

            $gym = $existingUser->gym;
            // 'basic' included here too — a lapsed Basic gym that already had
            // extras carries them over on reactivation for free instead of
            // losing them (see resolvePlanFeatures()'s 'basic' branch). Never
            // priced into this checkout either way: extras aren't part of the
            // recurring subscription line item, whatever plan_id this is.
            $features = in_array($planId, ['basic', 'custom'], true)
                ? array_values($request->input('features', []))
                : null;

            // Allowed even if the gym already has a live subscription — buying
            // again while still active STACKS the remaining time on top of the
            // new period instead of being blocked (see fulfill()'s resubscription
            // branch, which does the actual stacking + cancels the old Stripe
            // subscription once the new one is paid, so nothing double-bills).
            return $this->createResubscriptionSession($existingUser, $gym, $planId, $features);
        }

        // ── New registration ─────────────────────────────────────────────────
        $request->validate([
            'recaptcha_token'       => 'required|string',
            'gym_name'              => 'required|string|max:100',
            'first_name'            => 'required|string|max:100',
            'paternal_surname'      => 'required|string|max:100',
            'maternal_surname'      => 'nullable|string|max:100',
            'username'              => 'required|string|min:3|max:50|unique:users,username',
            'email'                 => 'unique:users,email',
            'password'              => ['confirmed', PasswordResetController::passwordRules()],
            'password_confirmation' => 'required',
            'plan_id'                => 'in:basic,full,custom',
            'features'               => 'required_if:plan_id,custom|array',
            'features.*'             => 'in:' . implode(',', Gym::GATED_FEATURES),
        ]);

        if (!in_array($planId, ['basic', 'full', 'custom'], true)) {
            return response()->json(['message' => 'Plan inválido.'], 422);
        }

        if (! RecaptchaService::verify($request->recaptcha_token, $request->ip())) {
            return response()->json(['message' => 'No pudimos verificar que eres humano. Intenta de nuevo.'], 422);
        }

        $features = $planId === 'custom' ? array_values($request->input('features', [])) : null;

        $pending = PendingCheckout::create([
            'gym_name'         => $request->gym_name,
            'first_name'       => $request->first_name,
            'paternal_surname' => $request->paternal_surname,
            'maternal_surname' => $request->maternal_surname,
            'username'         => $request->username,
            'email'            => $email,
            'password'         => Hash::make($password),
            'plan_id'          => $planId,
            'plan_features'    => $features ? array_fill_keys($features, true) : null,
        ]);

        $this->boot();
        $frontendUrl = env('APP_FRONTEND_URL', 'http://localhost:5173');

        // No user/gym exists yet at this point — only the PendingCheckout staging row
        // above, which is inert until a webhook/verifySession call finds it via a real
        // paid Stripe session. If Stripe itself fails here (network blip, bad price id,
        // API outage), there's nothing account-wise to roll back; we just need to not
        // hand the browser a broken redirect and to leave a clean trail in the logs.
        try {
            $session = StripeSession::create([
                'mode'                 => 'subscription',
                'payment_method_types' => ['card'],
                'customer_email'       => $email,
                'line_items'           => [$this->lineItemFor($planId, $features)],
                'success_url'          => $frontendUrl . '/checkout/success?session_id={CHECKOUT_SESSION_ID}',
                'cancel_url'           => $frontendUrl . '/',
                'metadata'             => ['pending_checkout_id' => $pending->id],
                'locale'               => 'es',
            ]);
        } catch (\Throwable $e) {
            Log::error("createCheckoutSession: fallo al crear sesión de Stripe para pending_checkout {$pending->id}: " . $e->getMessage());
            $pending->update(['status' => 'failed']);
            return response()->json(['message' => 'No se pudo iniciar el pago. Intenta de nuevo en unos minutos.'], 502);
        }

        $pending->update(['stripe_session_id' => $session->id]);

        return response()->json(['url' => $session->url]);
    }

    /**
     * Read-only precheck for Register.jsx's "Verificar gym" step — same
     * credentials check as createCheckoutSession()'s resubscription branch
     * above, but without creating a Stripe session or a PendingCheckout row.
     * Lets the reactivation form show which account it actually found (gym
     * name, plan, current status) and gate the real "Reactivar con Stripe"
     * button behind an explicit confirm, instead of only finding out the
     * credentials were wrong after already being bounced to Stripe.
     *
     * Always succeeds once credentials + gym check out, even when the gym
     * already has a live subscription — `is_active` tells the frontend to
     * show "esto se sumará a tu suscripción actual" instead of blocking the
     * purchase (see fulfill()'s resubscription branch for the actual stacking).
     */
    public function verifyReactivation(Request $request)
    {
        $request->validate([
            'email'    => 'required|email|max:150',
            'password' => 'required|string|max:255',
        ]);

        $user = User::where('email', $request->email)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            return response()->json(['message' => 'Las credenciales no son correctas.'], 422);
        }

        $gym = $user->gym;

        if (!$gym) {
            return response()->json(['message' => 'Esta cuenta no tiene un gimnasio asociado.'], 422);
        }

        $isActive = !in_array($gym->billing_status, ['payment_failed', 'cancelled', 'none', 'payment_due', 'trial_expired']);

        return response()->json([
            'gym_name'              => $gym->name,
            'plan'                  => $gym->plan,
            'plan_type'             => $gym->plan_type,
            // Which extras (Gym::GATED_FEATURES) this account already has —
            // not just for 'custom'. A 'basic' gym can hold individually
            // granted/purchased extras too (SuperAdminController::updateExtras
            // / self-service purchase), and reactivating shouldn't silently
            // drop them. Meaningless for 'full' (already has everything) and
            // legacy weekly/monthly/annual (hasFeature() ignores this column
            // for those), but harmless to send back either way.
            'plan_features'         => $gym->plan_features,
            'billing_status'        => $gym->billing_status,
            'subscription_ends_at'  => $gym->subscription_ends_at?->toDateString(),
            'is_active'             => $isActive,
        ]);
    }

    // ── Resubscription for existing user ─────────────────────────────────────

    /**
     * $planId is the FULL 5-plan set, not just legacy weekly/monthly — a gym
     * that lapsed on Basic/Full/Custom reactivates onto one of those, not a
     * legacy plan it never had. lineItemFor() already builds the right line
     * item for all five (fixed Stripe Price for weekly/monthly/basic/full,
     * inline price_data for custom's dynamic addon total) — same helper the
     * new-registration branch above already uses, so both paths price a
     * given plan_id identically.
     */
    private function createResubscriptionSession(User $user, ?Gym $gym, string $planId, ?array $features = null): \Illuminate\Http\JsonResponse
    {
        $this->boot();
        $frontendUrl = env('APP_FRONTEND_URL', 'http://localhost:5173');

        $pending = PendingCheckout::create([
            'gym_name'      => $gym?->name ?? $user->username,
            'username'      => $user->username,
            'email'         => $user->email,
            'password'      => $user->password,
            'plan_id'       => $planId,
            'plan_features' => $features ? array_fill_keys($features, true) : null,
            'status'        => 'pending',
        ]);

        $sessionParams = [
            'mode'                 => 'subscription',
            'payment_method_types' => ['card'],
            'line_items'           => [$this->lineItemFor($planId, $features)],
            'success_url'          => $frontendUrl . '/checkout/success?session_id={CHECKOUT_SESSION_ID}',
            'cancel_url'           => $frontendUrl . '/',
            'metadata'             => [
                'pending_checkout_id' => $pending->id,
                'resubscription'      => '1',
                'existing_user_id'    => $user->id,
                'existing_gym_id'     => $gym?->id,
            ],
            'locale' => 'es',
        ];

        // Reuse existing Stripe customer if possible
        if ($gym?->stripe_customer_id) {
            $sessionParams['customer'] = $gym->stripe_customer_id;
        } else {
            $sessionParams['customer_email'] = $user->email;
        }

        try {
            $session = StripeSession::create($sessionParams);
        } catch (\Throwable $e) {
            Log::error("createResubscriptionSession: fallo al crear sesión de Stripe para user {$user->id}: " . $e->getMessage());
            $pending->update(['status' => 'failed']);
            return response()->json(['message' => 'No se pudo iniciar el pago. Intenta de nuevo en unos minutos.'], 502);
        }

        $pending->update(['stripe_session_id' => $session->id]);

        return response()->json(['url' => $session->url, 'resubscription' => true]);
    }

    // ── Change plan (authenticated — for active subscriptions) ───────────────

    public function changePlan(Request $request)
    {
        $request->validate(['plan_id' => 'required|in:weekly,monthly']);

        $user = auth()->user();
        $gym  = $user->gym;

        if (!$gym || !$gym->stripe_subscription_id) {
            return response()->json(['message' => 'No se encontró suscripción activa.'], 422);
        }

        if ($gym->plan === $request->plan_id) {
            return response()->json(['message' => 'Ya estás en ese plan.'], 422);
        }

        $this->boot();

        try {
            $sub   = StripeSubscription::retrieve($gym->stripe_subscription_id);
            $itemId = $sub->items->data[0]->id;
            $newPrice = config('services.stripe.' . $this->priceKey($request->plan_id));

            // Update subscription — Stripe creates a proration credit for remaining time
            // and charges/credits the difference immediately
            StripeSubscription::update($gym->stripe_subscription_id, [
                'items'              => [['id' => $itemId, 'price' => $newPrice]],
                'proration_behavior' => 'always_invoice',  // immediate invoice with proration credit
            ]);

            // gym.plan will be updated by subscription.updated webhook,
            // but we update locally now for instant UI feedback
            $gym->update(['plan' => $request->plan_id]);

            return response()->json([
                'message' => 'Plan actualizado. El tiempo restante de tu plan anterior se aplicó como crédito.',
                'plan'    => $request->plan_id,
            ]);
        } catch (\Throwable $e) {
            Log::error("changePlan error for gym {$gym->id}: " . $e->getMessage());
            return response()->json(['message' => 'No se pudo cambiar el plan: ' . $e->getMessage()], 500);
        }
    }

    // ── Self-service manual extras ──────────────────────────────────────────────
    // Turning an extra OFF is free/instant (you're just hiding something you
    // already have rights to for this billing period). Turning one ON is a
    // real one-time Stripe charge — see purchaseGymExtra()/fulfillExtraPurchase()
    // below — this endpoint rejects enabled:true on purpose so there's no
    // path to flip a feature on without paying.

    public function updateGymExtras(Request $request)
    {
        $request->validate([
            'feature' => 'required|in:' . implode(',', Gym::GATED_FEATURES),
            'enabled' => 'required|boolean',
        ]);

        if ($request->boolean('enabled')) {
            return response()->json([
                'message' => 'Para activar un extra hay que comprarlo — usa el botón de compra.',
            ], 422);
        }

        $gym = auth()->user()->gym;

        if (!$gym || !$gym->canGrantExtras()) {
            return response()->json([
                'message' => 'Solo puedes administrar extras si tienes una suscripción de pago activa.',
            ], 422);
        }

        $label = NotificationService::FEATURE_LABELS[$request->feature] ?? $request->feature;
        $gym->setExtra($request->feature, false);

        return response()->json([
            'message'      => "Extra \"{$label}\" desactivado.",
            'gym_features' => $gym->fresh()->plan_features,
        ]);
    }

    /**
     * Starts a one-time (mode: payment, NOT subscription) Stripe Checkout
     * for a single Gym::GATED_FEATURES extra — priced the same as that
     * feature's addon in the Custom plan (config('plans.addons.*.price')),
     * never the Basic base price. Deliberately not a recurring line item:
     * per the gym owner's own spec, this extra is only meant to survive the
     * CURRENT subscription — see fulfillExtraPurchase() and
     * NotificationService::extraPurchased() for where that's enforced/explained.
     */

    // ── Self-service trial→paid upgrade (authenticated gym owner) ─────────────
    // The operator-initiated path (SuperAdminController::convertTrialToPaid,
    // AuthController's 'upgrade_pending' block) exists for when an operator
    // hands a gym off to paid on their behalf. This is the other way in: any
    // gym still on a healthy, active free trial can upgrade itself, any time,
    // picking whichever plan it wants — no operator involved. Reuses the same
    // createTrialUpgradeSession()/fulfillTrialUpgrade() as that path (the
    // Checkout session and its fulfillment don't care how the gym got there),
    // so a trial that converts here ends up in exactly the same state — its
    // own schema, trial data migrated over.
    public function upgradeTrialToPaid(Request $request)
    {
        $request->validate([
            'plan'       => 'required|in:basic,full,custom',
            'features'   => 'required_if:plan,custom|array',
            'features.*' => 'in:' . implode(',', Gym::GATED_FEATURES),
        ]);

        $user = auth()->user();
        $gym  = $user->gym;

        if (!$gym || $gym->plan_type !== 'free') {
            return response()->json(['message' => 'Esta cuenta ya es de pago.'], 422);
        }

        $features = $request->plan === 'custom'
            ? array_fill_keys(array_values($request->input('features', [])), true)
            : ($request->plan === 'full' ? array_fill_keys(Gym::GATED_FEATURES, true) : null);

        $gym->update(['plan' => $request->plan, 'plan_features' => $features]);

        try {
            $session = $this->createTrialUpgradeSession($gym->fresh(), $user->email);
            return response()->json(['url' => $session->url]);
        } catch (\Throwable $e) {
            Log::error("upgradeTrialToPaid error for gym {$gym->id}: " . $e->getMessage());
            return response()->json(['message' => 'No se pudo iniciar el pago: ' . $e->getMessage()], 500);
        }
    }

    public function purchaseGymExtra(Request $request)
    {
        $request->validate([
            'features'   => 'required|array|min:1',
            'features.*' => 'in:' . implode(',', Gym::GATED_FEATURES),
        ]);

        $user     = auth()->user();
        $gym      = $user->gym;
        $features = array_values(array_unique($request->features));

        if (!$gym || !$gym->canGrantExtras()) {
            return response()->json([
                'message' => 'Solo puedes comprar extras si tienes una suscripción de pago activa.',
            ], 422);
        }

        $alreadyOwned = array_values(array_filter($features, fn ($f) => $gym->hasFeature($f)));
        if ($alreadyOwned) {
            $labels = array_map(fn ($f) => NotificationService::FEATURE_LABELS[$f] ?? $f, $alreadyOwned);
            return response()->json([
                'message' => 'Ya tienes activo: ' . implode(', ', $labels) . '. Quítalo de la selección e intenta de nuevo.',
            ], 422);
        }

        $this->boot();
        $frontendUrl = env('APP_FRONTEND_URL', 'http://localhost:5173');

        // One line item per feature — the checkout page shows an itemized
        // breakdown instead of a single opaque total, same reasoning as the
        // product-sale cart (ProductSaleController::checkout).
        $lineItems = array_map(function ($feature) {
            $label = NotificationService::FEATURE_LABELS[$feature] ?? $feature;
            $price = (int) config("plans.addons.{$feature}.price");
            return [
                'price_data' => [
                    'currency'     => config('plans.currency', 'mxn'),
                    'product_data' => ['name' => "Extra: {$label} (GemaSystem)"],
                    'unit_amount'  => $price * 100,
                ],
                'quantity' => 1,
            ];
        }, $features);

        $sessionParams = [
            'mode'                 => 'payment', // one-time charge — not a subscription line item
            'payment_method_types' => ['card'],
            'line_items'           => $lineItems,
            'success_url'          => $frontendUrl . '/checkout/success?session_id={CHECKOUT_SESSION_ID}&type=extra_purchase',
            'cancel_url'           => $frontendUrl . '/',
            'metadata'             => [
                'action'   => 'extra_purchase',
                'gym_id'   => (string) $gym->id,
                // Stripe metadata values are strings only — comma-join, same
                // convention as plan-change's "new_features".
                'features' => implode(',', $features),
            ],
            'locale' => 'es',
        ];

        if ($gym->stripe_customer_id) {
            $sessionParams['customer'] = $gym->stripe_customer_id;
        } else {
            $sessionParams['customer_email'] = $user->email;
        }

        try {
            $session = StripeSession::create($sessionParams);
            return response()->json(['url' => $session->url]);
        } catch (\Throwable $e) {
            Log::error("purchaseGymExtra error for gym {$gym->id} features " . implode(',', $features) . ': ' . $e->getMessage());
            return response()->json(['message' => 'No se pudo iniciar el pago: ' . $e->getMessage()], 500);
        }
    }

    // ── Verify extra purchase (polled by success page) ─────────────────────────

    public function verifyExtraPurchase(Request $request)
    {
        $request->validate(['session_id' => 'required|string']);

        $this->boot();

        try {
            $session = StripeSession::retrieve($request->session_id);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Sesión no encontrada'], 404);
        }

        if ($session->payment_status !== 'paid') {
            return response()->json(['status' => 'pending'], 202);
        }

        $metadata = $session->metadata ? $session->metadata->toArray() : [];
        $ok       = $this->fulfillExtraPurchase($session, $metadata);

        if (!$ok) {
            return response()->json([
                'status' => 'error',
                'error'  => 'Tu pago se procesó, pero no pudimos activar el extra automáticamente. Contáctanos por soporte con tu correo — lo resolvemos manualmente sin cobrarte de nuevo.',
            ], 500);
        }

        return response()->json(['status' => 'success']);
    }

    /**
     * @return bool — see fulfillPlanChange()'s docblock for why this must be
     *   honest. metadata.features is a comma-joined list — a single checkout
     *   can cover several extras bought together in one cart (see
     *   Profile.jsx's cart-select UI), all activated here in one pass so
     *   they land together with one combined notification instead of one
     *   per feature.
     */
    private function fulfillExtraPurchase(object $session, array $metadata): bool
    {
        $gymId    = $metadata['gym_id']   ?? null;
        $features = !empty($metadata['features']) ? explode(',', $metadata['features']) : [];

        if (!$gymId || !$features) {
            Log::error("fulfillExtraPurchase: sesión {$session->id} sin gym_id/features en metadata — " . json_encode($metadata));
            return false;
        }

        $gym = Gym::find($gymId);
        if (!$gym) {
            Log::error("fulfillExtraPurchase: gym {$gymId} no encontrado (sesión {$session->id}).");
            return false;
        }

        // Idempotent — every feature already active means a previous
        // poll/webhook already fulfilled this exact purchase, not a failure.
        $toGrant = array_values(array_filter($features, fn ($f) => !$gym->hasFeature($f)));
        if (!$toGrant) return true;

        try {
            $totalPrice = 0;
            foreach ($toGrant as $feature) {
                $gym->setExtra($feature, true);
                $totalPrice += (int) config("plans.addons.{$feature}.price");
            }
            NotificationService::extraPurchased((int) $gym->id, $toGrant, $totalPrice);
            Log::info("Extra purchase fulfilled — gym {$gym->id} → " . implode(',', $toGrant) . " (\${$totalPrice} MXN).");
            return true;
        } catch (\Throwable $e) {
            Log::error("fulfillExtraPurchase error for gym {$gymId} features " . implode(',', $toGrant) . ': ' . $e->getMessage());
            return false;
        }
    }

    // ── Trial-to-paid upgrade payment (operator converted the gym, gym pays) ──
    // SuperAdminController::convertTrialToPaid() sets plan/plan_features to
    // whatever the operator chose and expires the trial on the spot
    // (billing_status='payment_due' while plan_type stays 'free' — see the
    // comment in AuthController::login() for why that combination, not a new
    // column, is what flags this state) and emails a Checkout link for that
    // exact session. This endpoint exists for when that link has expired
    // (Stripe Checkout sessions last 24h) — the "Pagar ahora" button on the
    // upgrade_pending blocked-login screen calls this to mint a fresh one.
    //
    // `plan`/`features` are optional: the gym can also swap to a different
    // plan than the one the operator originally picked (the "¿No es el plan
    // que quieres?" picker on that screen) — when given, this updates
    // gym->plan/plan_features to match *before* building the session, so the
    // eventual fulfillment (fulfillTrialUpgrade) prices and activates
    // whatever they actually paid for, not the operator's original choice.
    // Omitted, it falls back to gym->plan/plan_features exactly as stored.

    public function payTrialUpgrade(Request $request)
    {
        $request->validate([
            'email'      => 'required|email',
            'password'   => 'required|string',
            'plan'       => 'nullable|in:basic,full,custom',
            'features'   => 'required_if:plan,custom|array',
            'features.*' => 'in:' . implode(',', Gym::GATED_FEATURES),
        ]);

        $user = User::where('email', $request->email)->first();
        if (!$user || !Hash::check($request->password, $user->password)) {
            return response()->json(['message' => 'Las credenciales no son correctas.'], 422);
        }

        $gym = $user->gym;
        if (!$gym || $gym->plan_type !== 'free' || $gym->billing_status !== 'payment_due') {
            return response()->json(['message' => 'No hay ningún pago pendiente para esta cuenta.'], 422);
        }

        if ($request->filled('plan') && $request->plan !== $gym->plan) {
            $newFeatures = $request->plan === 'custom'
                ? array_fill_keys(array_values($request->input('features', [])), true)
                : ($request->plan === 'full' ? array_fill_keys(Gym::GATED_FEATURES, true) : null);

            $gym->update(['plan' => $request->plan, 'plan_features' => $newFeatures]);
        }

        try {
            $session = $this->createTrialUpgradeSession($gym->fresh(), $user->email);
            return response()->json(['url' => $session->url]);
        } catch (\Throwable $e) {
            Log::error("payTrialUpgrade error for gym {$gym->id}: " . $e->getMessage());
            return response()->json(['message' => 'No se pudo iniciar el pago: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Builds the Checkout session for a trial→paid conversion — shared by
     * payTrialUpgrade() (the retry button on the blocked-login screen) and
     * SuperAdminController::convertTrialToPaid() (the first link, emailed
     * the moment the operator picks "charge"). Always prices gym->plan/
     * plan_features exactly as already stored on the gym — the operator
     * chose that when converting; nothing here lets a caller substitute a
     * different plan.
     */
    public function createTrialUpgradeSession(Gym $gym, string $email): StripeSession
    {
        $this->boot();
        $frontendUrl = env('APP_FRONTEND_URL', 'http://localhost:5173');
        $features = $gym->plan === 'custom' ? array_keys(array_filter($gym->plan_features ?? [])) : null;

        $sessionParams = [
            'mode'                 => 'subscription',
            'payment_method_types' => ['card'],
            'line_items'           => [$this->lineItemFor($gym->plan, $features)],
            'success_url'          => $frontendUrl . '/checkout/success?session_id={CHECKOUT_SESSION_ID}&type=trial_upgrade',
            'cancel_url'           => $frontendUrl . '/',
            'metadata'             => [
                'action' => 'trial_upgrade',
                'gym_id' => (string) $gym->id,
            ],
            'locale' => 'es',
        ];

        if ($gym->stripe_customer_id) {
            $sessionParams['customer'] = $gym->stripe_customer_id;
        } else {
            $sessionParams['customer_email'] = $email;
        }

        return StripeSession::create($sessionParams);
    }

    // ── Verify trial upgrade (polled by success page) ──────────────────────────

    public function verifyTrialUpgrade(Request $request)
    {
        $request->validate(['session_id' => 'required|string']);

        $this->boot();

        try {
            $session = StripeSession::retrieve($request->session_id);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Sesión no encontrada'], 404);
        }

        if ($session->payment_status !== 'paid') {
            return response()->json(['status' => 'pending'], 202);
        }

        $metadata = $session->metadata ? $session->metadata->toArray() : [];
        $ok       = $this->fulfillTrialUpgrade($session, $metadata);

        if (!$ok) {
            return response()->json([
                'status' => 'error',
                'error'  => 'Tu pago se procesó, pero no pudimos activar tu cuenta de pago automáticamente. Contáctanos por soporte con tu correo — lo resolvemos manualmente sin cobrarte de nuevo.',
            ], 500);
        }

        // Unlike verify-plan-change/verify-extra-purchase (an already-logged-in
        // user changing something about an account they're already in), the
        // gym paying here was sitting on the blocked-login screen — no session
        // to refresh. Same shape as verifySession()'s response, so
        // CheckoutSuccess.jsx can log them in the same way it does for a
        // brand-new signup.
        $gym = Gym::find($metadata['gym_id'] ?? null);
        $admin = $gym?->users()->where('role', 'admin')->first();

        if (!$admin) {
            // Payment and provisioning both genuinely succeeded — just no user
            // to hand back a session for. Frontend falls back to "go log in".
            return response()->json(['status' => 'success']);
        }

        $token = $admin->createToken('gemasystem')->plainTextToken;

        return response()->json([
            'status' => 'success',
            'user'   => [
                'id'                   => $admin->id,
                'username'             => $admin->username,
                'email'                => $admin->email,
                'role'                 => $admin->role,
                'gym_id'               => $admin->gym_id,
                'plan_type'            => $gym->plan_type,
                'plan'                 => $gym->plan,
                'plan_features'        => $gym->featureMap(),
                'onboarding_completed' => (bool) $admin->onboarding_completed,
            ],
            'token' => $token,
        ])->cookie(...AuthController::authCookie($token));
    }

    /**
     * @return bool — same honesty contract as fulfillPlanChange()/
     *   fulfillExtraPurchase(): false means nothing was applied and the
     *   caller must not report success.
     */
    private function fulfillTrialUpgrade(object $session, array $metadata): bool
    {
        $gymId = $metadata['gym_id'] ?? null;
        if (!$gymId) {
            Log::error("fulfillTrialUpgrade: sesión {$session->id} sin gym_id en metadata — " . json_encode($metadata));
            return false;
        }

        $gym = Gym::find($gymId);
        if (!$gym) {
            Log::error("fulfillTrialUpgrade: gym {$gymId} no encontrado (sesión {$session->id}).");
            return false;
        }

        // Idempotent — webhook and polling may both call this; already paid
        // means a previous call already fulfilled it, not a failure.
        if ($gym->plan_type === 'paid') return true;

        $newSubId = $session->subscription ?? null;

        try {
            $startsAt = now();
            $endsAt   = null;
            if ($newSubId) {
                $sub    = StripeSubscription::retrieve($newSubId);
                $period = $this->extractSubPeriod($sub);
                $startsAt = $period['starts_at'] ?? $startsAt;
                $endsAt   = $period['ends_at'];
            }

            $gym->update([
                'stripe_subscription_id' => $newSubId,
                'stripe_customer_id'     => $session->customer ?? $gym->stripe_customer_id,
                'status'                 => 'active',
                'billing_status'         => 'active',
                'subscription_starts_at' => $startsAt,
                'subscription_ends_at'   => $endsAt,
                'last_payment_at'        => now(),
            ]);

            // Sets plan_type='paid' and db_name as part of creating the schema
            // and moving this gym's trial-period data into it — see the class
            // doc comment on CreateGymDatabase::migrateAndProvision().
            CreateGymDatabase::migrateAndProvision($gym);

            $admin = $gym->users()->where('role', 'admin')->first();
            if ($admin) {
                DeferredMail::send($admin->email, new \App\Mail\GymUpgraded($gym), "GymUpgraded email failed for gym {$gym->id}");
            }

            NotificationService::create(
                (int) $gym->id,
                'plan_changed',
                'Cuenta activada',
                'Tu pago se confirmó y tu cuenta ya es de pago. ¡Bienvenido a GemaSystem!',
                ['plan' => $gym->plan]
            );

            Log::info("Trial upgrade fulfilled — gym {$gym->id} → plan_type=paid, plan={$gym->plan}.");
            return true;
        } catch (\Throwable $e) {
            Log::error("fulfillTrialUpgrade error for gym {$gymId}: " . $e->getMessage());
            return false;
        }
    }

    // ── Cancel subscription (authenticated) ──────────────────────────────────

    public function cancelSubscription(Request $request)
    {
        $user = auth()->user();
        $gym  = $user->gym;

        if (!$gym || !$gym->stripe_subscription_id) {
            return response()->json(['message' => 'No se encontró suscripción activa.'], 422);
        }

        if (!in_array($gym->billing_status, ['active', 'trialing'])) {
            return response()->json(['message' => 'No hay suscripción activa que cancelar.'], 422);
        }

        $this->boot();

        try {
            StripeSubscription::update($gym->stripe_subscription_id, [
                'cancel_at_period_end' => true,
            ]);

            $gym->update(['billing_status' => 'cancelled']);

            $endsAt = $gym->subscription_ends_at?->format('d/m/Y');

            return response()->json([
                'message'              => $endsAt
                    ? "Suscripción cancelada. Mantendrás el acceso hasta el {$endsAt}."
                    : 'Suscripción cancelada correctamente.',
                'billing_status'       => 'cancelled',
                'subscription_ends_at' => $gym->subscription_ends_at?->toIso8601String(),
            ]);
        } catch (\Throwable $e) {
            Log::error("cancelSubscription error for gym {$gym->id}: " . $e->getMessage());
            return response()->json(['message' => 'No se pudo cancelar: ' . $e->getMessage()], 500);
        }
    }

    // ── Plan change via new Stripe Checkout (authenticated user) ─────────────

    public function createPlanChangeSession(Request $request)
    {
        $request->validate([
            'plan_id'     => 'required|in:weekly,monthly,basic,full,custom',
            'features'    => 'required_if:plan_id,custom|array',
            'features.*'  => 'in:' . implode(',', Gym::GATED_FEATURES),
        ]);

        $user = auth()->user();
        $gym  = $user->gym;

        if (!$gym) {
            return response()->json(['message' => 'Gimnasio no encontrado.'], 422);
        }
        if ($gym->plan === $request->plan_id) {
            return response()->json(['message' => 'Ya estás en ese plan.'], 422);
        }

        $this->boot();
        $frontendUrl = env('APP_FRONTEND_URL', 'http://localhost:5173');
        $features = $request->plan_id === 'custom' ? array_values($request->input('features', [])) : null;

        $sessionParams = [
            'mode'                 => 'subscription',
            'payment_method_types' => ['card'],
            'line_items'           => [$this->lineItemFor($request->plan_id, $features)],
            'success_url'          => $frontendUrl . '/checkout/success?session_id={CHECKOUT_SESSION_ID}&type=plan_change',
            'cancel_url'           => $frontendUrl . '/',
            'metadata'             => [
                'action'           => 'plan_change',
                'gym_id'           => (string) $gym->id,
                'new_plan'         => $request->plan_id,
                // Stripe metadata values are strings only — comma-join, same
                // convention as the "features" query param the frontend uses.
                'new_features'     => $features ? implode(',', $features) : '',
                'old_subscription' => $gym->stripe_subscription_id ?? '',
            ],
            'locale' => 'es',
        ];

        if ($gym->stripe_customer_id) {
            $sessionParams['customer'] = $gym->stripe_customer_id;
        } else {
            $sessionParams['customer_email'] = $user->email;
        }

        try {
            $session = StripeSession::create($sessionParams);
            return response()->json(['url' => $session->url]);
        } catch (\Throwable $e) {
            Log::error("createPlanChangeSession error for gym {$gym->id}: " . $e->getMessage());
            return response()->json(['message' => 'No se pudo crear la sesión de pago: ' . $e->getMessage()], 500);
        }
    }

    // ── Verify plan change (polled by success page) ───────────────────────────

    public function verifyPlanChange(Request $request)
    {
        $request->validate(['session_id' => 'required|string']);

        $this->boot();

        try {
            $session = StripeSession::retrieve($request->session_id);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Sesión no encontrada'], 404);
        }

        if ($session->payment_status !== 'paid') {
            return response()->json(['status' => 'pending'], 202);
        }

        // (array) on a Stripe SDK object does NOT produce the key => value
        // metadata map — Stripe\StripeObject stores its data in protected
        // properties, so a plain array-cast mangles everything into
        // null-byte-prefixed internal property names ("\0*\0_values", ...).
        // $metadata['gym_id'] was always null here, so fulfillPlanChange()
        // silently bailed out on its very first guard clause on EVERY call —
        // this endpoint has reported "success" back to the frontend without
        // ever actually applying a single plan change. toArray() is the
        // SDK's own correct accessor for this.
        $metadata = $session->metadata ? $session->metadata->toArray() : [];
        $ok       = $this->fulfillPlanChange($session, $metadata);

        if (!$ok) {
            // Stripe already took the payment at this point — this is NOT a
            // "pending" state (retrying won't fix a bad metadata/gym lookup)
            // and must not be reported as success. See fulfillPlanChange()'s
            // own Log::error for the specific reason. Surfacing this as a
            // real error is what makes a future regression of this class
            // show up in the UI instead of silently vanishing again.
            return response()->json([
                'status' => 'error',
                // 'error', not 'message' — matches every other error response
                // in this controller, which is the key CheckoutSuccess.jsx's
                // catch block actually reads (err.response?.data?.error).
                'error'  => 'Tu pago se procesó, pero no pudimos aplicar el cambio de plan automáticamente. Contáctanos por soporte con tu correo — lo resolvemos manualmente sin cobrarte de nuevo.',
            ], 500);
        }

        return response()->json(['status' => 'success']);
    }

    /**
     * @return bool true on success (including "already fulfilled" — a second
     *   poll/webhook hitting the idempotency guard is a legitimate success,
     *   not a failure). false means the plan change was NOT applied — the
     *   caller (verifyPlanChange) must NOT report "success" to the frontend
     *   when this returns false, which is exactly the bug that let a real
     *   (array)-cast defect go undetected: every guard clause below used to
     *   return void silently, so a failed fulfillment still looked identical
     *   to a successful one from the outside.
     */
    private function fulfillPlanChange(object $session, array $metadata): bool
    {
        $gymId       = $metadata['gym_id']           ?? null;
        $newPlan     = $metadata['new_plan']          ?? null;
        $newFeatures = !empty($metadata['new_features']) ? explode(',', $metadata['new_features']) : null;
        $oldSubId    = $metadata['old_subscription']  ?? null;

        if (!$gymId) {
            Log::error("fulfillPlanChange: sesión {$session->id} sin gym_id en metadata — " . json_encode($metadata));
            return false;
        }

        $gym = Gym::find($gymId);
        if (!$gym) {
            Log::error("fulfillPlanChange: gym {$gymId} no encontrado (sesión {$session->id}).");
            return false;
        }

        $newSubId = $session->subscription ?? null;
        if (!$newSubId) {
            Log::error("fulfillPlanChange: sesión {$session->id} sin subscription id (gym {$gymId}).");
            return false;
        }

        // Idempotent — webhook and polling may both call this. Already done
        // is success, not failure.
        if ($gym->stripe_subscription_id === $newSubId) return true;

        try {
            $sub      = StripeSubscription::retrieve($newSubId);
            $period   = $this->extractSubPeriod($sub);
            $priceId  = $sub->items->data[0]->price->id ?? null;
            // 'custom's dynamic price has no static id to match, same caveat
            // as fulfill() — planFromPriceId() returns null and $newPlan
            // (straight from our own metadata) is used instead.
            $planName = $this->planFromPriceId($priceId) ?? $newPlan;

            $gym->update([
                'plan'                   => $planName,
                'plan_features'          => $this->resolvePlanFeatures($planName, $newFeatures),
                'stripe_subscription_id' => $newSubId,
                'stripe_customer_id'     => $session->customer ?? $gym->stripe_customer_id,
                'billing_status'         => 'active',
                'status'                 => 'active',
                'subscription_starts_at' => $period['starts_at'],
                'subscription_ends_at'   => $period['ends_at'],
                'last_payment_at'        => now(),
            ]);

            // Cancel old subscription immediately to avoid double billing
            if ($oldSubId && $oldSubId !== $newSubId) {
                try {
                    StripeSubscription::cancel($oldSubId);
                } catch (\Throwable $e) {
                    Log::warning("Could not cancel old sub {$oldSubId}: " . $e->getMessage());
                }
            }

            Log::info("Plan change fulfilled — gym {$gym->id} → {$planName}, ends=" . ($period['ends_at']?->toDateString() ?? 'n/a'));

            // This method only ever runs for an ALREADY-subscribed gym changing
            // plan (a brand-new signup goes through fulfill(), not here) — so
            // every notification created here is exactly "an existing
            // subscription just got upgraded/changed", per spec. The frontend
            // session cache (sessionStorage) isn't refreshed by this backend
            // call — CheckoutSuccess.jsx re-fetches /auth/me itself right after
            // this succeeds — but this notification is the fallback for
            // whenever that refresh didn't reach the user (closed the tab
            // mid-flow, a stale tab open elsewhere, etc).
            $planLabels = ['weekly' => 'Semanal', 'monthly' => 'Mensual', 'basic' => 'Basic', 'full' => 'Full', 'custom' => 'Custom'];
            NotificationService::create(
                (int) $gym->id,
                'plan_changed',
                'Plan actualizado',
                'Tu plan cambió a ' . ($planLabels[$planName] ?? $planName) . '. Si no ves los cambios reflejados, cierra sesión y vuelve a entrar.',
                ['plan' => $planName]
            );

            return true;
        } catch (\Throwable $e) {
            Log::error("fulfillPlanChange error for gym {$gymId}: " . $e->getMessage());
            return false;
        }
    }

    // ── Webhook ───────────────────────────────────────────────────────────────

    public function webhook(Request $request)
    {
        $payload   = $request->getContent();
        $sigHeader = $request->header('Stripe-Signature');
        $secret    = config('services.stripe.webhook_secret');

        try {
            $event = Webhook::constructEvent($payload, $sigHeader, $secret);
        } catch (SignatureVerificationException $e) {
            return response()->json(['error' => 'Invalid signature'], 400);
        }

        $obj = $event->data->object;

        try {
            switch ($event->type) {
                case 'checkout.session.completed':
                    // Defensive guard: `checkout.session.completed` fires once the customer
                    // finishes checkout, but for async payment methods that can happen BEFORE
                    // the payment actually clears (payment_status stays 'unpaid' until a later
                    // async_payment_succeeded/failed event). We only use card payments today,
                    // which settle synchronously, but never fulfill/activate anything here
                    // unless Stripe itself confirms the session is paid — matches the same
                    // check verifySession()/verifyPlanChange() already do when polled.
                    if (($obj->payment_status ?? null) !== 'paid') {
                        Log::info("Stripe webhook: checkout.session.completed sin pago confirmado (payment_status={$obj->payment_status}) para sesión {$obj->id} — no se activa nada.");
                        break;
                    }

                    // Same (array) cast bug as verifyPlanChange() — see the
                    // comment there. Here it meant the webhook always fell
                    // through to the else branch (treating a plan_change as
                    // if it were a brand-new registration) since 'action' was
                    // never actually readable.
                    $metadata = $obj->metadata ? $obj->metadata->toArray() : [];
                    if (($metadata['action'] ?? '') === 'plan_change') {
                        $this->fulfillPlanChange($obj, $metadata);
                    } elseif (($metadata['action'] ?? '') === 'extra_purchase') {
                        $this->fulfillExtraPurchase($obj, $metadata);
                    } elseif (($metadata['action'] ?? '') === 'trial_upgrade') {
                        $this->fulfillTrialUpgrade($obj, $metadata);
                    } else {
                        $this->fulfill($obj->id, $obj->customer ?? null, $obj->subscription ?? null);
                    }
                    break;
                case 'invoice.payment_succeeded':
                    $this->handlePaymentSucceeded($obj);
                    break;
                case 'invoice.payment_failed':
                    $this->handlePaymentFailed($obj);
                    break;
                case 'customer.subscription.deleted':
                    $this->handleSubscriptionDeleted($obj);
                    break;
                case 'customer.subscription.updated':
                    $this->handleSubscriptionUpdated($obj);
                    break;
            }
        } catch (\Throwable $e) {
            // Anything that escapes here means the underlying DB::transaction() (in fulfill())
            // already rolled back cleanly — nothing was left half-created. Log it clearly and
            // return 500 so Stripe retries the event on its own schedule instead of us silently
            // swallowing a failure behind a 200.
            Log::error("Stripe webhook: error procesando evento {$event->type}: " . $e->getMessage());
            return response()->json(['error' => 'Webhook processing failed'], 500);
        }

        return response()->json(['received' => true]);
    }

    // ── Verify session (polled from success page) ─────────────────────────────

    public function verifySession(Request $request)
    {
        $request->validate(['session_id' => 'required|string']);

        $this->boot();

        try {
            $session = StripeSession::retrieve($request->session_id);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Sesión no encontrada'], 404);
        }

        if ($session->payment_status !== 'paid') {
            return response()->json(['status' => 'pending'], 202);
        }

        try {
            $user = $this->fulfill(
                $session->id,
                $session->customer ?? null,
                $session->subscription ?? null
            );
        } catch (\Throwable $e) {
            // DB::transaction() inside fulfill() already rolled back cleanly on any
            // failure — nothing was left half-created. Just surface a clean error.
            Log::error("verifySession: fulfill() falló para sesión {$session->id}: " . $e->getMessage());
            return response()->json(['error' => 'No se pudo activar la cuenta'], 500);
        }

        if (! $user) {
            return response()->json(['error' => 'No se pudo activar la cuenta'], 500);
        }

        $token = $user->createToken('gemasystem')->plainTextToken;
        $user->load('gym');

        return response()->json([
            'status' => 'success',
            'user'   => [
                'id'                   => $user->id,
                'username'             => $user->username,
                'email'                => $user->email,
                'role'                 => $user->role,
                'gym_id'               => $user->gym_id,
                'plan_type'            => $user->gym?->plan_type ?? 'paid',
                'plan'                 => $user->gym?->plan ?? null,
                // Without this, a brand-new account's first session (built here,
                // right after checkout) has no plan_features at all — Sidebar.jsx/
                // App.jsx's `!== false` checks then fail OPEN and show every
                // gated feature, exactly as if the gym were on Full. See
                // AuthController::userPayload() for the normal login/me path,
                // which already sends this — this is the other place a user
                // object gets built and it drifted out of sync with it.
                'plan_features'        => $user->gym?->featureMap() ?? null,
                'onboarding_completed' => (bool) $user->onboarding_completed,
            ],
            // Same cross-site-cookie fallback as AuthController::login() — see
            // its comment. Needed here too since this also logs the user in
            // for the first time (fresh signup / reactivation after checkout).
            'token' => $token,
        ])->cookie(...AuthController::authCookie($token));
    }

    // ── Webhook handlers ──────────────────────────────────────────────────────

    private function handlePaymentSucceeded(object $invoice): void
    {
        if (!$invoice->subscription) return;

        $gym = Gym::where('stripe_subscription_id', $invoice->subscription)->first();
        if (!$gym) return;

        $this->boot();

        try {
            $sub = StripeSubscription::retrieve($invoice->subscription);

            $priceId       = $sub->items->data[0]->price->id ?? null;
            $planName      = $this->planFromPriceId($priceId);
            $period        = $this->extractSubPeriod($sub);
            $prevStatus    = $gym->billing_status; // capture before update

            // Never move subscription_ends_at backward. Stripe fires this
            // invoice.payment_succeeded event for a brand-new subscription's
            // very first invoice too, right around the same time as the
            // checkout.session.completed that fulfill() handles — and
            // fulfill()'s resubscription branch may have already stacked
            // subscription_ends_at further out than this invoice's own raw
            // period end (remaining time from the subscription it replaced).
            // Taking the later of the two keeps that stack intact instead of
            // this handler clobbering it back down. On every normal renewal
            // afterward the real period end naturally overtakes the stacked
            // date anyway, so this is a no-op once enough time has passed.
            $newEndsAt = $gym->subscription_ends_at && $period['ends_at'] && $gym->subscription_ends_at->gt($period['ends_at'])
                ? $gym->subscription_ends_at
                : $period['ends_at'];

            $gym->update([
                'billing_status'         => 'active',
                'status'                 => 'active',
                'plan'                   => $planName ?? $gym->plan,
                'subscription_starts_at' => $period['starts_at'],
                'subscription_ends_at'   => $newEndsAt,
                'last_payment_at'        => now(),
            ]);

            // Reactivate users that were auto-suspended due to billing failure
            if (in_array($prevStatus, ['payment_failed', 'payment_due', 'trial_expired'])) {
                $gym->users()->where('extended_access', 0)->update(['account_status' => 'active']);
            }

            // Send invoice receipt — skip the first charge (UserWelcome already covers it)
            $billingReason = $invoice->billing_reason ?? null;
            if ($billingReason !== 'subscription_create') {
                $user = $gym->users()->orderBy('id')->first();
                if ($user) {
                    $planLabel = $planName === 'weekly' ? 'Semanal' : 'Mensual';
                    $amount    = number_format(($invoice->amount_paid ?? 0) / 100, 2);
                    $currency  = strtoupper($invoice->currency ?? 'MXN');

                    DeferredMail::send($user->email, new InvoiceReceiptMail(
                        gymName:     $gym->name,
                        planLabel:   $planLabel,
                        amount:      $amount,
                        currency:    $currency,
                        periodStart: $period['starts_at'],
                        periodEnd:   $period['ends_at'],
                        invoiceId:   $invoice->id ?? null,
                        invoiceUrl:  $invoice->hosted_invoice_url ?? null,
                        invoicePdf:  $invoice->invoice_pdf ?? null,
                    ), "Invoice receipt email failed for gym {$gym->id}");

                    $trialPhone = TrialRequest::where('email', $user->email)->latest()->value('phone');
                    if ($trialPhone && $period['ends_at']) {
                        WhatsAppService::invoiceReceipt(
                            $trialPhone,
                            $gym->name,
                            $planLabel,
                            $amount,
                            $currency,
                            $period['ends_at']->format('d/m/Y')
                        );
                    }
                }
            }

            Log::info("Stripe: pago exitoso para gym {$gym->id} ({$gym->name}), plan={$planName}, " .
                      "vence=" . ($period['ends_at']?->toDateString() ?? 'n/a') .
                      ", motivo={$billingReason}");
        } catch (\Throwable $e) {
            Log::error("handlePaymentSucceeded error: " . $e->getMessage());
        }
    }

    private function handlePaymentFailed(object $invoice): void
    {
        if (!$invoice->subscription) return;

        $gym = Gym::where('stripe_subscription_id', $invoice->subscription)->first();
        if (!$gym) return;

        $gym->update(['billing_status' => 'payment_failed']);

        // Days of active access remaining (account stays active until subscription_ends_at)
        $suspensionDate = $gym->subscription_ends_at;
        $daysRemaining  = $suspensionDate
            ? (int) max(0, now()->diffInDays($suspensionDate, false))
            : 0;

        // Next retry scheduled by Stripe
        $nextAttempt = null;
        if (!empty($invoice->next_payment_attempt)) {
            $nextAttempt = Carbon::createFromTimestamp($invoice->next_payment_attempt);
        }

        $user = $gym->users()->orderBy('id')->first();
        if ($user) {
            $priceId   = $invoice->lines->data[0]->price->id ?? null;
            $planName  = $this->planFromPriceId($priceId) ?? $gym->plan;
            $planLabel = $planName === 'weekly' ? 'Semanal' : 'Mensual';
            $amount    = number_format(($invoice->amount_due ?? 0) / 100, 2);
            $currency  = strtoupper($invoice->currency ?? 'MXN');

            DeferredMail::send($user->email, new PaymentFailedMail(
                gymName:        $gym->name,
                planLabel:      $planLabel,
                amount:         $amount,
                currency:       $currency,
                daysRemaining:  $daysRemaining,
                suspensionDate: $suspensionDate,
                attemptCount:   (int) ($invoice->attempt_count ?? 1),
                nextAttemptDate: $nextAttempt,
            ), "Payment failed email error for gym {$gym->id}");

            $trialPhone = TrialRequest::where('email', $user->email)->latest()->value('phone');
            if ($trialPhone) {
                WhatsAppService::paymentFailed($trialPhone, $gym->name, $planLabel, $amount, $currency, $daysRemaining);
            }
        }

        Log::warning("Stripe: pago FALLIDO para gym {$gym->id} ({$gym->name}), " .
                     "días restantes={$daysRemaining}, intento={$invoice->attempt_count}");
    }

    private function handleSubscriptionDeleted(object $subscription): void
    {
        $gym = Gym::where('stripe_subscription_id', $subscription->id)->first();
        if (!$gym) return;

        $gym->update([
            'billing_status' => 'cancelled',
            'status'         => 'cancelled',
        ]);
        Log::info("Stripe: suscripción cancelada para gym {$gym->id} ({$gym->name})");
    }

    private function handleSubscriptionUpdated(object $subscription): void
    {
        $gym = Gym::where('stripe_subscription_id', $subscription->id)->first();
        if (!$gym) return;

        $priceId  = $subscription->items->data[0]->price->id ?? null;
        $planName = $this->planFromPriceId($priceId);

        // Re-retrieve to get full item data with period dates
        $full   = StripeSubscription::retrieve($subscription->id);
        $period = $this->extractSubPeriod($full);

        $updates = [
            'subscription_starts_at' => $period['starts_at'],
            'subscription_ends_at'   => $period['ends_at'],
        ];
        if ($planName) {
            $updates['plan'] = $planName;
        }

        $gym->update($updates);
    }

    // ── Fulfill checkout (new or resubscription) ──────────────────────────────

    private function fulfill(string $sessionId, ?string $stripeCustomerId, ?string $stripeSubscriptionId): ?User
    {
        // `$isNewGym` is set inside the transaction closure (by reference) so we know,
        // once it has committed, whether we need to provision a tenant DB / send the
        // welcome email — see the comment below the transaction for why that has to
        // happen *outside* of it.
        $isNewGym = false;

        $result = DB::transaction(function () use ($sessionId, $stripeCustomerId, $stripeSubscriptionId, &$isNewGym) {
            $pending = PendingCheckout::where('stripe_session_id', $sessionId)
                ->where('status', 'pending')
                ->lockForUpdate()
                ->first();

            if (! $pending) {
                $ref = PendingCheckout::where('stripe_session_id', $sessionId)->first();
                return $ref ? User::where('email', $ref->email)->first() : null;
            }

            // Resolve period dates from Stripe
            $startsAt = null;
            $endsAt   = null;
            $planName = $pending->plan_id;

            if ($stripeSubscriptionId) {
                try {
                    $this->boot();
                    $sub      = StripeSubscription::retrieve($stripeSubscriptionId);
                    $period   = $this->extractSubPeriod($sub);
                    $startsAt = $period['starts_at'];
                    $endsAt   = $period['ends_at'];
                    $priceId  = $sub->items->data[0]->price->id ?? null;
                    $planName = $this->planFromPriceId($priceId) ?? $planName;
                } catch (\Throwable $e) {
                    Log::warning("Could not retrieve Stripe subscription: " . $e->getMessage());
                }
            }

            // ── Resubscription: existing user/gym ────────────────────────────
            $existingUser = User::where('email', $pending->email)->first();

            if ($existingUser && $existingUser->gym_id) {
                $gym = Gym::find($existingUser->gym_id);

                if ($gym) {
                    $oldSubId = $gym->stripe_subscription_id;

                    // Stacking: buying a new subscription while the current one
                    // still has time left adds that remaining time on top of the
                    // fresh period, instead of just resetting the clock to the
                    // new period alone — "si tiene 1 mes activo, se suman los
                    // días que le quedan más el mes del segundo pago".
                    if ($endsAt && $gym->subscription_ends_at && $gym->subscription_ends_at->isFuture()) {
                        $remainingSeconds = now()->diffInSeconds($gym->subscription_ends_at, false);
                        if ($remainingSeconds > 0) {
                            $endsAt = $endsAt->copy()->addSeconds($remainingSeconds);
                        }
                    }

                    $gym->update([
                        'plan'                    => $planName,
                        'plan_features'           => $this->resolvePlanFeatures($planName, $pending->plan_features),
                        'stripe_customer_id'      => $stripeCustomerId ?? $gym->stripe_customer_id,
                        'stripe_subscription_id'  => $stripeSubscriptionId,
                        'status'                  => 'active',
                        'billing_status'          => 'active',
                        'subscription_starts_at'  => $startsAt,
                        'subscription_ends_at'    => $endsAt,
                        'last_payment_at'         => now(),
                    ]);

                    // The stacked time above is ours to track — Stripe itself
                    // only knows about the new period, so the OLD subscription
                    // has to be cancelled explicitly or it keeps auto-renewing
                    // and charging the card every period on top of the new one.
                    if ($oldSubId && $oldSubId !== $stripeSubscriptionId) {
                        try {
                            $this->boot();
                            StripeSubscription::cancel($oldSubId);
                        } catch (\Throwable $e) {
                            Log::warning("fulfill: no se pudo cancelar la suscripción anterior {$oldSubId} del gym {$gym->id}: " . $e->getMessage());
                        }
                    }

                    $pending->update(['status' => 'completed']);
                    Log::info("Resubscription fulfilled for gym {$gym->id} ({$gym->name}), plan={$planName}"
                        . ($oldSubId && $oldSubId !== $stripeSubscriptionId ? ", reemplaza suscripción anterior {$oldSubId}" : ''));
                    return $existingUser;
                }
            }

            // ── New gym + user ────────────────────────────────────────────────
            $gym = Gym::create([
                'name'                    => $pending->gym_name,
                'code'                    => Gym::generateUniqueCode($pending->gym_name),
                'plan'                    => $planName,
                'plan_features'           => $this->resolvePlanFeatures($planName, $pending->plan_features),
                'plan_type'               => 'paid',
                'stripe_customer_id'      => $stripeCustomerId,
                'stripe_subscription_id'  => $stripeSubscriptionId,
                'status'                  => 'active',
                'billing_status'          => 'active',
                'subscription_starts_at'  => $startsAt,
                'subscription_ends_at'    => $endsAt,
                'last_payment_at'         => now(),
            ]);

            $plainCode = $this->generateAccessCode();

            $user = User::create([
                'gym_id'               => $gym->id,
                'username'             => $pending->username,
                'first_name'           => $pending->first_name,
                'paternal_surname'     => $pending->paternal_surname,
                'maternal_surname'     => $pending->maternal_surname,
                'email'                => $pending->email,
                'password'             => $pending->password,
                'role'                 => 'admin',
                'access_code'          => Hash::make($plainCode),
                'access_code_plain'    => $plainCode,
                'access_code_changes'  => 0,
                'onboarding_completed' => false,
            ]);

            $pending->update(['status' => 'completed']);
            $isNewGym = true;

            return $user;
        });

        // `CreateGymDatabase::provision()` runs `CREATE DATABASE`/`DROP DATABASE` (DDL),
        // and MySQL implicitly commits the current transaction the instant a DDL statement
        // runs. If this ran *inside* the DB::transaction() above, the Gym/User rows just
        // created would already be permanently committed at that point — no matter what
        // failed afterward, there would be nothing left to roll back, directly violating
        // "no account gets created on any kind of failure." It also released the
        // lockForUpdate() row lock early, opening a window for a duplicate-creation race
        // between this webhook call and the frontend's verifySession() polling. Running it
        // here, only after the transaction has cleanly committed on its own, fixes both:
        // provisioning/email/WhatsApp failures are isolated and can never un-commit (or
        // partially commit) the account itself.
        if ($isNewGym && $result) {
            $gym = $result->gym;

            try {
                CreateGymDatabase::provision($gym);
            } catch (\Throwable $e) {
                Log::error("Failed to provision tenant DB for gym {$gym->id}: " . $e->getMessage());
            }

            DeferredMail::send($result->email, new UserWelcome($result, $result->access_code_plain), "Welcome email failed for user {$result->id}");

            $trialPhone = TrialRequest::where('email', $result->email)->latest()->value('phone');
            if ($trialPhone) {
                WhatsAppService::userWelcome($trialPhone, $gym->name, $result->username, $result->username);
            }
        }

        return $result;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Safely extract period start/end from a Stripe Subscription.
     * In newer Stripe API versions these live on the subscription ITEM, not on the sub itself.
     * Returns ['starts_at' => Carbon|null, 'ends_at' => Carbon|null]
     */
    private function extractSubPeriod(StripeSubscription $sub): array
    {
        // Try the subscription item first (new API), then fall back to root-level (old API)
        $item      = $sub->items->data[0] ?? null;
        $rawStart  = ($item && !empty($item->current_period_start))
            ? $item->current_period_start
            : (empty($sub->current_period_start) ? null : $sub->current_period_start);
        $rawEnd    = ($item && !empty($item->current_period_end))
            ? $item->current_period_end
            : (empty($sub->current_period_end) ? null : $sub->current_period_end);

        return [
            'starts_at' => ($rawStart && $rawStart > 0) ? Carbon::createFromTimestamp($rawStart) : null,
            'ends_at'   => ($rawEnd   && $rawEnd   > 0) ? Carbon::createFromTimestamp($rawEnd)   : null,
        ];
    }

    /**
     * What to store in gyms.plan_features for a given plan. Only 'custom'
     * actually reads this column at access-check time (Gym::hasFeature()) —
     * 'full' is stored all-true here purely so SuperAdmin's gym detail view
     * has something meaningful to display; legacy/basic store null.
     */
    private function resolvePlanFeatures(string $planName, ?array $pendingFeatures): ?array
    {
        if ($planName === 'full') {
            return array_fill_keys(Gym::GATED_FEATURES, true);
        }

        // Legacy weekly/monthly/annual: Gym::hasFeature() ignores plan_features
        // entirely for these (always true), so there's nothing meaningful to store.
        if ($planName !== 'custom' && $planName !== 'basic') {
            return null;
        }

        // 'basic' only ever gets here with real $pendingFeatures from ONE
        // place: fulfill()'s resubscription branch carrying over the extras a
        // lapsed Basic gym already had (see createResubscriptionSession) —
        // reactivating restores them for free instead of silently dropping
        // them, since the gym already paid for them once. A brand-new Basic
        // signup passes null here (Basic starts with zero extras; buying one
        // fresh is Profile.jsx's separate one-time-purchase flow, not this).
        if ($planName === 'basic' && !$pendingFeatures) {
            return null;
        }

        // Callers pass two different shapes here: fulfillPlanChange() passes
        // a plain list of selected keys (['whatsapp','products'], split from
        // Stripe metadata), while the new-registration flow passes an
        // already-built key => true map (PendingCheckout::plan_features).
        // Gym::hasFeature()/featureMap() always index by key
        // (plan_features['whatsapp'] ?? false), so either shape has to land
        // here as a map — array_values(...) === ... is the pre-8.1-safe way
        // to tell a plain list apart from an associative array (this app
        // runs PHP 8.0 in production; array_is_list() isn't available).
        $features = $pendingFeatures ?? [];
        $keys     = array_values($features) === $features ? $features : array_keys($features);

        return array_fill_keys($keys, true);
    }

    private function priceKey(string $planId): string
    {
        return match ($planId) {
            'weekly'  => 'price_weekly',
            'monthly' => 'price_monthly',
            'basic'   => 'price_basic',
            'full'    => 'price_full',
            default   => 'price_monthly',
        };
    }

    /**
     * Builds the Stripe Checkout Session line item for a plan. Basic/Full use
     * their fixed, manually-created Stripe Price. Custom has no static Price —
     * its amount is computed server-side from config/plans.php (never trust a
     * client-submitted price) and sent inline as price_data; Stripe auto-
     * creates a one-off Price behind the scenes for it.
     */
    private function lineItemFor(string $planId, ?array $features): array
    {
        if ($planId !== 'custom') {
            return ['price' => config('services.stripe.' . $this->priceKey($planId)), 'quantity' => 1];
        }

        $amount = (int) config('plans.basic.price');
        foreach ($features ?? [] as $key) {
            $amount += (int) (config("plans.addons.{$key}.price") ?? 0);
        }

        return [
            'price_data' => [
                'currency'    => config('plans.currency', 'mxn'),
                'product'     => config('services.stripe.product_custom'),
                'unit_amount' => $amount * 100, // pesos → centavos
                'recurring'   => ['interval' => 'month'],
            ],
            'quantity' => 1,
        ];
    }

    private function planFromPriceId(?string $priceId): ?string
    {
        if (!$priceId) return null;
        if ($priceId === config('services.stripe.price_weekly'))  return 'weekly';
        if ($priceId === config('services.stripe.price_monthly')) return 'monthly';
        if ($priceId === config('services.stripe.price_basic'))   return 'basic';
        if ($priceId === config('services.stripe.price_full'))    return 'full';
        // 'custom' has no static price id — it's built inline via price_data at
        // checkout time, so Stripe auto-creates a one-off Price with no entry
        // here. Callers all fall back to the gym's existing ->plan when this
        // returns null, which is exactly right for custom (never overwritten).
        return null;
    }

    private function generateAccessCode(): string
    {
        $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        $code  = '';
        for ($i = 0; $i < 12; $i++) {
            $code .= $chars[random_int(0, strlen($chars) - 1)];
        }
        return $code;
    }
}
