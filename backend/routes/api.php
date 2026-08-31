<?php

use App\Http\Controllers\AccessCodeController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\ImportController;
use App\Http\Controllers\PasswordResetController;
use App\Http\Controllers\SuperAdminController;
use App\Http\Controllers\FormSubmissionController;
use App\Http\Controllers\SupportTicketController;
use App\Http\Controllers\ClassController;
use App\Http\Controllers\ClassSessionController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\FinanceController;
use App\Http\Controllers\LabelController;
use App\Http\Controllers\DiscountCategoryController;
use App\Http\Controllers\MembershipTypeController;
use App\Http\Controllers\MemberController;
use App\Http\Controllers\MembershipController;
use App\Http\Controllers\IngresoController;
use App\Http\Controllers\SettingController;
use App\Http\Controllers\StripeController;
use App\Http\Controllers\TrainerController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\PlanController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\ProductSaleController;
use App\Http\Controllers\WhatsAppController;
use App\Http\Controllers\VisitController;
use Illuminate\Support\Facades\Route;

// ── Public auth routes — strict limits to block brute force ──────────────────
Route::prefix('auth')->group(function () {
    Route::post('/login',          [AuthController::class, 'login'])         ->middleware('throttle:10,1');
    Route::post('/operator-login', [AuthController::class, 'operatorLogin']) ->middleware('throttle:5,1');

    // Forgot password (public, unauthenticated)
    Route::post('/password/send-code', [PasswordResetController::class, 'sendCode'])     ->middleware('throttle:5,15');
    Route::post('/password/reset',     [PasswordResetController::class, 'resetPassword'])->middleware('throttle:5,15');

    // Live "already registered" check on the signup form — fires on blur, so it's
    // throttled tighter than a normal form submit to keep it from being scraped.
    Route::post('/check-availability', [AuthController::class, 'checkAvailability'])->middleware('throttle:20,1');
});

// ── Public form submissions & trial requests ──────────────────────────────────
Route::post('/submissions',    [FormSubmissionController::class, 'store'])    ->middleware('throttle:10,1');
Route::post('/trial-requests', [SuperAdminController::class,    'submitTrial'])->middleware('throttle:5,60');

// ── Support tickets — public endpoints (no auth required) ────────────────────
Route::post('/support/tickets/public',  [SupportTicketController::class, 'store'])        ->middleware('throttle:10,1');
Route::post('/support/tickets/lookup',  [SupportTicketController::class, 'publicLookup']) ->middleware('throttle:10,1');
Route::post('/support/tickets/reply',   [SupportTicketController::class, 'publicReply'])  ->middleware('throttle:15,1');

// ── Plans — public (feeds the pricing UI on Landing/Register/Profile) ────────
Route::get('/plans', [PlanController::class, 'index'])->middleware('throttle:60,1');

// ── Stripe — public endpoints (webhook verifies its own signature) ────────────
Route::post('/stripe/create-session',       [StripeController::class, 'createCheckoutSession'])->middleware('throttle:10,1');
Route::post('/stripe/webhook',              [StripeController::class, 'webhook']);             // signature-verified; no throttle needed
Route::get('/stripe/verify-session',        [StripeController::class, 'verifySession'])       ->middleware('throttle:20,1');
Route::get('/stripe/verify-plan-change',    [StripeController::class, 'verifyPlanChange'])    ->middleware('throttle:20,1');
Route::get('/stripe/verify-extra-purchase', [StripeController::class, 'verifyExtraPurchase']) ->middleware('throttle:20,1');
Route::post('/stripe/pay-trial-upgrade',    [StripeController::class, 'payTrialUpgrade'])     ->middleware('throttle:10,1');
Route::get('/stripe/verify-trial-upgrade',  [StripeController::class, 'verifyTrialUpgrade'])  ->middleware('throttle:20,1');

