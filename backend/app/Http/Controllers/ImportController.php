<?php

namespace App\Http\Controllers;

use App\Models\Member;
use App\Models\Membership;
use App\Models\Trainer;
use App\Services\MemberCodeService;
use Carbon\Carbon;
use Illuminate\Http\Request;

class ImportController extends Controller
{
    // Above this fraction of suspicious/malformed cells, the whole file is rejected
    // instead of silently importing whatever looks clean out of a mostly-bad file.
    private const MAX_RISK_RATIO = 0.5;

    // POST /api/import
    public function import(Request $request)
    {
        $request->validate([
            'entity'  => 'required|in:members,trainers,memberships',
            'records' => 'required|array|min:1|max:500',
        ]);

        $entity  = $request->input('entity');
        $records = $request->input('records');

        if ($this->scanRisk($records) > self::MAX_RISK_RATIO) {
            return response()->json([
                'message' => 'El archivo tiene demasiadas celdas con contenido sospechoso o mal formado (posible contenido malicioso). Revísalo e inténtalo de nuevo.',
            ], 422);
        }

        $result = match ($entity) {
            'members'     => $this->importMembers($records),
            'trainers'    => $this->importTrainers($records),
            'memberships' => $this->importMemberships($records),
        };

        return response()->json($result);
    }

    // POST /api/import/check — bulk existence check, no writes. Lets the UI show
    // "ya existe" vs "nuevo" per row before the user commits to importing.
    public function check(Request $request)
    {
        $request->validate([
            'entity'  => 'required|in:members,trainers,memberships',
            'records' => 'required|array|min:1|max:500',
        ]);

        $entity     = $request->input('entity');
        $records    = $request->input('records');
        $modelClass = $entity === 'trainers' ? Trainer::class : Member::class;

        $emails = [];
        $phones = [];
        foreach ($records as $row) {
            $row   = array_change_key_case((array) $row, CASE_LOWER);
            $email = trim((string) ($row['email'] ?? ''));
            $phone = trim((string) ($row['telefono'] ?? ''));
            if ($email) $emails[] = strtolower($email);
            if ($phone) $phones[] = $phone;
        }

        $existingEmails = $emails
            ? $modelClass::whereIn('email', array_unique($emails))->pluck('email')->map(fn ($e) => strtolower($e))->all()
            : [];
        $existingPhones = $phones
            ? $modelClass::whereIn('phone', array_unique($phones))->pluck('phone')->all()
            : [];

        $results = array_map(function ($row) use ($existingEmails, $existingPhones) {
            $row   = array_change_key_case((array) $row, CASE_LOWER);
            $email = strtolower(trim((string) ($row['email'] ?? '')));
            $phone = trim((string) ($row['telefono'] ?? ''));
            return [
                'exists' => ($email !== '' && in_array($email, $existingEmails, true))
                         || ($phone !== '' && in_array($phone, $existingPhones, true)),
            ];
        }, $records);

        return response()->json(['results' => $results]);
    }

