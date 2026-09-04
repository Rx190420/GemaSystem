<?php

// Single source of truth for the 3-tier plan prices (Basic / Full / Custom's
// add-ons). Read by StripeController (to compute what to actually charge —
// never trust a client-submitted price) and by PlanController's public
// GET /api/plans (so the frontend never hardcodes a price again).
//
// Legacy weekly/monthly/annual plans are intentionally NOT here — they keep
// using services.stripe.price_weekly/price_monthly/price_annual exactly as
// before, unaffected by this file.

return [

    'currency' => 'mxn',

    'basic' => [
        'label'    => 'Basic',
        // Calculado para que, después de la comisión de Stripe México
        // (3.6% + $3 MXN por cargo), el neto que se recibe sea ~$500:
        // 522 - (522*0.036 + 3) = 522 - 21.79 = $500.21 neto.
        'price'    => 522, // MXN/mes
        'features' => [],
    ],

    'full' => [
        'label'    => 'Full',
        'price'    => 1099, // MXN/mes
        'features' => ['whatsapp', 'products', 'classes', 'import', 'export'],
    ],

    // Custom starts at the same base price as Basic; each addon stacks on
    // top. Priced so buying all 5 addons ($1,314 total) costs more than
    // Full ($1,099) — Full is meant to look like the better deal.
    'addons' => [
        'whatsapp' => ['label' => 'WhatsApp',          'price' => 249, 'description' => 'Recordatorios y avisos automáticos por WhatsApp.'],
        'products' => ['label' => 'Productos',         'price' => 129, 'description' => 'Vende productos y controla tu inventario.'],
        'classes'  => ['label' => 'Clases',             'price' => 129, 'description' => 'Agenda y administra clases grupales y privadas.'],
        'import'   => ['label' => 'Importar datos',     'price' => 79, 'description' => 'Sube tus datos existentes de un jalón.'],
        'export'   => ['label' => 'Exportar reportes',  'price' => 79, 'description' => 'Descarga tus reportes en Excel o PDF.'],
    ],

];
