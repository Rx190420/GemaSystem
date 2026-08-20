@extends('emails._layout')

@section('title', 'Tu cuenta en GemaSystem')

@section('nav-extra')
  <span style="margin-left:auto;font-size:11px;font-weight:600;color:#a1a1aa;text-transform:uppercase;letter-spacing:.8px;">Acceso</span>
@endsection

@section('content')
  <div class="hero">
    <div class="icon-badge icon-badge-indigo">
      <img src="{{ $ICON_USER_CHECK }}" width="26" height="26" alt="" style="display:inline-block;">
    </div>
    <p class="eyebrow">Cuenta creada</p>
    <h1 class="h1">Tu cuenta está lista</h1>
  </div>
  <p class="lead">Se ha creado tu cuenta en GemaSystem. A continuación encontrarás tus credenciales de acceso. Guárdalas en un lugar seguro.</p>

  <div class="box">
    <div class="box-label">Credenciales de acceso</div>
    <div class="row">
      <span class="rk">Usuario</span>
      <span class="rv" style="font-family:'Courier New',monospace;font-size:15px;">{{ $username }}</span>
    </div>
    <div class="row">
      <span class="rk">Contraseña temporal</span>
      <span class="rv" style="font-family:'Courier New',monospace;font-size:15px;">{{ $tempPassword }}</span>
    </div>
    <div class="row">
      <span class="rk">Correo</span>
      <span class="rv" style="font-size:12px;">{{ $email }}</span>
    </div>
  </div>

  <div class="notice amber">
    <p class="notice-text"><strong>Importante:</strong> Cambia tu contraseña inmediatamente después de iniciar sesión por primera vez. Estas credenciales son personales e intransferibles.</p>
  </div>
@endsection
