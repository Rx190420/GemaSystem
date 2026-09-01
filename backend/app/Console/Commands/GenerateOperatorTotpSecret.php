<?php

namespace App\Console\Commands;

use App\Support\Totp;
use Illuminate\Console\Command;

/**
 * One-off setup helper: generates a fresh TOTP secret for the operator
 * console's second login factor and prints everything needed to link it —
 * the raw secret (type it into an authenticator app as a "manual setup
 * key") and the otpauth:// URI (for anything that accepts pasting/importing
 * that instead of a QR scan). Nothing is stored automatically — copy the
 * secret into OPERATOR_TOTP_SECRET in Railway's env vars yourself, same as
 * OPERATOR_PIN was set before.
 */
class GenerateOperatorTotpSecret extends Command
{
    protected $signature = 'operator:totp-secret {--label=Console : Account label shown in the authenticator app}';

    protected $description = 'Generate a new TOTP secret for the operator console login and print the setup key';

    public function handle(): int
    {
        $secret = Totp::generateSecret();
        $uri    = Totp::provisioningUri($secret, $this->option('label'), 'GemaSystem');

        $this->newLine();
        $this->line('  <fg=yellow>⚠ Guarda esto ahora — no se vuelve a mostrar.</>');
        $this->newLine();
        $this->line("  Clave para vincular (entrada manual):");
        $this->line("  <fg=green>{$secret}</>");
        $this->newLine();
        $this->line('  URI (otpauth://) por si tu app deja pegarla/importarla en vez de escribir la clave:');
        $this->line("  <fg=cyan>{$uri}</>");
        $this->newLine();
        $this->line('  Siguiente paso: copia la clave a la variable OPERATOR_TOTP_SECRET en Railway.');
        $this->newLine();

        // Prove the secret actually round-trips before the operator wires it
        // up somewhere they can't easily debug — a broken base32 encode/decode
        // would otherwise only surface as "código inválido" at login time.
        $testCode = Totp::generateCode($secret);
        $ok       = Totp::verify($secret, $testCode);
        $this->line($ok
            ? "  <fg=green>✓</> Verificado — código de prueba para ahora mismo: <fg=green>{$testCode}</>"
            : '  <fg=red>✗ Algo salió mal generando el secreto — vuelve a correr el comando.</>');
        $this->newLine();

        return self::SUCCESS;
    }
}
