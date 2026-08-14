<?php

namespace App\Http\Controllers;

use App\Mail\PasswordResetCodeMail;
use App\Models\PasswordResetCode;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\Rules\Password;

class PasswordResetController extends Controller
{
    // ── Public: Forgot password ───────────────────────────────────────────────

    /** Step 1: send a 6-digit code to the email */
    public function sendCode(Request $request)
    {
        $request->validate(['email' => 'required|email']);

        $user = User::where('email', $request->email)->first();

        // Always respond OK to prevent user enumeration
        if (!$user) {
            return response()->json(['message' => 'Si el correo existe, recibirás el código en unos segundos.']);
        }

        // Invalidate old codes for this email
        PasswordResetCode::where('email', $request->email)->update(['used' => true]);

        $code = $this->generateCode();

        PasswordResetCode::create([
            'email'      => $request->email,
            'code'       => $code,
            'expires_at' => now()->addMinutes(15),
        ]);

        try {
            Mail::to($user->email)->send(new PasswordResetCodeMail($code, $user->username, false));
        } catch (\Throwable $e) {
            \Log::warning("PasswordReset email failed for {$user->email}: " . $e->getMessage());
        }

        return response()->json(['message' => 'Si el correo existe, recibirás el código en unos segundos.']);
    }

    /** Step 2: verify code + set new password */
    public function resetPassword(Request $request)
    {
        $request->validate([
            'email'    => 'required|email',
            'code'     => 'required|string|size:6',
            'password' => ['required', 'confirmed', $this->passwordRules()],
        ]);

        $entry = PasswordResetCode::where('email', $request->email)
            ->where('code', $request->code)
            ->where('used', false)
            ->latest()
            ->first();

        if (!$entry || !$entry->isValid()) {
            return response()->json(['message' => 'El código es incorrecto o ha expirado.'], 422);
        }

        $user = User::where('email', $request->email)->first();
        if (!$user) {
            return response()->json(['message' => 'Usuario no encontrado.'], 404);
        }

        // Revoke all tokens (force re-login)
        $user->tokens()->delete();
        $user->update(['password' => Hash::make($request->password)]);
        $entry->update(['used' => true]);

        return response()->json(['message' => 'Contraseña actualizada. Ya puedes iniciar sesión con tu nueva contraseña.']);
    }

    // ── Authenticated: Change password from profile ───────────────────────────

    /** Send a verification code to the authenticated user's email */
    public function sendChangeCode(Request $request)
    {
        $user = auth()->user();

        PasswordResetCode::where('email', $user->email)->update(['used' => true]);

        $code = $this->generateCode();

        PasswordResetCode::create([
            'email'      => $user->email,
            'code'       => $code,
            'expires_at' => now()->addMinutes(15),
        ]);

        try {
            Mail::to($user->email)->send(new PasswordResetCodeMail($code, $user->username, true));
        } catch (\Throwable $e) {
            \Log::warning("PasswordChange email failed for {$user->email}: " . $e->getMessage());
            return response()->json(['message' => 'No se pudo enviar el correo. Intenta de nuevo.'], 500);
        }

        return response()->json(['message' => "Código enviado a {$user->email}. Válido por 15 minutos."]);
    }

    /** Verify code + change password (authenticated) */
    public function confirmChange(Request $request)
    {
        $request->validate([
            'code'     => 'required|string|size:6',
            'password' => ['required', 'confirmed', $this->passwordRules()],
        ]);

        $user  = auth()->user();
        $entry = PasswordResetCode::where('email', $user->email)
            ->where('code', $request->code)
            ->where('used', false)
            ->latest()
            ->first();

        if (!$entry || !$entry->isValid()) {
            return response()->json(['message' => 'El código es incorrecto o ha expirado.'], 422);
        }

        // Revoke all other tokens (keep current session)
        $currentTokenId = $request->user()->currentAccessToken()->id;
        $user->tokens()->where('id', '!=', $currentTokenId)->delete();
        $user->update(['password' => Hash::make($request->password)]);
        $entry->update(['used' => true]);

        return response()->json(['message' => 'Contraseña actualizada correctamente.']);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function generateCode(): string
    {
        return str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    }

    public static function passwordRules(): Password
    {
        return Password::min(8)
            ->mixedCase()   // uppercase + lowercase
            ->numbers()     // at least 1 number
            ->symbols();    // at least 1 special character
    }
}