// ── Stripe — authenticated ────────────────────────────────────────────────────
Route::post('/stripe/change-plan',          [StripeController::class, 'changePlan'])          ->middleware('auth:sanctum');
Route::post('/stripe/plan-change-checkout', [StripeController::class, 'createPlanChangeSession'])->middleware('auth:sanctum');
Route::post('/stripe/cancel-subscription',  [StripeController::class, 'cancelSubscription'])  ->middleware('auth:sanctum');
Route::put('/gym/extras',                   [StripeController::class, 'updateGymExtras'])     ->middleware('auth:sanctum');
Route::post('/gym/extras/checkout',         [StripeController::class, 'purchaseGymExtra'])    ->middleware('auth:sanctum');
Route::post('/gym/upgrade-to-paid',         [StripeController::class, 'upgradeTrialToPaid'])  ->middleware('auth:sanctum');

// ── Protected routes (authenticated gym users) ────────────────────────────────
Route::middleware('auth:sanctum')->group(function () {

    // Auth & session management
    Route::post('/auth/logout',              [AuthController::class,       'logout']);
    Route::get('/auth/me',                   [AuthController::class,       'me']);
    Route::post('/auth/complete-onboarding', [AuthController::class,       'completeOnboarding']);
    Route::get('/auth/access-code',          [AccessCodeController::class, 'show']);
    Route::put('/auth/access-code',          [AccessCodeController::class, 'update']);

    // Authenticated password change — throttled to prevent email flooding
    Route::post('/auth/password/send-change-code', [PasswordResetController::class, 'sendChangeCode'])->middleware('throttle:password-change');
    Route::post('/auth/password/confirm-change',   [PasswordResetController::class, 'confirmChange']) ->middleware('throttle:password-change');

    // Dashboard
    Route::get('/dashboard/stats', [DashboardController::class, 'stats']);

    // ── Members ───────────────────────────────────────────────────────────────
    Route::get('/members/summary',  [MemberController::class, 'summary']);
    Route::get('/members/search',   [MemberController::class, 'search']);

    // QR scan — high-frequency POS operation, keyed by IP
    Route::post('/members/scan-qr', [MemberController::class, 'scanQr'])->middleware('throttle:scan-qr');

    Route::get('/members/{member}/qr',                [MemberController::class, 'qr']);
    Route::get('/members/{member}/activity',          [MemberController::class, 'activity']);
    Route::get('/members/{member}/membership-status', [MemberController::class, 'membershipStatus']);

    // Notification sends — throttled to prevent member spam
    Route::post('/members/{member}/send-notification',  [MemberController::class, 'sendNotification'])->middleware('throttle:wa-notify');
    Route::post('/members/{member}/notify-membership',  [MemberController::class, 'notifyMembership'])->middleware('throttle:wa-notify');
    Route::post('/members/{member}/send-whatsapp',      [MemberController::class, 'sendWhatsApp'])    ->middleware(['throttle:wa-notify', 'feature:whatsapp']);
    Route::post('/members/{member}/notify',             [MemberController::class, 'notify'])           ->middleware('throttle:wa-notify');

    Route::apiResource('/members', MemberController::class);

    // Member labels
    Route::post('/members/{member}/labels',              [LabelController::class, 'attachToMember']);
    Route::delete('/members/{member}/labels/{label}',    [LabelController::class, 'detachFromMember']);

    // Trainers & Classes — one bundle ("Clases y Entrenadores" on the pricing page)
    Route::middleware('feature:classes')->group(function () {
        Route::apiResource('/trainers', TrainerController::class);
        Route::apiResource('/classes', ClassController::class);
        Route::patch('/classes/{class}/sessions/{session}', [ClassSessionController::class, 'update']);
    });

    // Visits
    Route::get('/visits/summary',  [VisitController::class, 'summary']);
    Route::get('/visits/activity', [VisitController::class, 'activity']);
    Route::apiResource('/visits', VisitController::class)->only(['index', 'store', 'update', 'destroy']);

    // Memberships
    Route::get('/memberships/summary', [MembershipController::class, 'summary']);
    Route::apiResource('/memberships', MembershipController::class)->only(['index', 'store', 'destroy']);

    // Labels
    Route::apiResource('/labels', LabelController::class)->except(['show']);

    // Finances
    Route::get('/finances/summary',      [FinanceController::class, 'summary']);
    Route::get('/finances/transactions', [FinanceController::class, 'transactions']);

    // Ingresos
    Route::apiResource('/ingresos', IngresoController::class)->only(['index', 'store', 'update', 'destroy']);

    // ── Products & sales ─────────────────────────────────────────────────────
    Route::middleware('feature:products')->group(function () {
        Route::get('/products/summary',            [ProductController::class,     'summary']);
        Route::get('/products/{product}/stats',    [ProductController::class,     'stats']);
        Route::apiResource('/products', ProductController::class)->only(['index', 'show', 'store', 'update', 'destroy']);
        Route::post('/products/{product}/sell',    [ProductSaleController::class, 'sell']);
        Route::post('/products/checkout',          [ProductSaleController::class, 'checkout']);
        Route::get('/product-sales',               [ProductSaleController::class, 'index']);
    });

    // Membership types & discount categories
    Route::apiResource('/membership-types',    MembershipTypeController::class)   ->only(['index', 'store', 'update', 'destroy']);
    Route::apiResource('/discount-categories', DiscountCategoryController::class) ->only(['index', 'store', 'update', 'destroy']);

    // Settings
    Route::get('/settings', [SettingController::class, 'index']);
    Route::put('/settings', [SettingController::class, 'update']);

    // ── Support tickets (authenticated gym users) ─────────────────────────────
    Route::post('/support/tickets',                   [SupportTicketController::class, 'store'])      ->middleware('throttle:10,1');
    Route::get('/support/tickets',                    [SupportTicketController::class, 'myTickets']);
    Route::get('/support/tickets/{ticket}',           [SupportTicketController::class, 'show']);
    Route::post('/support/tickets/{ticket}/messages', [SupportTicketController::class, 'addMessage']) ->middleware('throttle:30,1');

    // ── Bulk data import — expensive, strict limit ────────────────────────────
    Route::middleware('feature:import')->group(function () {
        Route::post('/import/check', [ImportController::class, 'check'])->middleware('throttle:10,1');
        Route::post('/import',       [ImportController::class, 'import'])->middleware('throttle:import');
    });

    // ── WhatsApp ──────────────────────────────────────────────────────────────
    Route::middleware('feature:whatsapp')->group(function () {
        Route::get('/whatsapp/status',        [WhatsAppController::class, 'status']);
        Route::post('/whatsapp/init',         [WhatsAppController::class, 'init'])      ->middleware('throttle:whatsapp-init');
        Route::get('/whatsapp/qr',            [WhatsAppController::class, 'qr']);
        Route::delete('/whatsapp/disconnect', [WhatsAppController::class, 'disconnect'])->middleware('throttle:5,1');
        Route::get('/whatsapp/logs',          [WhatsAppController::class, 'logs']);
        Route::delete('/whatsapp/logs/{id}',  [WhatsAppController::class, 'deleteLog']);
    });

    // ── In-app notifications ──────────────────────────────────────────────────
    Route::get('/notifications',                              [NotificationController::class, 'index']);
    Route::patch('/notifications/read-all',                   [NotificationController::class, 'markAllRead']);
    Route::delete('/notifications/read',                      [NotificationController::class, 'destroyRead']);
    Route::patch('/notifications/{gymNotification}/read',     [NotificationController::class, 'markRead']);
    Route::delete('/notifications/{gymNotification}',         [NotificationController::class, 'destroy']);
});

