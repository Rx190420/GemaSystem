<?php

use Illuminate\Support\Str;

return [

    /*
    |--------------------------------------------------------------------------
    | Default Database Connection Name
    |--------------------------------------------------------------------------
    |
    | Here you may specify which of the database connections below you wish
    | to use as your default connection for all database work. Of course
    | you may use many connections at once using the Database library.
    |
    */

    'default' => env('DB_CONNECTION', 'mysql'),

    /*
    |--------------------------------------------------------------------------
    | Database Connections
    |--------------------------------------------------------------------------
    |
    | Here are each of the database connections setup for your application.
    | Of course, examples of configuring each database platform that is
    | supported by Laravel is shown below to make development simple.
    |
    |
    | All database work in Laravel is done through the PHP PDO facilities
    | so make sure you have the driver for your particular database of
    | choice installed on your machine before you begin development.
    |
    */

    'connections' => [

        'sqlite' => [
            'driver' => 'sqlite',
            'url' => env('DATABASE_URL'),
            'database' => env('DB_DATABASE', database_path('database.sqlite')),
            'prefix' => '',
            'foreign_key_constraints' => env('DB_FOREIGN_KEYS', true),
        ],

        'mysql' => [
            'driver'      => 'mysql',
            'url'         => env('DATABASE_URL'),
            'host'        => env('DB_HOST', '127.0.0.1'),
            'port'        => env('DB_PORT', '3306'),
            'database'    => env('DB_DATABASE', 'forge'),
            'username'    => env('DB_USERNAME', 'forge'),
            'password'    => env('DB_PASSWORD', ''),
            'unix_socket' => env('DB_SOCKET', ''),
            'charset'     => 'utf8mb4',
            'collation'   => 'utf8mb4_unicode_ci',
            'prefix'      => '',
            'prefix_indexes' => true,
            'strict'      => true,
            'engine'      => null,
            'options'     => extension_loaded('pdo_mysql') ? (
                // NOTE: PDO option keys are PHP integers (PDO::ATTR_PERSISTENT = 12,
                // PDO::ATTR_TIMEOUT = 2, etc.). array_merge() re-indexes integer keys
                // from 0, destroying them. Use the union operator (+) instead — it
                // preserves all integer keys and merges without re-indexing.
                [
                    // ── Persistent connections (shared DB only) ────────────────
                    // PHP/Apache has no true connection pool; PDO persistent
                    // connections are the closest equivalent: each Apache worker
                    // process keeps a live socket to MySQL and re-uses it across
                    // requests instead of paying TCP+auth overhead on every hit.
                    //
                    // Safe here because this connection always targets the same DB
                    // (gymos). The HandleDatabaseConnection middleware pings the
                    // socket at request start and reconnects if MySQL timed it out.
                    //
                    // NOT applied to the 'tenant' connection below because that
                    // connection is re-pointed to a different database per request;
                    // persistent sockets would leak cross-gym state.
                    PDO::ATTR_PERSISTENT => true,

                    // ── Connection timeout ─────────────────────────────────────
                    // Fail fast if MySQL is unreachable (e.g. during a restart)
                    // instead of blocking a PHP worker for the default 30 s.
                    PDO::ATTR_TIMEOUT => 5,

                    // ── Native prepared statements ─────────────────────────────
                    // Emulated prepares convert everything to strings — native
                    // statements keep proper types and are safer against edge-case
                    // injection via type confusion.
                    PDO::ATTR_EMULATE_PREPARES => false,

                    // ── Buffered queries ───────────────────────────────────────
                    // Required for MySQL: results are buffered client-side so the
                    // server is free to accept the next query immediately.
                    PDO::MYSQL_ATTR_USE_BUFFERED_QUERY => true,
                ]
                // SSL CA is only present in production; union adds it without
                // touching the keys above. array_filter strips the null value
                // in dev so the key is absent and the union is a no-op.
                + array_filter([PDO::MYSQL_ATTR_SSL_CA => env('MYSQL_ATTR_SSL_CA')])
            ) : [],
        ],

        /*
        |----------------------------------------------------------------------
        | Tenant connection — populated dynamically by SetTenantDatabase middleware
        | for paid gyms that have their own dedicated database (gemasystem_gym_{id}).
        | Free gyms always use the 'mysql' connection above with GymScope.
        |----------------------------------------------------------------------
        */
        /*
        |----------------------------------------------------------------------
        | Tenant connection — populated dynamically by SetTenantDatabase middleware
        | for paid gyms that have their own dedicated database (gemasystem_gym_{id}).
        | Free gyms always use the 'mysql' connection above with GymScope.
        |----------------------------------------------------------------------
        */
        'tenant' => [
            'driver'      => 'mysql',
            'host'        => env('DB_HOST', '127.0.0.1'),
            'port'        => env('DB_PORT', '3306'),
            'database'    => '',   // overwritten at runtime by SetTenantDatabase
            'username'    => env('DB_USERNAME', 'forge'),
            'password'    => env('DB_PASSWORD', ''),
            'unix_socket' => env('DB_SOCKET', ''),
            'charset'     => 'utf8mb4',
            'collation'   => 'utf8mb4_unicode_ci',
            'prefix'      => '',
            'prefix_indexes' => true,
            'strict'      => true,
            'engine'      => null,
            'options'     => extension_loaded('pdo_mysql') ? [
                // Intentionally no PDO::ATTR_PERSISTENT here.
                // SetTenantDatabase calls DB::purge('tenant') per request and
                // re-points this connection to a different database each time.
                // Persistent sockets would survive the purge in PHP's PDO pool
                // and could serve the wrong gym's data on the next request.
                PDO::ATTR_TIMEOUT                   => 5,
                PDO::ATTR_EMULATE_PREPARES          => false,
                PDO::MYSQL_ATTR_USE_BUFFERED_QUERY  => true,
            ] : [],
        ],

        'pgsql' => [
            'driver' => 'pgsql',
            'url' => env('DATABASE_URL'),
            'host' => env('DB_HOST', '127.0.0.1'),
            'port' => env('DB_PORT', '5432'),
            'database' => env('DB_DATABASE', 'forge'),
            'username' => env('DB_USERNAME', 'forge'),
            'password' => env('DB_PASSWORD', ''),
            'charset' => 'utf8',
            'prefix' => '',
            'prefix_indexes' => true,
            'schema' => 'public',
            'sslmode' => 'prefer',
            // ── Persistent connections ──────────────────────────────────────
            // Same reasoning as the 'mysql' block above: Supabase is a remote
            // DB (network round-trip, not localhost), so opening a fresh
            // TCP+TLS+auth handshake on every request is real cost (~850ms
            // measured against the pooler) on top of the query itself. With
            // PDO::ATTR_PERSISTENT each Apache worker keeps its socket open
            // and reuses it across requests. HandleDatabaseConnection already
            // pings and reconnects this connection at the top of every /api
            // request, so a stale/dropped persistent socket self-heals.
            'options' => extension_loaded('pdo_pgsql') ? [
                PDO::ATTR_PERSISTENT => true,
                PDO::ATTR_TIMEOUT => 8,
            ] : [],
        ],

        'sqlsrv' => [
            'driver' => 'sqlsrv',
            'url' => env('DATABASE_URL'),
            'host' => env('DB_HOST', 'localhost'),
            'port' => env('DB_PORT', '1433'),
            'database' => env('DB_DATABASE', 'forge'),
            'username' => env('DB_USERNAME', 'forge'),
            'password' => env('DB_PASSWORD', ''),
            'charset' => 'utf8',
            'prefix' => '',
            'prefix_indexes' => true,
        ],

    ],

    /*
    |--------------------------------------------------------------------------
    | Migration Repository Table
    |--------------------------------------------------------------------------
    |
    | This table keeps track of all the migrations that have already run for
    | your application. Using this information, we can determine which of
    | the migrations on disk haven't actually been run in the database.
    |
    */

    'migrations' => 'migrations',

    /*
    |--------------------------------------------------------------------------
    | Redis Databases
    |--------------------------------------------------------------------------
    |
    | Redis is an open source, fast, and advanced key-value store that also
    | provides a richer body of commands than a typical key-value system
    | such as APC or Memcached. Laravel makes it easy to dig right in.
    |
    */

    'redis' => [

        'client' => env('REDIS_CLIENT', 'phpredis'),

        'options' => [
            'cluster' => env('REDIS_CLUSTER', 'redis'),
            'prefix' => env('REDIS_PREFIX', Str::slug(env('APP_NAME', 'laravel'), '_').'_database_'),
        ],

        'default' => [
            'url' => env('REDIS_URL'),
            'host' => env('REDIS_HOST', '127.0.0.1'),
            'password' => env('REDIS_PASSWORD', null),
            'port' => env('REDIS_PORT', '6379'),
            'database' => env('REDIS_DB', '0'),
        ],

        'cache' => [
            'url' => env('REDIS_URL'),
            'host' => env('REDIS_HOST', '127.0.0.1'),
            'password' => env('REDIS_PASSWORD', null),
            'port' => env('REDIS_PORT', '6379'),
            'database' => env('REDIS_CACHE_DB', '1'),
        ],

    ],

];
