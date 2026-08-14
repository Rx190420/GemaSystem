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
use App\Services\RecaptchaService;
use App\Services\WhatsAppService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Stripe\Checkout\Session as StripeSession;
use Stripe\Exception\SignatureVerificationException;
use Stripe\Stripe;
use Stripe\Subscription as StripeSubscription;
use Stripe\Webhook;

class StripeController extends Controller
{
    private const PRICE_IDS = [
        'weekly'  => 'STRIPE_PRICE_WEEKLY',
        'monthly' => 'STRIPE_PRICE_MONTHLY',
    ];

    private function boot(): void
    {
        Stripe::setApiKey(config('services.stripe.secret'));
    }

    // ── New checkout (first-time or resubscription) ───────────────────────────

    public function createCheckoutSession(Request $request)
    {
        $request->validate([
            'plan_id'         => 'required|in:weekly,monthly',
            'email'           => 'required|email|max:150',
            'password'        => 'required|string|max:255',
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

            // Only allow resubscription if subscription is expired/cancelled/failed
            if ($gym && !in_array($gym->billing_status, ['payment_failed', 'cancelled', 'none', 'payment_due', 'trial_expired'])) {
                return response()->json([
                    'message' => 'Tu suscripción ya está activa. Usa "Cambiar plan" desde el panel.',
                ], 422);
            }

            return $this->createResubscriptionSession($existingUser, $gym, $planId);
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
        ]);

        if (! RecaptchaService::verify($request->recaptcha_token, $request->ip())) {
            return response()->json(['message' => 'No pudimos verificar que eres humano. Intenta de nuevo.'], 422);
        }

        $pending = PendingCheckout::create([
            'gym_name'         => $request->gym_name,
            'first_name'       => $request->first_name,
            'paternal_surname' => $request->paternal_surname,
            'maternal_surname' => $request->maternal_surname,
            'username'         => $request->username,
            'email'            => $email,
            'password'         => Hash::make($password),
            'plan_id'          => $planId,
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
                'line_items'           => [['price' => config('services.stripe.' . $this->priceKey($planId)), 'quantity' => 1]],
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

    // ── Resubscription for existing user ─────────────────────────────────────

    private function createResubscriptionSession(User $user, ?Gym $gym, string $planId): \Illuminate\Http\JsonResponse
    {
        $this->boot();
        $frontendUrl = env('APP_FRONTEND_URL', 'http://localhost:5173');

        $pending = PendingCheckout::create([
            'gym_name' => $gym?->name ?? $user->username,
            'username' => $user->username,
            'email'    => $user->email,
            'password' => $user->password,
            'plan_id'  => $planId,
            'status'   => 'pending',
        ]);

        $sessionParams = [
            'mode'                 => 'subscription',
            'payment_method_types' => ['card'],
            'line_items'           => [['price' => config('services.stripe.' . $this->priceKey($planId)), 'quantity' => 1]],
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
        $request->validate(['plan_id' => 'required|in:weekly,monthly']);

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

        $sessionParams = [
            'mode'                 => 'subscription',
            'payment_method_types' => ['card'],
            'line_items'           => [['price' => config('services.stripe.' . $this->priceKey($request->plan_id)), 'quantity' => 1]],
            'success_url'          => $frontendUrl . '/checkout/success?session_id={CHECKOUT_SESSION_ID}&type=plan_change',
            'cancel_url'           => $frontendUrl . '/',
            'metadata'             => [
                'action'           => 'plan_change',
                'gym_id'           => (string) $gym->id,
                'new_plan'         => $request->plan_id,
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

        $metadata = (array) ($session->metadata ?? []);
        $this->fulfillPlanChange($session, $metadata);

        return response()->json(['status' => 'success']);
    }

    private function fulfillPlanChange(object $session, array $metadata): void
    {
        $gymId    = $metadata['gym_id']           ?? null;
        $newPlan  = $metadata['new_plan']          ?? null;
        $oldSubId = $metadata['old_subscription']  ?? null;

        if (!$gymId) return;

        $gym = Gym::find($gymId);
        if (!$gym) return;

        $newSubId = $session->subscription ?? null;
        if (!$newSubId) return;

        // Idempotent — webhook and polling may both call this
        if ($gym->stripe_subscription_id === $newSubId) return;

        try {
            $sub      = StripeSubscription::retrieve($newSubId);
            $period   = $this->extractSubPeriod($sub);
            $priceId  = $sub->items->data[0]->price->id ?? null;
            $planName = $this->planFromPriceId($priceId) ?? $newPlan;

            $gym->update([
                'plan'                   => $planName,
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
        } catch (\Throwable $e) {
            Log::error("fulfillPlanChange error for gym {$gymId}: " . $e->getMessage());
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

                    $metadata = (array) ($obj->metadata ?? []);
                    if (($metadata['action'] ?? '') === 'plan_change') {
                        $this->fulfillPlanChange($obj, $metadata);
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
                'onboarding_completed' => (bool) $user->onboarding_completed,
            ],
        ])->cookie(
            'gemasystem_token', $token,
            0, '/', null,
            (bool) env('SESSION_SECURE_COOKIE', false),
            true, false, 'Lax'
        );
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

            $gym->update([
                'billing_status'         => 'active',
                'status'                 => 'active',
                'plan'                   => $planName ?? $gym->plan,
                'subscription_starts_at' => $period['starts_at'],
                'subscription_ends_at'   => $period['ends_at'],
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

                    try {
                        Mail::to($user->email)->send(new InvoiceReceiptMail(
                            gymName:     $gym->name,
                            planLabel:   $planLabel,
                            amount:      $amount,
                            currency:    $currency,
                            periodStart: $period['starts_at'],
                            periodEnd:   $period['ends_at'],
                            invoiceId:   $invoice->id ?? null,
                            invoiceUrl:  $invoice->hosted_invoice_url ?? null,
                            invoicePdf:  $invoice->invoice_pdf ?? null,
                        ));
                    } catch (\Throwable $e) {
                        Log::warning("Invoice receipt email failed for gym {$gym->id}: " . $e->getMessage());
                    }

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

            try {
                Mail::to($user->email)->send(new PaymentFailedMail(
                    gymName:        $gym->name,
                    planLabel:      $planLabel,
                    amount:         $amount,
                    currency:       $currency,
                    daysRemaining:  $daysRemaining,
                    suspensionDate: $suspensionDate,
                    attemptCount:   (int) ($invoice->attempt_count ?? 1),
                    nextAttemptDate: $nextAttempt,
                ));
            } catch (\Throwable $e) {
                Log::warning("Payment failed email error for gym {$gym->id}: " . $e->getMessage());
            }

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
                    $gym->update([
                        'plan'                    => $planName,
                        'stripe_customer_id'      => $stripeCustomerId ?? $gym->stripe_customer_id,
                        'stripe_subscription_id'  => $stripeSubscriptionId,
                        'status'                  => 'active',
                        'billing_status'          => 'active',
                        'subscription_starts_at'  => $startsAt,
                        'subscription_ends_at'    => $endsAt,
                        'last_payment_at'         => now(),
                    ]);

                    $pending->update(['status' => 'completed']);
                    Log::info("Resubscription fulfilled for gym {$gym->id} ({$gym->name}), plan={$planName}");
                    return $existingUser;
                }
            }

            // ── New gym + user ────────────────────────────────────────────────
            $gym = Gym::create([
                'name'                    => $pending->gym_name,
                'code'                    => Gym::generateUniqueCode($pending->gym_name),
                'plan'                    => $planName,
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

            try {
                Mail::to($result->email)->send(new UserWelcome($result, $result->access_code_plain));
            } catch (\Throwable $e) {
                Log::warning("Welcome email failed for user {$result->id}: " . $e->getMessage());
            }

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

    private function priceKey(string $planId): string
    {
        return match ($planId) {
            'weekly'  => 'price_weekly',
            'monthly' => 'price_monthly',
            default   => 'price_monthly',
        };
    }

    private function planFromPriceId(?string $priceId): ?string
    {
        if (!$priceId) return null;
        $weekly  = config('services.stripe.price_weekly');
        $monthly = config('services.stripe.price_monthly');
        if ($priceId === $weekly)  return 'weekly';
        if ($priceId === $monthly) return 'monthly';
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
