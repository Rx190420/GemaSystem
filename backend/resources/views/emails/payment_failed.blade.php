@extends('emails._layout')

@section('title', 'Problema con tu pago — GemaSystem')

@section('nav-extra')
  <span style="margin-left:auto;font-size:11px;font-weight:600;color:#dc2626;text-transform:uppercase;letter-spacing:.8px;">Pago fallido</span>
@endsection

@section('content')
  <p class="eyebrow">Facturación</p>
  <h1 class="h1">No pudimos procesar tu pago</h1>
  <p class="lead">Hubo un problema al cobrar tu suscripción al plan <strong>{{ $planLabel }}</strong>. Por favor actualiza tu método de pago para evitar la suspensión del servicio.</p>

  <div class="box" style="background:#fef2f2;border-color:#fecaca;">
    <div class="box-label" style="color:#dc2626;">Detalle del cargo fallido</div>
    <div class="row"><span class="rk">Gimnasio</span><span class="rv">{{ $gymName }}</span></div>
    <div class="row"><span class="rk">Plan</span><span class="rv">{{ $planLabel }}</span></div>
    <div class="row"><span class="rk">Monto</span><span class="rv">${{ $amount }} {{ $currency }}</span></div>
    @if($failedAt)
    <div class="row"><span class="rk">Fecha</span><span class="rv">{{ $failedAt->format('d/m/Y H:i') }}</span></div>
    @endif
    @if($reason)
    <div class="row"><span class="rk">Motivo</span><span class="rv">{{ $reason }}</span></div>
    @endif
  </div>

  @if($updateUrl)
  <a href="{{ $updateUrl }}" class="btn" style="background:#ef4444;">Actualizar método de pago</a>
  @endif

  <div class="notice amber">
    <p class="notice-text"><strong>Tienes {{ $graceDays ?? 3 }} días</strong> para actualizar tu información de pago antes de que el servicio sea suspendido. Si necesitas ayuda escríbenos a <a href="mailto:soporte@gemasystem.mx" style="color:#6366f1;">soporte@gemasystem.mx</a>.</p>
  </div>
@endsection
