<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>@yield('title') — GemaSystem</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { background:#f4f4f5; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif; color:#09090b; -webkit-font-smoothing:antialiased; }
    .wrap { max-width:560px; margin:40px auto; padding:0 20px 40px; }
    .card { background:#fff; border:1px solid #e4e4e7; border-radius:8px; overflow:hidden; }
    /* ── Nav ── */
    .nav { padding:18px 24px; border-bottom:1px solid #f4f4f5; display:flex; align-items:center; gap:8px; }
    .nav-icon { width:24px; height:24px; background:linear-gradient(135deg,#6366f1,#7c3aed); border-radius:5px; padding:3px; box-sizing:border-box; }
    .nav-name { font-size:14px; font-weight:800; color:#09090b; letter-spacing:-0.3px; }
    /* ── Body ── */
    .body { padding:32px 24px; }
    .eyebrow { font-size:11px; font-weight:700; color:#6366f1; text-transform:uppercase; letter-spacing:1.2px; margin-bottom:8px; }
    .h1 { font-size:22px; font-weight:700; color:#09090b; line-height:1.3; margin-bottom:10px; }
    .lead { font-size:14px; color:#52525b; line-height:1.7; margin-bottom:24px; }
    /* ── Info box ── */
    .box { background:#fafafa; border:1px solid #e4e4e7; border-radius:6px; padding:18px 20px; margin-bottom:20px; }
    .box-label { font-size:10px; font-weight:700; color:#a1a1aa; text-transform:uppercase; letter-spacing:1px; margin-bottom:10px; }
    .row { display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid #f0f0f0; font-size:13px; }
    .row:last-child { border-bottom:none; padding-bottom:0; }
    .rk { color:#71717a; }
    .rv { font-weight:600; color:#09090b; text-align:right; }
    /* ── Code ── */
    .code-box { background:#fafafa; border:1px solid #e4e4e7; border-radius:6px; padding:28px; text-align:center; margin-bottom:20px; }
    .code { font-size:44px; font-weight:800; color:#09090b; letter-spacing:10px; font-family:'Courier New',monospace; }
    .code-hint { font-size:12px; color:#a1a1aa; margin-top:10px; }
    /* ── Notices ── */
    .notice { border-left:3px solid #e4e4e7; padding:12px 16px; margin-bottom:20px; border-radius:0 4px 4px 0; background:#fafafa; }
    .notice p,.notice-text { font-size:13px; line-height:1.65; color:#52525b; }
    .notice.blue   { border-color:#6366f1; background:#f5f3ff; }
    .notice.green  { border-color:#22c55e; background:#f0fdf4; }
    .notice.amber  { border-color:#f59e0b; background:#fffbeb; }
    .notice.red    { border-color:#ef4444; background:#fef2f2; }
    /* ── Pill badges ── */
    .pill { display:inline-block; padding:2px 9px; border-radius:4px; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; }
    .pill-basic   { background:#f5f3ff; color:#7c3aed; border:1px solid #ddd6fe; }
    .pill-premium { background:#eff6ff; color:#2563eb; border:1px solid #bfdbfe; }
    .pill-vip     { background:#fffbeb; color:#d97706; border:1px solid #fde68a; }
    .pill-green   { background:#f0fdf4; color:#16a34a; border:1px solid #bbf7d0; }
    .pill-red     { background:#fef2f2; color:#dc2626; border:1px solid #fecaca; }
    .pill-icon    { width:12px; height:12px; vertical-align:-2px; margin-right:1px; }
    /* ── Icon badge (hero icon at the top of every email) ──
       line-height + vertical-align:middle centers the icon even in clients
       that ignore flexbox; inline-flex centers it properly everywhere else. */
    .hero { text-align:center; margin-bottom:22px; }
    .icon-badge {
      width:56px; height:56px; line-height:56px; text-align:center; border-radius:50%;
      margin:0 auto 16px; display:inline-flex; align-items:center; justify-content:center;
    }
    .icon-badge img { display:inline-block; vertical-align:middle; }
    .icon-badge-green  { background:#f0fdf4; }
    .icon-badge-red    { background:#fef2f2; }
    .icon-badge-amber  { background:#fffbeb; }
    .icon-badge-indigo { background:#eef2ff; }
    .icon-badge-purple { background:#faf5ff; }
    .icon-badge-gray   { background:#f4f4f5; }
    .hero .h1 { margin-bottom:0; }
    /* ── Misc ── */
    hr { border:none; border-top:1px solid #f4f4f5; margin:20px 0; }
    .btn { display:block; background:#09090b; color:#fff!important; text-decoration:none; padding:13px 20px; border-radius:6px; font-size:14px; font-weight:600; text-align:center; margin-bottom:20px; }
    .btn-indigo { background:#6366f1; }
    .qr-wrap { display:inline-block; padding:8px; background:#fff; border:1px solid #e4e4e7; border-radius:6px; }
    /* ── Footer ── */
    .footer { padding:16px 24px; border-top:1px solid #f4f4f5; }
    .footer p { font-size:11px; color:#a1a1aa; text-align:center; line-height:1.7; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">

      <div class="nav">
        <div class="nav-icon">
          <img src="{{ $LOGO }}" width="18" height="18" alt="G" style="display:block;">
        </div>
        <span class="nav-name">GemaSystem</span>
        @yield('nav-extra')
      </div>

      <div class="body">
        @yield('content')
      </div>

      <div class="footer">
        <p>© {{ date('Y') }} GemaSystem &middot; Correo automático, no respondas a este mensaje.</p>
        @yield('footer-extra')
      </div>

    </div>
  </div>
</body>
</html>
