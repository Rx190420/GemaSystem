<?php

namespace App\Exceptions;

use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Exceptions\Handler as ExceptionHandler;
use Throwable;

class Handler extends ExceptionHandler
{
    /**
     * A list of the exception types that are not reported.
     *
     * @var array<int, class-string<Throwable>>
     */
    protected $dontReport = [
        //
    ];

    /**
     * A list of the inputs that are never flashed for validation exceptions.
     *
     * @var array<int, string>
     */
    protected $dontFlash = [
        'current_password',
        'password',
        'password_confirmation',
    ];

    /**
     * Register the exception handling callbacks for the application.
     *
     * @return void
     */
    public function register()
    {
        $this->reportable(function (Throwable $e) {
            //
        });
    }

    /**
     * This is a JSON-only API backend (a separate SPA is the actual frontend) —
     * there's no Blade 'login' route to redirect an unauthenticated request to.
     * The base handler's fallback for a non-JSON-expecting request tries
     * route('login') and crashes with RouteNotFoundException (500) instead of
     * a clean 401 whenever a request doesn't look like an XHR to Laravel —
     * which is what blocked access to the operator console. Always return
     * JSON here regardless of what the request "expects".
     */
    protected function unauthenticated($request, AuthenticationException $exception)
    {
        return response()->json(['message' => $exception->getMessage()], 401);
    }
}
