<?php

use Illuminate\Contracts\Http\Kernel;
use Illuminate\Http\Request;

define('LARAVEL_START', microtime(true));

/*
|--------------------------------------------------------------------------
| Check If The Application Is Under Maintenance
|--------------------------------------------------------------------------
|
| If the application is in maintenance / demo mode via the "down" command
| we will load this file so that any pre-rendered content can be shown
| instead of starting the framework, which could cause an exception.
|
*/

if (file_exists($maintenance = __DIR__.'/../storage/framework/maintenance.php')) {
    require $maintenance;
}

/*
|--------------------------------------------------------------------------
| Register The Auto Loader
|--------------------------------------------------------------------------
|
| Composer provides a convenient, automatically generated class loader for
| this application. We just need to utilize it! We'll simply require it
| into the script here so we don't need to manually load our classes.
|
*/

require __DIR__.'/../vendor/autoload.php';

/*
|--------------------------------------------------------------------------
| Disable putenv() for .env loading (thread-safety, Apache/mod_php)
|--------------------------------------------------------------------------
|
| vlucas/phpdotenv's default PutenvAdapter writes loaded .env values via
| PHP's putenv() — which touches the process-wide OS environment table, not
| a thread-local or request-local one. Under Apache's threaded MPM
| (ThreadsPerChild > 1), two requests bootstrapping .env at the same moment
| on different threads of the same worker process can race on that shared
| table, leaving one of them with a corrupted/partial environment for the
| rest of its request (reproduced live: "No application encryption key",
| Postgres queries suddenly claiming a real column "does not exist", MySQL
| defaults like host=127.0.0.1/user=forge appearing out of nowhere — same
| query, same connection, works every time from the CLI).
|
| disablePutenv() keeps Laravel on $_ENV/$_SERVER only (still populated by
| Dotenv's other adapters), which Apache correctly keeps request-local even
| under a threaded/persistent worker — this is what actually lets
| ThreadsPerChild go back above 1 without reintroducing that corruption.
| Must run before bootstrap/app.php, which is what first reads config values
| that depend on the environment being loaded.
|
*/

Illuminate\Support\Env::disablePutenv();

/*
|--------------------------------------------------------------------------
| Run The Application
|--------------------------------------------------------------------------
|
| Once we have the application, we can handle the incoming request using
| the application's HTTP kernel. Then, we will send the response back
| to this client's browser, allowing them to enjoy our application.
|
*/

$app = require_once __DIR__.'/../bootstrap/app.php';

$kernel = $app->make(Kernel::class);

$response = $kernel->handle(
    $request = Request::capture()
)->send();

$kernel->terminate($request, $response);
