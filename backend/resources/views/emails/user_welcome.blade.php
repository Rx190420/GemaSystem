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
  <p class="lead">Se ha creado tu cuenta en GemaSystem. Además de la contraseña que elegiste al registrarte, necesitas el siguiente código de acceso para iniciar sesión. Guárdalo en un lugar seguro.</p>

  <div class="box">
    <div class="box-label">Datos de tu cuenta</div>
    <div class="row">
      <span class="rk">Usuario</span>
      <span class="rv" style="font-family:'Courier New',monospace;font-size:15px;">{{ $user->username }}</span>
    </div>
    <div class="row">
      <span class="rk">Código de acceso</span>
      <span class="rv" style="font-family:'Courier New',monospace;font-size:15px;">{{ $accessCode }}</span>
    </div>
    <div class="row">
      <span class="rk">Correo</span>
      <span class="rv" style="font-size:12px;">{{ $user->email }}</span>
    </div>
  </div>

  <div class="notice amber">
    <p class="notice-text"><strong>Importante:</strong> este código de acceso se te pedirá cada vez que inicies sesión, junto con tu contraseña. Es personal e intransferible — no lo compartas con nadie.</p>
  </div>
@endsection