    private function importMembers(array $records): array
    {
        $imported  = 0;
        $skipped   = 0;
        $errors    = [];
        $created   = [];
        $sanitized = 0;
        $prefix    = MemberCodeService::gymPrefix();

        foreach ($records as $i => $row) {
            $row  = array_change_key_case((array) $row, CASE_LOWER);
            $name = $this->clean($row['nombre'] ?? $row['nombre completo'] ?? $row['name'] ?? $row['full name'] ?? '', $sanitized);

            if (empty($name)) {
                $errors[] = "Fila " . ($i + 2) . ": el campo nombre es requerido";
                continue;
            }

            $parts     = explode(' ', $name, 2);
            $firstName = $parts[0];
            $lastName  = $parts[1] ?? '';

            $email = $this->clean($row['email'] ?? $row['correo'] ?? $row['e-mail'] ?? '', $sanitized);

            if ($email && Member::where('email', $email)->exists()) {
                $skipped++;
                continue;
            }

            $membershipType = strtolower($this->clean(
                $row['tipo'] ?? $row['tipo_membresia'] ?? $row['membership_type'] ?? $row['membresia'] ?? 'basic',
                $sanitized
            ));
            $membershipType = in_array($membershipType, ['basic', 'premium', 'vip']) ? $membershipType : 'basic';

            $phone     = $this->clean($row['telefono'] ?? $row['phone'] ?? $row['tel'] ?? $row['celular'] ?? '', $sanitized);
            $emContact = $this->clean($row['contacto_emergencia'] ?? $row['emergency_contact'] ?? '', $sanitized);
            $emPhone   = $this->clean($row['telefono_emergencia'] ?? $row['emergency_phone'] ?? '', $sanitized);
            $birthDate = $this->clean($row['nacimiento'] ?? $row['birth_date'] ?? $row['fecha_nacimiento'] ?? '', $sanitized);
            $gender    = $this->clean($row['genero'] ?? $row['gender'] ?? $row['sexo'] ?? '', $sanitized);
            $address   = $this->clean($row['direccion'] ?? $row['address'] ?? '', $sanitized);

            $memberCode = MemberCodeService::next($prefix);

            try {
                Member::create([
                    'first_name'              => $firstName,
                    'last_name'               => $lastName,
                    'email'                   => $email ?: null,
                    'phone'                   => $phone ?: null,
                    'membership_type'         => $membershipType,
                    'status'                  => 'active',
                    'emergency_contact_name'  => $emContact ?: null,
                    'emergency_contact_phone' => $emPhone ?: null,
                    'birth_date'              => $birthDate ?: null,
                    'gender'                  => $gender ?: null,
                    'address'                 => $address ?: null,
                    'member_code'             => $memberCode,
                    'qr_token'                => MemberCodeService::qrToken(),
                ]);
                $imported++;
                $created[] = ['nombre' => "{$firstName} {$lastName}", 'email' => $email ?: '—', 'tipo' => $membershipType, 'codigo' => $memberCode];
            } catch (\Exception $e) {
                $errors[] = "Fila " . ($i + 2) . ": " . $e->getMessage();
            }
        }

        return compact('imported', 'skipped', 'errors', 'created', 'sanitized');
    }

    private function importTrainers(array $records): array
    {
        $imported  = 0;
        $skipped   = 0;
        $errors    = [];
        $created   = [];
        $sanitized = 0;

        foreach ($records as $i => $row) {
            $row  = array_change_key_case((array) $row, CASE_LOWER);
            $name = $this->clean($row['nombre'] ?? $row['nombre completo'] ?? $row['name'] ?? '', $sanitized);

            if (empty($name)) {
                $errors[] = "Fila " . ($i + 2) . ": el campo nombre es requerido";
                continue;
            }

            $parts     = explode(' ', $name, 2);
            $firstName = $parts[0];
            $lastName  = $parts[1] ?? '';

            $email = $this->clean($row['email'] ?? $row['correo'] ?? '', $sanitized);
            if ($email && Trainer::where('email', $email)->exists()) {
                $skipped++;
                continue;
            }

            $phone          = $this->clean($row['telefono'] ?? $row['phone'] ?? $row['tel'] ?? '', $sanitized);
            $specialty      = $this->clean($row['especialidad'] ?? $row['specialty'] ?? '', $sanitized);
            $certifications = $this->clean($row['certificaciones'] ?? $row['certifications'] ?? '', $sanitized);
            $bio            = $this->clean($row['bio'] ?? $row['biografia'] ?? '', $sanitized);

            $hireDateRaw = $this->clean($row['fecha_contratacion'] ?? $row['hire_date'] ?? '', $sanitized);
            $hireDate    = null;
            if ($hireDateRaw !== '') {
                try {
                    $hireDate = Carbon::parse($hireDateRaw)->toDateString();
                } catch (\Exception $e) {
                    $hireDate = null;
                }
            }

            try {
                Trainer::create([
                    'first_name'      => $firstName,
                    'last_name'       => $lastName,
                    'email'           => $email ?: null,
                    'phone'           => $phone ?: null,
                    'specialty'       => $specialty ?: null,
                    'certifications'  => $certifications ?: null,
                    'bio'             => $bio ?: null,
                    'hire_date'       => $hireDate,
                    'status'          => 'active',
                ]);
                $imported++;
                $created[] = ['nombre' => "{$firstName} {$lastName}", 'email' => $email ?: '—', 'especialidad' => $specialty ?: '—'];
            } catch (\Exception $e) {
                $errors[] = "Fila " . ($i + 2) . ": " . $e->getMessage();
            }
        }

        return compact('imported', 'skipped', 'errors', 'created', 'sanitized');
    }

