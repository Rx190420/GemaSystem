<?php

namespace App\Http\Controllers;

use App\Models\Setting;
use App\Scopes\GymScope;
use Illuminate\Http\Request;

class SettingController extends Controller
{
    private const ALLOWED_KEYS = [
        'gym_name', 'gym_description', 'gym_address', 'gym_phone', 'gym_email',
        'theme_color',
        'price_visit_training', 'price_visit_class', 'price_visit_consultation', 'price_visit_other',
        'price_membership_weekly', 'price_membership_biweekly',
        'price_membership_monthly', 'price_membership_quarterly', 'price_membership_biannual', 'price_membership_annual',
        'send_welcome_email', 'expiry_alert_days',
        'currency', 'timezone', 'trial_days',
        'require_access_code',
    ];

    public function index()
    {
        return response()->json(
            Setting::all()->mapWithKeys(fn ($s) => [$s->key => $s->value])
        );
    }

    public function update(Request $request)
    {
        $isPaid = app()->bound('gym.plan') && app('gym.plan') === 'paid';
        $gymId  = auth()->user()->gym_id;

        foreach ($request->all() as $key => $value) {
            if (!in_array($key, self::ALLOWED_KEYS)) continue;

            $val = $value === null ? null : (string) $value;

            if ($isPaid) {
                // Tenant DB: settings table has no gym_id column
                Setting::updateOrCreate(['key' => $key], ['value' => $val]);
            } else {
                // Shared DB: must scope by gym_id
                Setting::withoutGlobalScope(GymScope::class)->updateOrCreate(
                    ['gym_id' => $gymId, 'key'   => $key],
                    ['value'  => $val,   'gym_id' => $gymId]
                );
            }
        }

        return response()->json(['message' => 'Configuración guardada.']);
    }
}