// ── Operator (super-admin) routes — auth + operator PIN + rate limited ────────
Route::middleware(['auth:sanctum', 'operator', 'throttle:operator'])->prefix('operator')->group(function () {
    // Stats
    Route::get('/stats', [SuperAdminController::class, 'stats']);

    // Trial requests
    Route::get('/trial-requests',                              [SuperAdminController::class, 'trialRequests']);
    Route::post('/trial-requests/{trial}/approve',             [SuperAdminController::class, 'approveTrial']);
    Route::post('/trial-requests/{trial}/reject',              [SuperAdminController::class, 'rejectTrial']);
    Route::post('/trial-requests/{trial}/resend-approval',     [SuperAdminController::class, 'resendApprovalEmail']);
    Route::post('/trial-requests/{trial}/resend-rejection',    [SuperAdminController::class, 'resendRejectionEmail']);

    // Gyms
    Route::post('/gyms/run-suspension-check',              [SuperAdminController::class, 'runSuspensionCheck']);
    Route::get('/gyms',                                    [SuperAdminController::class, 'gyms']);
    Route::get('/gyms/{gym}',                              [SuperAdminController::class, 'gymDetail']);
    Route::get('/gyms/{gym}/db-stats',                     [SuperAdminController::class, 'paidGymDbStats']);
    Route::put('/gyms/{gym}/suspend',                      [SuperAdminController::class, 'suspendGym']);
    Route::put('/gyms/{gym}/restrict',                     [SuperAdminController::class, 'restrictGym']);
    Route::put('/gyms/{gym}/activate',                     [SuperAdminController::class, 'activateGym']);
    Route::put('/gyms/{gym}/billing-status',               [SuperAdminController::class, 'setBillingStatus']);
    Route::put('/gyms/{gym}/extras',                       [SuperAdminController::class, 'updateExtras']);
    Route::put('/gyms/{gym}/convert-to-paid',               [SuperAdminController::class, 'convertTrialToPaid']);
    Route::put('/gyms/{gym}/revert-convert-to-paid',         [SuperAdminController::class, 'revertConvertToPaid']);
    Route::delete('/gyms/{gym}',                           [SuperAdminController::class, 'deleteGym']); // gated by SUPERADMIN_DELETE_SECRET

    // Per-user management
    Route::put('/users/{user}/suspend',                    [SuperAdminController::class, 'suspendUser']);
    Route::put('/users/{user}/restrict',                   [SuperAdminController::class, 'restrictUser']);
    Route::put('/users/{user}/activate',                   [SuperAdminController::class, 'activateUser']);
    Route::put('/users/{user}/password',                   [SuperAdminController::class, 'changePassword']);
    Route::put('/users/{user}/security-code',              [SuperAdminController::class, 'changeSecurityCode']);
    Route::delete('/users/{user}/security-code',           [SuperAdminController::class, 'removeSecurityCode']);
    Route::post('/users/{user}/resend-welcome',            [SuperAdminController::class, 'resendWelcomeEmail']);
    Route::post('/users/{user}/resend-invoice',            [SuperAdminController::class, 'resendInvoiceEmail']);

    // Form submissions
    Route::get('/submissions',                             [FormSubmissionController::class, 'index']);
    Route::put('/submissions/{submission}/read',           [FormSubmissionController::class, 'markRead']);
    Route::put('/submissions/{submission}/archive',        [FormSubmissionController::class, 'archive']);

    // Support ticket management (operator view)
    Route::get('/tickets',                                 [SupportTicketController::class, 'operatorIndex']);
    Route::get('/tickets/{ticket}',                        [SupportTicketController::class, 'operatorShow']);
    Route::post('/tickets/{ticket}/messages',              [SupportTicketController::class, 'operatorMessage']);
    Route::put('/tickets/{ticket}/accept',                 [SupportTicketController::class, 'accept']);
    Route::put('/tickets/{ticket}/resolve',                [SupportTicketController::class, 'resolve']);
    Route::put('/tickets/{ticket}/close',                  [SupportTicketController::class, 'close']);
});
