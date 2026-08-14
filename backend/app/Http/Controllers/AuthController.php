<?php

namespace App\Http\Controllers;

use App\Mail\UserWelcome;
use App\Models\User;
use Illuminate\Http\Request;
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

        // Block suspended / restricted accounts
        $status = $user->account_status ?? 'active';
        if ($status === 'suspended') {
            // If the gym was auto-suspended due to billing, surface the billing block type
            // so the frontend shows the payment/reactivation screen instead of "admin suspended".
            $gym = $user->gym;
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
                    'email'             => $user->email,
                ], 403);
            }

            return response()->json([
                'account_blocked' => true,
                'block_type'      => 'suspended',
                'message'         => 'Tu cuenta ha sido suspendida.',
                'reason'          => $user->restriction_reason ?? null,
            ], 403);
        }
        if ($status === 'restricted') {
            return response()->json([
                'account_blocked' => true,
                'block_type'      => 'restricted',
                'message'         => 'Tu cuenta tiene acceso restringido.',
                'reason'          => $user->restriction_reason ?? null,
            ], 403);
        }

        // ── Lazy expiry: auto-suspend on login based on subscription_ends_at ──────
        $gym = $user->gym;

        if ($gym && $gym->status !== 'suspended') {
            // Free trial expired
            if ($gym->isTrialExpired()) {
                $gym->update(['status' => 'suspended', 'billing_status' => 'trial_expired']);
                return response()->json([
                    'account_blocked'   => true,
                    'block_type'        => 'trial_expired',
                    'message'           => 'Tu período de prueba gratuito ha terminado.',
                    'subscription_ends' => $gym->subscription_ends_at?->toDateString(),
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
                    'email'             => $user->email,
                ], 403);
            }
        }

        // Block already-suspended gyms
        if ($gym && $gym->isBillingBlocked()) {
            $blockType = $gym->billing_status === 'trial_expired' ? 'trial_expired' : 'payment_due';
            return response()->json([
                'account_blocked'   => true,
                'block_type'        => $blockType,
                'message'           => $blockType === 'trial_expired'
                    ? 'Tu período de prueba gratuito ha terminado.'
                    : 'El acceso está suspendido por falta de pago.',
                'subscription_ends' => $gym->subscription_ends_at?->toDateString(),
                'plan'              => $gym->plan,
                'email'             => $user->email,
            ], 403);
        }

        // If user has an access code, require it
        if ($user->access_code !== null) {
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

        return response()->json(['user' => $this->userPayload($user)])
            ->cookie(...self::authCookie($token));
    }

    // ── Operator-only login (separate endpoint, requires PIN) ─────────────────

    public function operatorLogin(Request $request)
    {
        $request->validate([
            'login'    => 'required|string',
            'password' => 'required|string',
            'pin'      => 'required|string',
        ]);

        // Constant-time comparison to prevent timing attacks
        $expectedPin = config('app.operator_pin', '');
        if (!hash_equals($expectedPin, $request->pin) || empty($expectedPin)) {
            throw ValidationException::withMessages([
                'pin' => ['Acceso denegado.'],
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

        return response()->json(['user' => $this->userPayload($user), 'is_operator' => true])
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
     */
    private static function authCookie(string $token): array
    {
        return [
            'gemasystem_token',
            $token,
            0,      // lifetime en minutos (0 = session cookie)
            '/',
            null,
            (bool) env('SESSION_SECURE_COOKIE', false),
            true,   // HttpOnly
            false,
            (bool) env('SESSION_SECURE_COOKIE', false) ? 'Strict' : 'Lax',
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
            'billing_status'        => $user->gym?->billing_status ?? null,
            'subscription_starts_at'=> $user->gym?->subscription_starts_at?->toIso8601String() ?? null,
            'subscription_ends_at'  => $user->gym?->subscription_ends_at?->toIso8601String() ?? null,
            'last_payment_at'       => $user->gym?->last_payment_at?->toIso8601String() ?? null,
            'member_since'          => $user->created_at->toIso8601String(),
            'onboarding_completed'  => (bool) $user->onboarding_completed,
        ];
    }
}
