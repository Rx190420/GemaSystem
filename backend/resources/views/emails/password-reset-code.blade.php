@extends('emails._layout')

@section('title', $isChange ? 'Cambio de contraseña' : 'Recuperar contraseña')

@section('nav-extra')
  <span style="margin-left:auto;font-size:11px;font-weight:600;color:#a1a1aa;text-transform:uppercase;letter-spacing:.8px;">Seguridad</span>
@endsection

@section('content')
  <div class="hero">
    <div class="icon-badge icon-badge-indigo">
      <img src="{{ $ICON_SHIELD }}" width="26" height="26" alt="" style="display:inline-block;">
    </div>
    <p class="eyebrow">Verificación</p>
    <h1 class="h1">{{ $isChange ? 'Confirma tu cambio de contraseña' : 'Recupera tu contraseña' }}</h1>
  </div>
  <p class="lead">
    @if($isChange)
      Recibimos una solicitud para <strong>cambiar la contraseña</strong> de tu cuenta. Usa el siguiente código para confirmar que eres tú.
    @else
      Usa el siguiente código para crear una nueva contraseña. Válido por 15 minutos.
    @endif
  </p>

  <div class="code-box">
    <div style="font-size:10px;font-weight:700;color:#a1a1aa;text-transform:uppercase;letter-spacing:1.2px;margin-bottom:14px;">Código de verificación</div>
    <div class="code">{{ $code }}</div>
    <div class="code-hint">Válido por 15 minutos</div>
  </div>

  <div class="notice amber">
    <p class="notice-text">Si no realizaste esta solicitud, ignora este correo. <strong>Tu contraseña no cambiará.</strong></p>
  </div>
@endsection
