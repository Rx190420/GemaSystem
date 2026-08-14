@php
  $LOGO = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjQ0MyA1MyA1NTQgNzA1Ij48cGF0aCBmaWxsPSIjZmZmIiBkPSJNNTg2LjY5MTQwNiA2MTYuMTcxODc1TDQ0OS4xNzE4NzUgNjE2LjE3MTg3NUM0NDUuODAwNzgxIDYxNi4xNzE4NzUgNDQzLjA3MDMxMiA2MTMuNDM3NSA0NDMuMDcwMzEyIDYxMC4wNjY0MDZMNDQzLjA3MDMxMiAyOTQuNTcwMzEyQzQ0My4wNzAzMTIgMTYxLjc4OTA2MiA1NjAuMTcxODc1IDUzLjc2MTcxOSA3MDQuMTEzMjgxIDUzLjc2MTcxOUw4NTIuNDkyMTg4IDUzLjc2MTcxOUM4NTUuODU1NDY5IDUzLjc2MTcxOSA4NTguNTg1OTM4IDU2LjQ5NjA5NCA4NTguNTg1OTM4IDU5Ljg2NzE4OEw4NTguNTg1OTM4IDE4NS43NzczNDRDODU4LjU4NTkzOCAxODkuMTQ0NTMxIDg1NS44NTU0NjkgMTkxLjg3ODkwNiA4NTIuNDkyMTg4IDE5MS44Nzg5MDZMNzA0LjExMzI4MSAxOTEuODc4OTA2QzY0Mi43MjY1NjIgMTkxLjg3ODkwNiA1OTIuNzg5MDYyIDIzNy45NDUzMTIgNTkyLjc4OTA2MiAyOTQuNTcwMzEyTDU5Mi43ODkwNjIgNjEwLjA2NjQwNkM1OTIuNzg5MDYyIDYxMy40Mzc1IDU5MC4wNTg1OTQgNjE2LjE3MTg3NSA1ODYuNjkxNDA2IDYxNi4xNzE4NzUiLz48cGF0aCBmaWxsPSIjZmZmIiBkPSJNNzM1Ljg3NSA3NTAuMDExNzE5TDczNS44NzUgNjI0LjAxOTUzMUM3MzUuODc1IDYyMC43NDYwOTQgNzM4LjQ2MDkzOCA2MTguMDkzNzUgNzQxLjczODI4MSA2MTcuOTMzNTk0QzgwMC40MDYyNSA2MTUuMTEzMjgxIDg0Ny4yMDMxMjUgNTcwLjE5NTMxMiA4NDcuMjAzMTI1IDUxNS4zNzg5MDZMODQ3LjIwMzEyNSA0NjkuOTE0MDYyQzg0Ny4yMDMxMjUgNDY2LjU0Njg3NSA4NDQuNDY0ODQ0IDQ2My44MTI1IDg0MS4xMDE1NjIgNDYzLjgxMjVMNzQxLjk4MDQ2OSA0NjMuODEyNUM3MzguNjEzMjgxIDQ2My44MTI1IDczNS44NzUgNDYxLjA4MjAzMSA3MzUuODc1IDQ1Ny43MTA5MzhMNzM1Ljg3NSAzMzEuODAwNzgxQzczNS44NzUgMzI4LjQyOTY4OCA3MzguNjEzMjgxIDMyNS43MDMxMjUgNzQxLjk4MDQ2OSAzMjUuNzAzMTI1TDk5MC44MTY0MDYgMzI1LjcwMzEyNUM5OTQuMTg3NSAzMjUuNzAzMTI1IDk5Ni45MjE4NzUgMzI4LjQyOTY4OCA5OTYuOTIxODc1IDMzMS44MDA3ODFMOTk2LjkyMTg3NSA1MTUuMzc4OTA2Qzk5Ni45MjE4NzUgNjQ2LjIzNDM3NSA4ODMuMTg3NSA3NTMuMDQ2ODc1IDc0Mi4xMjEwOTQgNzU2LjEyMTA5NEM3MzguNjk5MjE5IDc1Ni4xOTUzMTIgNzM1Ljg3NSA3NTMuNDM3NSA3MzUuODc1IDc1MC4wMTE3MTkiLz48L3N2Zz4=';
@endphp
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
