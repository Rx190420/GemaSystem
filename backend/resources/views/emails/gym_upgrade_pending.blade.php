@extends('emails._layout')

@section('title', 'Completa tu pago — GemaSystem')

@section('nav-extra')
  <span style="margin-left:auto;font-size:11px;font-weight:600;color:#6366f1;text-transform:uppercase;letter-spacing:.8px;">Facturación</span>
@endsection

@section('content')
  <div class="hero">
    <div class="icon-badge icon-badge-indigo">
      <img src="{{ $ICON_RECEIPT }}" width="26" height="26" alt="" style="display:inline-block;">
    </div>
    <p class="eyebrow">Cuenta actualizada</p>
    <h1 class="h1">Tu gimnasio ahora es de pago</h1>
  </div>
  <p class="lead"><strong>{{ $gymName }}</strong> pasó a un plan de pago en GemaSystem. Para activar tu cuenta y recuperar el acceso, completa el pago correspondiente.</p>

  <div class="code-box">
    <div style="font-size:10px;font-weight:700;color:#a1a1aa;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">Plan asignado</div>
    <div style="font-size:22px;font-weight:800;color:#4338ca;margin-bottom:10px;">{{ $planLabel }}</div>
    <div style="font-size:36px;font-weight:900;line-height:1;color:#09090b;">
      ${{ number_format($amount) }}<span style="font-size:15px;color:#71717a;margin-left:4px;">MXN/mes</span>
    </div>
  </div>

  <a href="{{ $paymentUrl }}" class="btn btn-indigo">Pagar ahora</a>

  <div class="notice amber">
    <p class="notice-text"><strong>Tu acceso está suspendido</strong> hasta que se complete el pago. También puedes iniciar sesión normalmente — ahí te mostraremos esta misma pantalla de pago.</p>
  </div>
@endsection