    private function importMemberships(array $records): array
    {
        $imported    = 0;
        $skipped     = 0;
        $errors      = [];
        $created     = [];
        $membersMade = 0;
        $sanitized   = 0;

        $validPlans   = ['weekly', 'biweekly', 'monthly', 'quarterly', 'biannual', 'annual'];
        $planAliases  = [
            'semanal' => 'weekly', 'quincenal' => 'biweekly', 'mensual' => 'monthly',
            'trimestral' => 'quarterly', 'semestral' => 'biannual', 'anual' => 'annual',
        ];
        $validMethods  = ['cash', 'card', 'transfer'];
        $methodAliases = ['efectivo' => 'cash', 'tarjeta' => 'card', 'transferencia' => 'transfer'];

        $validStatuses = ['active', 'expired', 'cancelled'];
        $statusAliases = [
            'activa' => 'active', 'activo' => 'active',
            'vencida' => 'expired', 'vencido' => 'expired', 'expirada' => 'expired', 'expirado' => 'expired',
            'cancelada' => 'cancelled', 'cancelado' => 'cancelled',
        ];

        $prefix = MemberCodeService::gymPrefix();

        foreach ($records as $i => $row) {
            $row  = array_change_key_case((array) $row, CASE_LOWER);
            $name = $this->clean($row['nombre'] ?? '', $sanitized);

            if (empty($name)) {
                $errors[] = "Fila " . ($i + 2) . ": el campo nombre es requerido";
                continue;
            }

            $email = $this->clean($row['email'] ?? '', $sanitized);
            $phone = $this->clean($row['telefono'] ?? '', $sanitized);

            // Find the member by email or phone; register them if they don't exist yet.
            $member = null;
            if ($email) {
                $member = Member::where('email', $email)->first();
            }
            if (!$member && $phone) {
                $member = Member::where('phone', $phone)->first();
            }

            $memberCreated = false;
            if (!$member) {
                $parts = explode(' ', $name, 2);
                try {
                    $member = Member::create([
                        'first_name'      => $parts[0],
                        'last_name'       => $parts[1] ?? '',
                        'email'           => $email ?: null,
                        'phone'           => $phone ?: null,
                        'membership_type' => 'basic',
                        'status'          => 'active',
                        'member_code'     => MemberCodeService::next($prefix),
                        'qr_token'        => MemberCodeService::qrToken(),
                    ]);
                    $memberCreated = true;
                    $membersMade++;
                } catch (\Exception $e) {
                    $errors[] = "Fila " . ($i + 2) . ": no se pudo registrar al socio — " . $e->getMessage();
                    continue;
                }
            }

            $planRaw = strtolower($this->clean($row['plan'] ?? 'monthly', $sanitized));
            $plan    = $planAliases[$planRaw] ?? (in_array($planRaw, $validPlans) ? $planRaw : 'monthly');

            $startRaw = $this->clean($row['fecha_inicio'] ?? '', $sanitized);
            try {
                $start = $startRaw ? Carbon::parse($startRaw) : now();
            } catch (\Exception $e) {
                $start = now();
            }

            $endRaw = $this->clean($row['fecha_fin'] ?? '', $sanitized);
            if ($endRaw) {
                try {
                    $end = Carbon::parse($endRaw);
                } catch (\Exception $e) {
                    $end = $this->calcEndDate($start, $plan);
                }
            } else {
                $end = $this->calcEndDate($start, $plan);
            }

            $amountRaw = $this->clean($row['monto'] ?? '', $sanitized);
            $amount    = is_numeric($amountRaw) ? (float) $amountRaw : 0;

            $methodRaw = strtolower($this->clean($row['metodo_pago'] ?? 'cash', $sanitized));
            $method    = $methodAliases[$methodRaw] ?? (in_array($methodRaw, $validMethods) ? $methodRaw : 'cash');

            $statusRaw = strtolower($this->clean($row['estado'] ?? $row['status'] ?? 'active', $sanitized));
            $status    = $statusAliases[$statusRaw] ?? (in_array($statusRaw, $validStatuses) ? $statusRaw : 'active');

            try {
                Membership::create([
                    'member_id'      => $member->id,
                    'type'           => $plan,
                    'start_date'     => $start->toDateString(),
                    'end_date'       => $end->toDateString(),
                    'amount'         => $amount,
                    'payment_method' => $method,
                    'status'         => $status,
                ]);
                $imported++;
                $created[] = [
                    'nombre'      => $name,
                    'plan'        => $plan,
                    'inicio'      => $start->toDateString(),
                    'fin'         => $end->toDateString(),
                    'estado'      => $status,
                    'socio_nuevo' => $memberCreated,
                    'codigo_socio' => $member->member_code,
                ];
            } catch (\Exception $e) {
                $errors[] = "Fila " . ($i + 2) . ": " . $e->getMessage();
            }
        }

        return compact('imported', 'skipped', 'errors', 'created', 'membersMade', 'sanitized');
    }

