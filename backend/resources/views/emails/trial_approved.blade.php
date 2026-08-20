@extends('emails._layout')

@section('title', 'Tu solicitud fue aprobada — GemaSystem')

@section('nav-extra')
  <span style="margin-left:auto;font-size:11px;font-weight:600;color:#16a34a;text-transform:uppercase;letter-spacing:.8px;">Aprobado</span>
@endsection

@section('content')
  <div class="hero">
    <div class="icon-badge icon-badge-green">
      <img src="{{ $ICON_CHECK_CIRCLE }}" width="26" height="26" alt="" style="display:inline-block;">
    </div>
    <p class="eyebrow">Solicitud de prueba</p>
    <h1 class="h1">Tu cuenta está lista</h1>
  </div>
  <p class="lead">La solicitud de acceso para <strong>{{ $gymName }}</strong> ha sido aprobada. A continuación encontrarás tus credenciales. Guárdalas en un lugar seguro.</p>

  <div class="box">
    <div class="box-label">Credenciales de acceso</div>
    <div class="row">
      <span class="rk">Usuario</span>
      <span class="rv" style="font-family:'Courier New',monospace;font-size:15px;">{{ $username }}</span>
    </div>
    <div class="row">
      <span class="rk">Contraseña</span>
      <span class="rv" style="font-family:'Courier New',monospace;font-size:15px;">{{ $password }}</span>
    </div>
    <div class="row">
      <span class="rk">Período de prueba</span>
      <span class="rv"><span class="pill pill-green">{{ $trialDays }} días gratis</span></span>
    </div>
  </div>

  <div class="notice green">
    <p class="notice-text">Tienes <strong>{{ $trialDays }} días de prueba gratuita</strong> para explorar todas las funciones de GemaSystem. Después podrás elegir el plan que mejor se adapte a tu gimnasio.</p>
  </div>

  <div class="notice amber">
    <p class="notice-text"><strong>Importante:</strong> Cambia tu contraseña después de iniciar sesión por primera vez.</p>
  </div>

  <div style="margin-top:4px;">
    <div style="font-size:11px;font-weight:700;color:#a1a1aa;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">Cómo iniciar sesión</div>
    @foreach([['Ingresa a la plataforma GemaSystem', "con tu usuario: {$username}"], ['Usa la contraseña temporal', "proporcionada en este correo"], ['Completa la configuración inicial', 'de tu gimnasio']] as $i => $step)
    <div style="display:flex;gap:12px;align-items:flex-start;margin-bottom:10px;">
      <div style="width:22px;height:22px;border-radius:50%;background:#6366f1;color:#fff;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;">{{ $i+1 }}</div>
      <p style="font-size:13px;color:#52525b;line-height:1.6;"><strong style="color:#09090b;">{{ $step[0] }}</strong> — {{ $step[1] }}</p>
    </div>
    @endforeach
  </div>
@endsection
