<?php

namespace App\Http\Controllers;

use App\Mail\UserWelcome;
use App\Models\Gym;
use App\Models\Setting;
use App\Models\User;
use App\Scopes\GymScope;
use App\Support\Totp;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $request->validate([
            'login'    => 'required|string',
            'password' => 'required|string',
        ]);

        $field = filter_var($request->login, FILTER_VALIDATE_EMAIL) ? 'email' : 'username';
        $user  = User::where($field, $request->login)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages([
                'login' => ['Las credenciales no son correctas.'],
            ]);
        }

        // Operator accounts need PIN verification as a second step
        if ((int) $user->getRawOriginal('extended_access') === 1) {
            return response()->json(['requires_pin' => true]);
        }

        // Loaded up front (used to be re-fetched further down, and never
        // reached the two generic 'suspended'/'restricted' blocks at all)
        // so every account_blocked response below — not just the
        // billing-derived ones — can identify which gym this actually is.
        $gym = $user->gym;

        // Block suspended / restricted accounts
        $status = $user->account_status ?? 'active';
        if ($status === 'suspended') {
            // If the gym was auto-suspended due to billing, surface the billing block type
            // so the frontend shows the payment/reactivation screen instead of "admin suspended".
            if ($gym && in_array($gym->billing_status, ['trial_expired', 'payment_due'])) {
                $blockType = $gym->billing_status;
                return response()->json([
                    'account_blocked'   => true,
                    'block_type'        => $blockType,
                    'message'           => $blockType === 'trial_expired'
                        ? 'Tu período de prueba gratuito ha terminado.'
                        : 'El acceso está suspendido por falta de pago.',
                    'subscription_ends' => $gym->subscription_ends_at?->toDateString(),
                    'plan'              => $gym->plan,
                    'gym_name'          => $gym->name,
                    'email'             => $user->email,
                ], 403);
            }

            return response()->json([
                'account_blocked' => true,
                'block_type'      => 'suspended',
                'message'         => 'Tu cuenta ha sido suspendida.',
                'reason'          => $user->restriction_reason ?? null,
                'gym_name'        => $gym?->name,
            ], 403);
        }
        if ($status === 'restricted') {
            return response()->json([
                'account_blocked' => true,
                'block_type'      => 'restricted',
                'message'         => 'Tu cuenta tiene acceso restringido.',
                'reason'          => $user->restriction_reason ?? null,
                'gym_name'        => $gym?->name,
            ], 403);
        }

        // ── Lazy expiry: auto-suspend on login based on subscription_ends_at ──────

        if ($gym && $gym->status !== 'suspended') {
            // Free trial expired
            if ($gym->isTrialExpired()) {
                $gym->update(['status' => 'suspended', 'billing_status' => 'trial_expired']);
                return response()->json([
                    'account_blocked'   => true,
                    'block_type'        => 'trial_expired',
                    'message'           => 'Tu período de prueba gratuito ha terminado.',
                    'subscription_ends' => $gym->subscription_ends_at?->toDateString(),
                    'gym_name'          => $gym->name,
                    'email'             => $user->email,
                ], 403);
            }

            // Paid subscription expired (subscription_ends_at passed + 2h grace)
            if ($gym->isSubscriptionExpired()) {
                $gym->update(['status' => 'suspended', 'billing_status' => 'payment_due']);
                return response()->json([
                    'account_blocked'   => true,
                    'block_type'        => 'payment_due',
                    'message'           => 'El acceso está suspendido por falta de pago.',
                    'subscription_ends' => $gym->subscription_ends_at?->toDateString(),
                    'plan'              => $gym->plan,
                    'gym_name'          => $gym->name,
                    'email'             => $user->email,
                ], 403);
            }
        }

        // Block already-suspended gyms
        if ($gym && $gym->isBillingBlocked()) {
            // A trial gym (plan_type='free') sitting on billing_status='payment_due'
            // isn't a lapsed payer reactivating — it's SuperAdminController::
            // convertTrialToPaid() having just fixed `plan`/`plan_features` to
            // whatever the operator chose and expired the trial on purpose, to
            // gate login behind a single "pay this exact plan" screen instead
            // of the self-service weekly/monthly picker trial_expired/payment_due
            // show below. Same billing_status value, different plan_type — no
            // new column, no CHECK constraint migration needed to add a state.
            if ($gym->plan_type === 'free' && $gym->billing_status === 'payment_due') {
                return response()->json([
                    'account_blocked' => true,
                    'block_type'      => 'upgrade_pending',
                    'message'         => 'Tu gimnasio ahora forma parte de un plan de pago. Completa el pago para activar tu cuenta.',
                    'plan'            => $gym->plan,
                    'plan_features'   => $gym->plan_features,
                    'amount'          => $this->planAmount($gym->plan, $gym->plan_features),
                    'gym_name'        => $gym->name,
                    'email'           => $user->email,
                ], 403);
            }

            $blockType = $gym->billing_status === 'trial_expired' ? 'trial_expired' : 'payment_due';
            return response()->json([
                'account_blocked'   => true,
                'block_type'        => $blockType,
                'message'           => $blockType === 'trial_expired'
                    ? 'Tu período de prueba gratuito ha terminado.'
                    : 'El acceso está suspendido por falta de pago.',
                'subscription_ends' => $gym->subscription_ends_at?->toDateString(),
                'plan'              => $gym->plan,
                'gym_name'          => $gym->name,
                'email'             => $user->email,
            ], 403);
        }

        // If user has an access code AND the gym hasn't turned the feature
        // off, require it. Gyms get it enabled by default (a real security
        // step, not just a per-user preference) — disabling it in Settings
        // is an explicit opt-out, not the default state.
        if ($user->access_code !== null && (!$gym || $this->accessCodeRequired($gym))) {
            if (!$request->filled('access_code')) {
                return response()->json(['requires_code' => true], 200);
            }
            if (!Hash::check($request->access_code, $user->access_code)) {
                throw ValidationException::withMessages([
                    'access_code' => ['El código de acceso es incorrecto.'],
                ]);
            }
        }

        $user->update(['last_login' => now()]);

        $token = $user->createToken('auth-token', ['*'])->plainTextToken;

        // The cookie is the primary carrier (HttpOnly — a same-site XSS can't
        // read it) and works fine for most browsers. But it's a cross-site
        // cookie (frontend and API live on different domains), and mobile
        // Safari/Chrome increasingly block those outright — the request
        // still reaches the server, the Set-Cookie header still arrives, the
        // browser just never persists or resends it, so every request after
        // login 401s and the SPA bounces straight back to the login screen.
        // Sending the token in the body too lets the frontend attach it
        // itself as `Authorization: Bearer` (see api/axios.js) — a plain
        // header isn't a cookie and isn't subject to any of that, so it
        // keeps working even where the cookie silently doesn't. Purely
        // additive: TokenFromCookie only fills the header when the request
        // didn't already carry one, so nothing changes for clients that
        // still get the cookie fine.
        return response()->json(['user' => $this->userPayload($user), 'token' => $token])
            ->cookie(...self::authCookie($token));
    }

    /**
     * Whether this gym has the "require access code at login" setting on
     * (the `require_access_code` key in `settings`). Defaults to enabled —
     * a gym that never touched this in Settings still gets the security
     * step for any user who's set an access code; only an explicit "off"
     * skips it.
     *
     * Can't reuse SetTenantDatabase/the 'gym.plan' app instance here:
     * both depend on Auth::guard('sanctum')->user(), which is still null at
     * this point in login() — there's no session yet, we're creating one.
     * So for paid gyms this resolves the tenant connection itself, same
     * logic SetTenantDatabase would apply once a session exists.
     */
    private function accessCodeRequired(Gym $gym): bool
    {
        if ($gym->plan_type === 'paid' && $gym->db_name) {
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
            $value = DB::connection('tenant')->table('settings')->where('key', 'require_access_code')->value('value');
        } else {
            $value = Setting::withoutGlobalScope(GymScope::class)
                ->where('gym_id', $gym->id)
                ->where('key', 'require_access_code')
                ->value('value');
        }

        return $value === null ? true : $value !== '0';
    }

    // ── Operator-only login (separate endpoint, requires PIN) ─────────────────

    public function operatorLogin(Request $request)
    {
        $request->validate([
            'login'    => 'required|string',
            'password' => 'required|string',
            'pin'      => 'required|string',
        ]);

        // TOTP code from a real authenticator app (Google Authenticator, Authy,
        // etc.) instead of a static PIN — see App\Support\Totp and the
        // `operator:totp-secret` artisan command that generates the secret.
        $secret = config('app.operator_totp_secret', '');
        if (!Totp::verify($secret, (string) $request->pin)) {
            throw ValidationException::withMessages([
                'pin' => ['Código inválido.'],
            ]);
        }

        $field = filter_var($request->login, FILTER_VALIDATE_EMAIL) ? 'email' : 'username';
        $user  = User::where($field, $request->login)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages([
                'login' => ['Las credenciales no son correctas.'],
            ]);
        }

        if ((int) $user->getRawOriginal('extended_access') !== 1) {
            throw ValidationException::withMessages([
                'login' => ['Las credenciales no son correctas.'],
            ]);
        }

        $user->update(['last_login' => now()]);

        $token = $user->createToken('auth-token', ['*', 'operator'])->plainTextToken;

        // See the comment in login() above — same cross-site-cookie fallback.
        return response()->json(['user' => $this->userPayload($user), 'is_operator' => true, 'token' => $token])
            ->cookie(...self::authCookie($token));
    }

    // ── Live availability check for the signup form ───────────────────────────
    // Public + unauthenticated by necessity (fires as the user types, before any
    // account exists), so it's deliberately minimal: no password/user details in
    // the response, just a boolean, and it's rate-limited hard (see routes/api.php)
    // since it's effectively an oracle for "does this email/username exist" —
    // the same fact the full registration flow already discloses today (a
    // registered email + wrong password reaches a distinct error), just faster
    // to query. The throttle keeps it from being scraped at volume.
    public function checkAvailability(Request $request)
    {
        $request->validate([
            'field' => 'required|in:username,email',
            'value' => 'required|string|max:150',
        ]);

        $value = trim($request->value);

        if ($request->field === 'email') {
            if (! filter_var($value, FILTER_VALIDATE_EMAIL)) {
                return response()->json(['available' => null]);
            }
            $taken = User::where('email', $value)->exists();
        } else {
            if (mb_strlen($value) < 3) {
                return response()->json(['available' => null]);
            }
            $taken = User::where('username', $value)->exists();
        }

        return response()->json(['available' => ! $taken]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();
        return response()->json(['message' => 'Sesión cerrada correctamente.'])
            ->withoutCookie('gemasystem_token');
    }

    public function me(Request $request)
    {
        return response()->json($this->userPayload($request->user()));
    }

    public function completeOnboarding(Request $request)
    {
        $request->user()->update(['onboarding_completed' => true]);
        return response()->json(['message' => 'Onboarding completado.']);
    }

    /**
     * Parámetros de la cookie de autenticación.
     * lifetime=0 → cookie de sesión (se borra al cerrar el navegador).
     *
     * Frontend (Vercel) y backend (Railway) viven en dominios distintos, así
     * que esto es una petición cross-site, no solo cross-origin. Una cookie
     * SameSite=Lax (o Strict) nunca se envía en un fetch/XHR cross-site —
     * solo en navegaciones de nivel superior — así que el login parecía
     * funcionar (el Set-Cookie sí llega) pero la siguiente petición ya no la
     * incluía, dando 401 y deslogueando al instante. SameSite=None es la
     * única opción que un navegador acepta ahí, y None exige Secure=true
     * (por eso va atado a la misma env var, no a 'Strict' como antes).
     */
    public static function authCookie(string $token): array
    {
        $secure = (bool) env('SESSION_SECURE_COOKIE', false);

        return [
            'gemasystem_token',
            $token,
            0,      // lifetime en minutos (0 = session cookie)
            '/',
            null,
            $secure,
            true,   // HttpOnly
            false,
            $secure ? 'None' : 'Lax',
        ];
    }

    private function userPayload(User $user): array
    {
        $user->loadMissing('gym');
        return [
            'id'                    => $user->id,
            'username'              => $user->username,
            'full_name'             => $user->full_name,
            'first_name'            => $user->first_name,
            'paternal_surname'      => $user->paternal_surname,
            'maternal_surname'      => $user->maternal_surname,
            'email'                 => $user->email,
            'role'                  => $user->role,
            'gym_id'                => $user->gym_id,
            'gym_name'              => $user->gym?->name ?? null,
            'plan_type'             => $user->gym?->plan_type ?? null,
            'plan'                  => $user->gym?->plan ?? null,
            // Feature-key => bool map (whatsapp/products/classes/import/export) —
            // Sidebar.jsx/App.jsx gate nav+routes off this instead of
            // reimplementing Gym::hasFeature()'s legacy/basic/full/custom logic.
            'plan_features'         => $user->gym?->featureMap() ?? null,
            'billing_status'        => $user->gym?->billing_status ?? null,
            'subscription_starts_at'=> $user->gym?->subscription_starts_at?->toIso8601String() ?? null,
            'subscription_ends_at'  => $user->gym?->subscription_ends_at?->toIso8601String() ?? null,
            'last_payment_at'       => $user->gym?->last_payment_at?->toIso8601String() ?? null,
            'member_since'          => $user->created_at->toIso8601String(),
            'onboarding_completed'  => (bool) $user->onboarding_completed,
        ];
    }

    /**
     * MXN total for a plan — same pricing config/math as
     * StripeController::lineItemFor()'s 'custom' branch, duplicated here in
     * plain-number form (no Stripe price id involved) because this only
     * needs to show a total on the "upgrade_pending" blocked-login screen,
     * not build a Checkout line item.
     */
    private function planAmount(?string $plan, ?array $features): int
    {
        if ($plan === 'basic') return (int) config('plans.basic.price');
        if ($plan === 'full')  return (int) config('plans.full.price');

        $amount = (int) config('plans.basic.price');
        foreach (array_keys(array_filter($features ?? [])) as $key) {
            $amount += (int) (config("plans.addons.{$key}.price") ?? 0);
        }
        return $amount;
    }
}