    private function calcEndDate(Carbon $start, string $plan): Carbon
    {
        $end = $start->copy();

        return match ($plan) {
            'weekly'    => $end->addDays(7),
            'biweekly'  => $end->addDays(15),
            'quarterly' => $end->addMonths(3),
            'biannual'  => $end->addMonths(6),
            'annual'    => $end->addMonths(12),
            default     => $end->addMonth(),
        };
    }

    // ── Security / data-hygiene ────────────────────────────────────────────────

    /**
     * Fraction of cells across all records that sanitizeCell() flags as
     * suspicious — used up front to decide whether to reject the whole file.
     */
    private function scanRisk(array $records): float
    {
        $total   = 0;
        $flagged = 0;

        foreach ($records as $row) {
            foreach ((array) $row as $value) {
                $total++;
                if ($this->sanitizeCell($value)['flagged']) {
                    $flagged++;
                }
            }
        }

        return $total > 0 ? $flagged / $total : 0;
    }

    /** Sanitizes one cell and adds to $counter when something had to be cleaned. */
    private function clean($value, int &$counter): string
    {
        $result = $this->sanitizeCell($value);
        if ($result['flagged']) {
            $counter++;
        }
        return (string) ($result['value'] ?? '');
    }

    /**
     * Neutralizes the two realistic threats a spreadsheet cell can carry:
     *  - Spreadsheet formula injection (a cell starting with =, +, -, @ gets
     *    executed as a formula if the value is ever opened in Excel/Sheets —
     *    relevant here because this app also exports data back to Excel).
     *  - Script/markup injection (<script>, javascript:, on*= handlers).
     * Also strips raw control characters and caps absurd lengths, since a
     * legitimate name/email/phone/note is never megabytes long.
     */
    private function sanitizeCell($value): array
    {
        if ($value === null) {
            return ['value' => null, 'flagged' => false];
        }

        $str = trim(is_string($value) ? $value : (string) $value);
        if ($str === '') {
            return ['value' => '', 'flagged' => false];
        }

        $flagged = false;

        $stripped = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/', '', $str);
        if ($stripped !== $str) {
            $str = $stripped;
            $flagged = true;
        }

        if (preg_match('/<\s*script|javascript\s*:|on\w+\s*=/i', $str)) {
            $str = preg_replace('/javascript\s*:/i', '', strip_tags($str));
            $flagged = true;
        }

        if (preg_match('/^[=+\-@]/', $str)) {
            $str = "'" . $str;
            $flagged = true;
        }

        if (mb_strlen($str) > 300) {
            $str = mb_substr($str, 0, 300);
            $flagged = true;
        }

        return ['value' => trim($str), 'flagged' => $flagged];
    }
}
