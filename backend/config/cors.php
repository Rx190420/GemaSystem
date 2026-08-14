<?php

$frontend = env('FRONTEND_URL', 'http://localhost:5173');

return [
    'paths'                    => ['api/*', 'sanctum/csrf-cookie'],
    'allowed_methods'          => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    'allowed_origins'          => array_filter(array_map('trim', explode(',', $frontend))),
    'allowed_origins_patterns' => [],
    'allowed_headers'          => ['Content-Type', 'X-Requested-With', 'Authorization', 'Accept', 'X-XSRF-TOKEN'],
    'exposed_headers'          => [],
    'max_age'                  => 7200,
    'supports_credentials'     => true,
];
