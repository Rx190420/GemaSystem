# AGENTS.md — GemaSystem

Context file for AI coding agents working in this repo. Read this before making changes — especially the **multi-tenant database** section, which is the single easiest thing to get wrong here.

> Written 2026-08-13 from direct inspection of the code. If something here looks stale (version numbers, table names, routes), verify against the actual files before trusting it — this file will drift out of date like any doc.

## What this is

**GemaSystem** — gym management SaaS (members, visits/QR check-in, memberships, classes, a small product/inventory store, finances, WhatsApp notifications). Spanish-language UI throughout; write user-facing strings in Spanish.

Formerly called **GymOS**, then briefly **GymDeck** — fully renamed 2026-07-29. If you see `gymos`/`GymOS`/`GymOs` anywhere (DB names, cookie names, storage keys, emails), that's leftover from before the rename and should become `gemasystem`/`GemaSystem` — except `GymScope`, `BelongsToGym`, `gym_name`, the `Gym` model, the `gyms` table, `CreateGymDatabase`, `gym:migrate-tenants` — those are the generic "gym" business-domain word, not the old brand, and were intentionally left alone.

## Repo layout

Three independent apps, no shared package manager:

- `backend/` — Laravel 8 (PHP ^7.3|^8.0) REST API, Sanctum token auth, MySQL Server 8.0 (standalone, not MariaDB/XAMPP's bundled server — see Local environment).
- `frontend/` — React 19 SPA, Vite 8, Tailwind CSS v4, TanStack Query v5, Zustand, react-hook-form + yup, Recharts, react-router-dom v7.
- `whatsapp-bot/` — small Node/Express service wrapping `whatsapp-web.js` (Puppeteer-driven WhatsApp Web client). Multi-session (`sessions` Map keyed by `sessionId`), `LocalAuth` persists login to disk. Talks to the Laravel backend over HTTP (`WHATSAPP_BOT_URL`, shared-secret `WHATSAPP_BOT_SECRET`). Started separately (`node index.js` / `start-bot.bat`), not via `php artisan serve`.

No root-level build — work inside whichever folder you're touching.

## Multi-tenancy — read this before touching any tenant-scoped model

Hybrid model, **not** one-DB-per-customer and **not** pure shared-DB:

- **Free/trial gyms** → shared `gemasystem` DB. Every tenant table has a `gym_id` column. `App\Scopes\GymScope` (applied via `App\Traits\BelongsToGym` on the model) auto-adds `WHERE gym_id = auth()->user()->gym_id` to every query.
- **Paid gyms** → their own dedicated database, named `gemasystem_gym_{gym_id}` (e.g. `gemasystem_gym_1`). These tables have **no `gym_id` column at all** — isolation is the whole database, not a WHERE clause. `BelongsToGym::getConnectionName()` switches the model to the `'tenant'` connection when `app('gym.plan') === 'paid'`; a middleware wires `config('database.connections.tenant')` to the right `db_name` per request.
- `gyms.plan_type` (`free`|`paid`) is the switch; `gyms.db_name` holds the tenant DB name for paid gyms.
- **Any new tenant-scoped model** needs `use BelongsToGym;` and must NOT manually filter by `gym_id` — the scope does it. Don't add `gym_id` to `$fillable` either; `BelongsToGym`'s `creating` hook strips it for paid gyms and auto-injects it for free ones.
- Currently 6 real paid-gym databases exist locally: `gemasystem_gym_1` (DymonGym — the one most manual testing/screenshots come from), `_3` (OlympoGYm), `_4`/`_5` (AnasGYms ×2), `_6` (MontyGym), `_10` (Apleeks).

### Schema changes — you need TWO migrations, every time

There is no single migration that reaches every database. For any schema change to a tenant-scoped table:

1. A normal migration in `database/migrations/` — applies to the shared `gemasystem` DB via the usual `php artisan migrate`.
2. A **mirror** migration in `database/migrations/tenant/` — same class name, same `up()`/`down()`, prefixed with a comment `// Tenant mirror of {other file} — see that file for rationale.` This one does **not** run automatically. Apply it to every paid gym's dedicated DB with:
   ```
   php artisan gym:migrate-tenants          # applies to all paid gyms
   php artisan gym:migrate-tenants --dry-run # lists gyms/DBs without running anything
   ```
   (`app/Console/Commands/MigrateTenantDatabases.php` — loops `Gym::where('plan_type','paid')`, points a `tenant` connection at each `db_name`, runs `migrate --path=database/migrations/tenant`.)

Guard both migrations with `Schema::hasTable(...)` / `Schema::hasColumn(...)` before altering — see any file in `database/migrations/tenant/` for the pattern. This isn't just style: **3 of the paid-gym databases (`gemasystem_gym_3`, `_4`, `_5`) are missing the `ingresos`, `discount_categories`, and `membership_types` tables entirely** (schema drift from an old version of the base tenant schema, never backfilled). Unguarded `Schema::table()` calls will hard-fail `gym:migrate-tenants` for those three. This is a known, still-open gap — flag it if you're touching Finances/discounts/membership-types and it becomes relevant, but backfilling it is its own separate task.

`database/migrations/tenant/2026_05_28_000001_create_tenant_schema.php` is the base schema for brand-new tenant DBs — it's what a fresh paid-gym provision runs. It does **not** retroactively apply to already-provisioned gyms; that's what the incremental tenant migrations + `gym:migrate-tenants` are for.

There are also two reference SQL dumps, `backend/database/gemasystem.sql` (shared DB) and `gemasystem_tenant.sql` (tenant template) — these are **stale relative to the real, live schema** (several tables added via migrations over time were never backported into them). Don't treat them as source of truth; they're occasionally useful for a from-scratch install but the migrations are what actually run.

### Validation against the tenant connection

Laravel 8's `Rule::unique("tenant.table")` / `Rule::exists("tenant.table")` dot-notation is **unreliable** here — `DatabasePresenceVerifier` doesn't resolve it correctly. Use an explicit closure with `DB::connection('tenant')->table(...)` instead. Helpers `Controller::existsInGym()` / `Controller::uniqueForGym()` already do this — use those rather than re-deriving it.

## Local environment

- **Database server is a standalone native MySQL Server 8.0 Windows install** (`C:\ProgramData\MySQL\MySQL Server 8.0\Data\`, binlogs named `DELLBRYANT-bin.NNNNNN`) — **not** MariaDB/XAMPP's bundled server, despite the project living under `C:\xampp\htdocs`. XAMPP is only serving PHP/Apache here; MySQL is separate. Default connection is `mysql` → `DB_DATABASE=gemasystem` (the shared DB — see `backend/.env`).
- The bundled XAMPP `mysql.exe` CLI client fails against this server (`Plugin caching_sha2_password could not be loaded`, wrong/older client). Use the real client instead: `"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe"` (same for `mysqlbinlog.exe`). Or just go through Laravel — `php artisan tinker` / `DB::` — which uses PHP's own driver and isn't affected.
- **Binary logging is ON** (`log_bin=ON`, `binlog_row_image=FULL`, ~30 day retention, `binlog_row_metadata=MINIMAL`) — every INSERT/UPDATE/DELETE/DDL on this server is recoverable from `mysqlbinlog` for about a month after the fact. This saved a real incident (see Feature & session history, DB recovery entry) — remember it's there before assuming lost data is actually gone. Two gotchas if you ever need it again: (1) `binlog_row_metadata=MINIMAL` means raw `BINLOG '...'` statement replay can hit "column N cannot be converted" charset/type errors even for a same-shape table — decode with `mysqlbinlog -v --base64-output=DECODE-ROWS` instead and rebuild real `INSERT`/`UPDATE`/`DELETE` by column *name*, not by replaying the binary blob; (2) match `UPDATE`/`DELETE` replay by primary key only, never the full before-image — one early row that predates the retention window (no INSERT event ever seen for it) makes every later full-row-match silently stop matching and cascades into losing all its subsequent updates too.
- **Several real columns/tables exist only via an undocumented raw SQL setup, not any Laravel migration** — `php artisan migrate:fresh` (or a from-scratch `migrate`) will *not* recreate them: `members.member_code`, `trainers.certifications`, `visits.price` + `visits.payment_method`, and the tables `labels`, `member_labels`, `settings`, `ingresos` on the shared `gemasystem` DB. `backend/database/gemasystem.sql` / `gemasystem_tenant.sql` are stale as *data* sources (do not restore rows from them) but are the only record of these tables' correct structure — treat them as a schema reference only. Also: `database/migrations/*.php` files are not reliable evidence of the column *order* that's actually live — at least `users` and `pending_checkouts` have real column orders that don't match what their migration's `->after(...)` clauses claim (verify empirically against real data/binlog before trusting a migration file's implied order for anything recovery-adjacent).
- `php artisan gym:migrate-tenants` reaches the 6 paid-gym DBs listed above from the same MySQL server.
- GD extension must be enabled in `php.ini` (needed for `ImageUploadService`'s WebP re-encoding — product images).
- `APP_URL` must point at the real XAMPP Apache path (`http://localhost/DymonSystem/backend/public`), not `localhost:8000` — `Storage::disk('public')->url()` depends on it. Requires `php artisan storage:link`.
- On Windows, IIS (`W3SVC`/`WAS`) squatting port 80 will silently break Apache — if uploaded images/assets 404 for no obvious reason, check `netstat`/`Get-NetTCPConnection` for something already bound to :80 before assuming it's a code bug.
- `.env` keys of note beyond the obvious DB/mail ones: `OPERATOR_PIN` (constant-time-compared PIN for the hidden operator/superadmin login), `WHATSAPP_BOT_URL`/`WHATSAPP_BOT_SECRET`/`WHATSAPP_ENABLED`, `STRIPE_*` (checkout + webhook), `RECAPTCHA_SECRET_KEY` (trial signup form), `ANTHROPIC_API_KEY` (powers "Nova", the in-app AI assistant referenced on the landing page).

## Frontend conventions

### Design system (`frontend/src/index.css`)

Everything themes off CSS custom properties on `:root`, redefined under `html.dark`:
- `--color-primary-{50,100,500,600,700,800}` — the app's single accent color, changed at runtime by `applyTheme(themeId)` (`utils/theme.js`) when a gym picks a color in Configuración → Apariencia. **Prefer `var(--color-primary-*)` over hardcoded hex** for anything meant to feel "on-brand" (buttons, active states) so it follows the gym's chosen theme instead of being stuck purple.
- `--surface-{base,1,2,3}`, `--surface-border`, `--surface-border2`, `--text-{primary,secondary,muted}` — flip between light/dark automatically.
- Shared component classes: `.btn-primary` / `.btn-secondary` / `.btn-danger` / `.btn-ghost`, `.input`, `.label`, `.card`, `.badge-*`. Use these instead of ad-hoc Tailwind color classes — they already carry dark-mode handling.

### Dark mode — how it actually works here

Toggled by adding/removing a `dark` class on `<html>` (`settingsStore.js`, `document.documentElement.classList.toggle('dark', enabled)`) — **not** Tailwind's `dark:` variant (that would key off OS `prefers-color-scheme`, which isn't what's wanted for a user-toggled setting, and no `@custom-variant dark` is defined for Tailwind v4 to repoint it). Instead `index.css` has a large block of manual overrides: `html.dark .bg-gray-50 { background-color: var(--surface-1) !important; }` and similar, covering the Tailwind utility classes actually used in the app (grays, semantic colors indigo/blue/emerald/red/amber/etc., at several shade levels, plus hover states).

Consequences worth knowing before you add new UI:
- A Tailwind color utility only renders correctly in dark mode if it's in that override table. Opacity-modifier classes (`bg-gray-50/40`) generate a **different** class name than the base (`bg-gray-50`) and are **not** covered by the base override — they were the root cause of a "washed out" look across every table's zebra-striping until fixed with wildcard selectors (`html.dark [class*="bg-gray-50/"] { ... }`). If you introduce a new `bg-{color}-{shade}/{opacity}` combo, check whether it needs a matching wildcard rule.
- `slate` isn't covered at all (only `gray` is) — a `bg-slate-50` card will stay stubbornly light in dark mode. Use `gray`.
- When you need a genuinely new tint not in the table, prefer `color-mix(in srgb, var(--color-primary-500) N%, transparent)` inline (already dark-mode-safe by construction) over adding another raw Tailwind color class.

### Responsive layout — patterns established across Members/Visits/Memberships/Finances/Products/TrainerTable

- **Sidebar is `position: fixed`** (`components/layout/Sidebar.jsx`), so it doesn't participate in the root flex row's width math — the content wrapper next to it needs `min-w-0` or a deeply-nested wide grid/chart can force the *entire page* wider than the viewport (classic flexbox "child won't shrink below its content's min-width" bug). `Layout.jsx`'s content wrapper and `<main>` both carry `min-w-0` + `overflow-x-hidden` as a result — don't remove those.
- Tables switch to a stacked card layout **below `lg` (1024px)**, not `md` (768px) — `md` was tried first and left tablets (iPad Air portrait ≈820px) with a table that's technically visible but too cramped (6 columns in ~560px after the sidebar). Pattern: `<div className="hidden lg:block overflow-x-auto"><table>...</table></div>` immediately followed by `<div className="lg:hidden divide-y ...">{items.map(card)}</div>` — both branches read from the same data, kept manually in sync (no shared row-renderer abstraction exists yet).
- Within a table, to truncate a long value (member name, email) instead of letting it wrap and blow out row height: give the `<td>` `className="w-full max-w-0"` and the inner text `truncate` (needs `min-w-0` on any flex wrapper in between). This is the standard "flexible table column" trick — `max-w-0` + `w-full` makes the auto-layout algorithm treat the column as compressible instead of sizing to content.
- Table rows should get `align-top` on every `<td>` explicitly — the HTML default (`vertical-align: middle`) looks fine until one column wraps to 2+ lines and every shorter cell in that row visibly floats to the middle instead of lining up at the top.
- `ImportDataTab.jsx`'s raw file-preview table is a deliberate exception — it stays horizontally scrollable instead of becoming cards, because its columns are literally whatever the uploaded spreadsheet has; collapsing it to cards would defeat the point (visually checking column-to-field mapping).

### Settings page structure (`pages/Settings.jsx`)

Tab-based (`TABS` array), shared `SectionHeader` (tab-level icon+title) and `SubCard` (grouped field cluster within a tab) components — both intentionally neutral/gray, not color-coded per tab. That was a deliberate choice after iterating through a few louder designs the user didn't like: **purple (the theme accent) is reserved for buttons and active/on states; page chrome stays white/gray.** Keep new Settings sections consistent with that rather than reintroducing per-section accent colors.

A `SubCard`'s own inline `<form>` for "add new X" (membership types, discount categories) can't nest inside the tab's outer price-form `<form>` — HTML forbids nested forms. Where a save button needs to visually sit *after* such sections, the outer form gets an `id` and the button uses the HTML `form="that-id"` attribute to submit it despite being a DOM sibling, not a descendant (see `SaveBtn`'s `form` prop and `PricesTab`).

### Routing (`App.jsx`)

- Public: `/`, `/register`, `/forgot-password`, `/support`, `/proyectos`, `/terminos`, `/privacidad`, `/checkout/success`.
- Operator/admin console: `/sys/:hash` (hash-scoped session, guarded by `OperatorHashGuard`) — reached via the operator PIN login flow inside the main `AuthModal`, not a standalone page route.
- Gym app: `/g/:hash` (hash-scoped session, `HashGuard`) wraps `Layout`, with children `panel`, `socios`, `socio/:id`, `clases`, `visitas`, `membresias`, `productos`, `finanzas`, `ajustes`, `whatsapp`, `soporte`, `perfil`.
- The session "hash" in both cases is an opaque per-login identifier in the URL, not the raw user/gym id.

## Feature & session history — what's been built and how

Everything below is folded in from past-session memory plus this session's own work, so it lives in one place instead of scattered across separate memory files. Each entry: what changed, why, and the specific mechanics — not just "this exists" but how it actually works, so you're not re-deriving it from scratch.

### 1. Settings page (2026-05-24) — the original build

System-wide config page so a gym can change its name, theme color, default prices, and see itself reflected everywhere without a code change.

- `Setting` model — plain key-value Eloquent rows, `SettingController::index()`/`update()`.
- `frontend/src/utils/theme.js` — `THEME_OPTIONS` array + `applyTheme(id)`, which just writes `--color-primary-*` CSS vars onto `:root`.
- `frontend/src/store/settingsStore.js` — persisted Zustand store holding `systemSettings` + `privacyMode`; `loadSettings()` is called once from `Layout.jsx` on mount and is the only thing that calls `applyTheme()` on load.
- Everywhere a price needs to auto-fill (new visit, new membership) reads `systemSettings.price_visit_{type}` / `price_membership_{plan}` — that convention (settings key = `price_{visit|membership}_{type}`) is still how `PricesTab` in Settings.jsx builds its form today.
- The page has been redesigned twice since (see #7 below) — the *plumbing* described here (settingsStore, applyTheme, the price-key naming) is unchanged; only the visual layer moved.

### 2. Security & forms hardening (2026-05-29)

- Operator/superadmin login split from the normal user login: `POST /api/auth/operator-login` requires `login` + `password` + `pin`, where `pin` is `hash_equals()`-checked against `OPERATOR_PIN` (env). Regular `/api/auth/login` explicitly rejects operator accounts (`extended_access=1`) with a generic error so it can't be brute-forced through the normal form. The frontend entry point for this today is the PIN step inside the main `AuthModal` (see Routing above) — there was an earlier standalone `/console` page (`OperatorLogin.jsx`) but that route now just redirects to `/`; the component file still exists but isn't routed.
- `plan_type` (`free`/`paid`) rides along on auth responses (`AuthController::userPayload()` loads the `gym` relation) so the frontend can show a trial-vs-paid badge without a second request.
- What used to be fake forms (just a `setTimeout`) now hit real endpoints: trial signup → `POST /trial-requests`, landing-page reviews → `POST /submissions` (type=review), support tickets → `POST /submissions` (type=ticket). All land in `FormSubmission` rows, surfaced in SuperAdmin's **Mensajes** tab (filter by type/status, mark read/archive) with an unread-count badge in the operator sidebar.

### 3. Multi-tenant rollout

The hybrid model described in full above (## Multi-tenancy) was built incrementally:
- `gyms` table + `gym_id` added across every tenant table (users, members, trainers, classes, labels, settings, memberships, visits, payments, ...).
- Stripe checkout (`StripeController::fulfill()`) is the **only** signup path — creates the `Gym` row, creates the `User` with a generated `access_code` (random 8 chars, `access_code_changes` counter starts at 0), seeds ~19 default `Setting` rows for that gym, emails the access code via `UserWelcome`. The older direct `AuthController::register()` was removed once this existed.
- Watch for **raw `DB::table()` queries** bypassing `GymScope` — `VisitController::index()` has one that manually adds `->where('gym_id', ...)`, and `SettingController::update()` deliberately uses `withoutGlobalScope(GymScope::class)` + an explicit `gym_id` on its `updateOrCreate` (global scope would break the upsert lookup there). If you add a raw query against a tenant table on the shared-DB side, you likely need the same manual `gym_id` filter.

### 4. GymOS → GemaSystem rename (2026-07-29)

Naming went through a few rounds before landing (for context only — don't resurrect these): GymOS → GymDeck (rejected, still had "Gym" in it) → G-word options without "Gym" (Garrison/Griffon/Gyra, rejected) → acronym around "Gestión Estratégica de Membresías Administrativas" → **GEMA** → **GemaSystem**.

What actually happened: case-sensitive bulk replace across 69 files (`GymOS`→`GemaSystem`, the `GymOs` typo variant too, lowercase `gymos`→`gemasystem` covering DB names/cookie name/storage keys/zustand persist key/email domain), file renames (`GymOSLogo.jsx`→`GemaSystemLogo.jsx`, the two `.sql` dumps), and the **live databases were physically renamed** with `RENAME TABLE` (`gymos`→`gemasystem`, `gymos_gym_{1,3,4,5}`→`gemasystem_gym_{1,3,4,5}`, `gyms.db_name` updated to match). If you ever see a bare `grep -ri gymos` hit, it should only be the intentionally-excluded generic "gym" words listed in the intro section above — anything else is a rename that got missed.

### 5. Member code + QR generation (2026-07-30)

Every member gets a `member_code` (e.g. `DYM-0002`) and a `qr_token` for check-in scanning.

- `Gym::generateUniqueCode($name)` builds a 3-letter gym prefix: initials of the first 3 words if the gym name has that many, else first 3 letters, else random-filled — retried on collision against other gyms' `code`. Backfilled onto all existing gyms via migration (confirmed: DymonGym→DYM, OlympoGym→OLY, the duplicate "OlympoGYm"→OLH, duplicate "AnasGYms"→ANA/ANV, MontyGym→MON).
- `App\Services\MemberCodeService` centralizes `gymPrefix()` (resolves the current gym's prefix off `auth()->user()->gym_id`, self-healing if missing), `next($prefix)` (row-locked sequential `PREFIX-0001`), and `qrToken()`. Used by both manual member creation (`MemberController::store()`) and bulk import (`ImportController::importMembers()`/`importMemberships()` when a membership import needs to auto-register a member that doesn't exist yet).
- Gotcha: `gymPrefix()` needs the request to have actually gone through `auth:sanctum` — testing it from Tinker directly requires `Auth::shouldUse('sanctum')` first, or it silently falls back to the literal string `'GYM'`.
- Old pre-existing codes are all hardcoded `DYM-xxxx` regardless of which gym they belong to (leftover from when this was single-tenant "DymonSystem") — left as historical data, not backfilled; only new codes use the per-gym prefix.

### 6. Products / inventory feature (2026-07-30, iteration 2 on 2026-07-31)

Per-gym product catalog + point-of-sale-style selling, feeding into the same Finances ledger.

- New `products` / `product_sales` tables follow the standard dual-migration pattern (shared DB migration with `gym_id` + tenant-folder mirror without it). `Product` / `ProductSale` models use `BelongsToGym` like everything else.
- `ProductSaleController::sell()` — first use of row-locking in this codebase (`lockForUpdate()` inside a `DB::connection(...)->transaction()`) to stop overselling limited stock under concurrent requests. It then creates an `Ingreso` (`origin='product'`) in a **separate** try/catch *after* the sale transaction commits — a ledger write failing must never roll back a sale that already happened; same resilience pattern `VisitController::store()` uses.
- `App\Services\ProductSkuService::generate($name)` auto-generates a SKU (`PROT-0001` style) when one isn't supplied — same locked-sequential idea as `MemberCodeService`.
- `ImageUploadService::processAndStore()` is the security boundary for product photos: size cap → real `finfo` MIME sniff → `getimagesize()` type allow-list (JPEG/PNG/GIF/WEBP only — **no SVG**) → mime/type cross-check → dimension caps → decode via GD then **re-encode from scratch as WebP**. Only the re-encoded pixel data is ever persisted; the originally-uploaded bytes never touch disk. This specifically defeats polyglot files / embedded payloads / poisoned EXIF, not just "wrong extension" — verified against a PHP-shell-as-.jpg, a text-file-as-.png, and an SVG-with-script, all correctly rejected.
- Environment changes this required, in case they regress: GD extension enabled in `php.ini` (was off), `APP_URL` corrected to the real XAMPP path (see Local environment above), `php artisan storage:link` run (no symlink existed before this feature at all).
- `app/Console/Commands/MigrateTenantDatabases.php` (`gym:migrate-tenants`) was **built for this feature** — before it, tenant-only migrations had been applied by hand with no tooling. Reuse it for every future tenant-schema change.
- `GET /products/{product}/stats` — per-product sales_count/units_sold/revenue/profit/margin, 6-month trend, by-payment-method breakdown, last-15 sales; powers `ProductDetailModal`. `ProductController::index()` eager-loads a `units_sold` sum for the catalog card badges.
- The "images don't show" bug reported during this feature turned out to be **Windows IIS squatting port 80**, not a code issue — see Local environment above.
- This is also where the still-open **missing-tables-in-3-tenant-DBs** gap was first discovered (see Known gaps below) — the defensive `Schema::hasTable()` guarding convention exists specifically because of this.

### 7. This session (2026-08-12 → 2026-08-13) — Settings redesign, dark mode, full responsive pass

The largest single continuous piece of work in the project's history so far. Roughly in order:

- **Settings page visual redesign, iterated three times based on direct feedback:** first pass gave every tab its own accent color (rainbow nav + colored icon chips) — rejected ("no me gusta"). Second pass went fully neutral gray with purple reserved for buttons/active-states only — this is what stuck and is documented under Settings page structure above. Also split `GeneralTab` into "Identidad"/"Contacto" sub-cards and grouped `SecurityTab` into `SubCard`s for consistency with the rest of the tab system.
- **Dark mode systemic fix:** found and fixed real contrast bugs in `index.css`'s override table (`text-amber-800`/`text-blue-800` had no dark equivalent and rendered near-black text on a near-black background; several `border-*-200`/`400` shades were missing too) — fixed by extending the table, which also silently fixed the same bug on ~13 other pages using those same classes. Separately discovered and fixed the **opacity-modifier gap**: `bg-gray-50/40` (used for table zebra-striping app-wide) generates a distinct class from `bg-gray-50` and was never covered by the dark override at all — added wildcard-selector rules (`[class*="bg-gray-50/"]`) to close that for every color/opacity combination in use.
- **Full responsive pass across the landing page and the core app**, explicitly for phone + tablet, ending with "no horizontal scroll anywhere":
  - Landing page: converted the largest headings to fluid `clamp()`-based sizing instead of hard Tailwind breakpoint jumps (mirroring a fluid-sizing technique the user had used in a prior, unrelated project).
  - Found and fixed the actual page-level horizontal-overflow root cause: `Layout.jsx`'s content wrapper next to the `fixed`-position sidebar had no `min-w-0`, so any wide nested content anywhere on any page could force the *whole page* wider than the viewport (see Responsive layout above — this is the fix that mattered most, more than any individual page tweak).
  - Swept the whole frontend for rigid `grid-cols-2/3/4/5` with no responsive fallback (mostly two-field form rows inside modals — "Nombre"/"Apellido" side by side with nowhere to shrink on a phone) and added `grid-cols-1 sm:grid-cols-2` (etc.) across roughly 15 files, including the shared `QuickVisitModal`/`QuickMembershipModal`/`QuickProductModal` (used from the floating-action-button on every page, so fixing those three propagated everywhere at once).
  - Converted every data `<table>` (Members, Visits, Memberships, Finances, Products ×2, `TrainerTable`, WhatsApp message log ×2) to the dual table/card pattern described above, then iterated again after real-device testing (iPad Air, 820px) showed the first breakpoint choice (`md`) still put a cramped table on tablets — moved to `lg`. Then a further round fixing per-cell issues the breakpoint change didn't cover: phone numbers word-wrapping mid-digit, cells vertically centering instead of aligning to the row's top when a sibling cell had multi-line content (`align-top` added everywhere), and — specifically on Members — trimming the "Miembro" cell down to just name (was also showing member code + visit count, causing 4-line-tall rows on long names) and giving every other column an equal explicit width so only that name column flexes.
- **`OnboardingWizard.jsx` redesign** (the first-login setup flow): added a WhatsApp feature card (with a small animated mock chat preview) to the "Descubre" step, turned that step into an auto-advancing Stories-style carousel with swipe support, added confetti on the final "done" step, made the stepper's completed circles clickable to jump back, and swapped every hardcoded purple hex for `var(--color-primary-*)` so the wizard follows the gym's actual chosen theme color instead of being hardcoded indigo.
- **Membership type colors:** added a `color` column to `membership_types` (migration pair + `gym:migrate-tenants` run against all 6 live paid-gym DBs, done as part of this session — not just written, actually applied), let a gym pick from an 8-color preset palette when creating a new type, render each type as a colored pill (color + name, not just an unlabeled dot) in both the Settings chip list and the Members table's Etiquetas column, and moved the "Tipos de membresía"/"Categorías de descuento" sections above the "Guardar cambios" button in `PricesTab` (needed the `form="id"` trick from Settings page structure above, since those sections' own inline "add new" forms can't nest inside the price form).

### 8. Shared-DB data-loss incident and binlog recovery (2026-08-12 evening)

Something ran the equivalent of `php artisan migrate:fresh` **twice** against the shared `gemasystem` database, ~2 minutes apart (22:52:24 and 22:54:10 local time, confirmed via `mysqlbinlog` event timestamps) — dropped all 25 tables and rebuilt them empty from migrations. Not caused by anything in this session (this session's own DB work that day was additive-only, and finished *before* 22:52). The 6 paid-gym tenant databases were never touched — only `gemasystem` (the shared free-tier + gyms/users directory DB) emptied out. User reported it the next session as "an AI deleted things from the database" and asked for restoration to the last-known-good state.

Recovered via `mysqlbinlog` (binlog retention covers ~30 days, well past this DB's actual inception, and `binlog_row_image=FULL` so every row's full state is in every event, not just changed columns): rebuilt the pre-July-7 schema baseline from the *actual* pre-July-7 migration files (not `migrate:fresh`, which only produces the *current* schema) plus the 4 undocumented tables (see Local environment above), then replayed every DDL+DML event from binlog in original chronological order up to the second before the first `DROP TABLE`. Two non-obvious things made the difference between a broken and a working recovery, both now captured under Local environment: decode with `-v --base64-output=DECODE-ROWS` and rebuild real SQL by column name (raw `BINLOG` blob replay fails on `binlog_row_metadata=MINIMAL` type-compatibility checks even for a same-shape table), and match `UPDATE`/`DELETE` replay by primary key only (matching the full row cascades into silent no-ops the moment one row predates the retention window).

Result: 8 gyms (the real 6 paid ones + 2 free/trial), 6 users, plus `pending_checkouts`/`gym_notifications`/`support_tickets`/`ticket_messages`/`settings` restored to their exact pre-incident state, cross-validated against known-good facts (the hidden operator account's `extended_access` flag, gym Stripe IDs, etc.) before writing anything to the live DB. `members`/`visits`/`memberships`/`trainers`/`ingresos`/`products` in the *shared* DB legitimately recover to 0 rows — every row ever created there in the recoverable window was itself deleted again later by whatever QA/test script created it (confirmed by diffing insert-IDs against delete-IDs, all identical sets) — this is not a recovery gap, the real member/visit/etc. data for actual gyms has always lived in the tenant DBs, untouched throughout.

## Known gaps / things flagged but not fixed

- **Missing tables in 3 tenant DBs** (`gemasystem_gym_3`, `_4`, `_5` lack `ingresos`, `discount_categories`, `membership_types`) — see the migrations section above. Finances and discount/membership-type settings are likely already broken for OlympoGYm and both AnasGYms tenants, independent of anything else. Needs a dedicated backfill migration.
- `ImportDataTab.jsx` and a few decorative marketing components (`SystemCards.jsx` mock UI previews on the landing page) use hardcoded hex inline styles rather than the theme/dark-mode system — acceptable there (they're either literal data previews or intentionally-static marketing mockups), don't assume the same is fine elsewhere.

## Useful commands

```bash
# Backend (run from backend/)
php artisan migrate                          # shared DB
php artisan gym:migrate-tenants               # mirror pending tenant/ migrations to every paid gym DB
php artisan gym:migrate-tenants --dry-run     # preview which gyms/DBs would be touched
php -l path/to/file.php                       # quick syntax check

# Frontend (run from frontend/)
npm run dev                                   # Vite dev server
npm run build                                 # production build — good smoke test after JSX-heavy edits
npx eslint src/path/to/file.jsx                # this repo's eslint config is stricter than default (flags
                                               # react-hooks patterns like setState-in-effect, watch() from
                                               # react-hook-form, components defined during render); most
                                               # existing hits across the codebase are pre-existing, not
                                               # regressions — check whether a finding is on a line you
                                               # actually touched before treating it as yours to fix

# WhatsApp bot (run from whatsapp-bot/)
node index.js                                 # or start-bot.bat on Windows
```

## Memory index

Longer-lived, dated notes from past sessions live in `~/.claude/projects/.../memory/` (see `MEMORY.md` there for the index) — multi-tenant history, the GymOS→GemaSystem rename, member-code/QR generation, the products/inventory feature, security/forms hardening, and the original settings-page build. Treat them as point-in-time observations per their own staleness warnings, not current fact — this file supersedes them where they conflict (e.g. React is 19, not 18; the DB is `gemasystem`, not `gymos`).
