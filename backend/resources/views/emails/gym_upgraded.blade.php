@extends('emails._layout')

@section('title', 'Tu cuenta ya es de pago — GemaSystem')

@section('nav-extra')
  <span style="margin-left:auto;font-size:11px;font-weight:600;color:#16a34a;text-transform:uppercase;letter-spacing:.8px;">Activada</span>
@endsection

@section('content')
  <div class="hero">
    <div class="icon-badge icon-badge-green">
      <img src="{{ $ICON_CHECK_CIRCLE }}" width="26" height="26" alt="" style="display:inline-block;">
    </div>
    <p class="eyebrow">Cuenta de pago</p>
    <h1 class="h1">¡Bienvenido a tu plan de pago!</h1>
  </div>
  <p class="lead"><strong>{{ $gymName }}</strong> ya tiene su cuenta de pago activa en GemaSystem. Ya puedes iniciar sesión con normalidad.</p>

  <div class="box">
    <div class="box-label">Detalles de tu cuenta</div>
    <div class="row">
      <span class="rk">Gimnasio</span>
      <span class="rv">{{ $gymName }}</span>
    </div>
    <div class="row">
      <span class="rk">Plan</span>
      <span class="rv">{{ $planLabel }}</span>
    </div>
  </div>

  <div class="notice green">
    <p class="notice-text">Tus datos de la prueba gratuita (socios, visitas, ventas) ya están disponibles en tu nueva cuenta de pago — no se perdió nada.</p>
  </div>
@endsection
