@extends('emails._layout')

@php
  $isToday  = $daysLeft === 0;
  $isUrgent = $daysLeft <= 7;
  $noticeClass = ($isToday || $isUrgent) ? 'red' : 'blue';
@endphp

@section('title', 'Recordatorio de membresía — GemaSystem')

@section('nav-extra')
  <span style="margin-left:auto;font-size:11px;font-weight:600;color:#a1a1aa;text-transform:uppercase;letter-spacing:.8px;">Membresía</span>
@endsection

@section('content')
  <div class="hero">
    <div class="icon-badge {{ $isToday || $isUrgent ? 'icon-badge-red' : 'icon-badge-indigo' }}">
      <img src="{{ $isToday || $isUrgent ? $ICON_CLOCK_URGENT : $ICON_CLOCK }}" width="26" height="26" alt="" style="display:inline-block;">
    </div>
    <p class="eyebrow">{{ $isToday ? 'Vence hoy' : ($isUrgent ? 'Vencimiento próximo' : 'Recordatorio') }}</p>
    <h1 class="h1">
      @if($isToday)
        Tu membresía vence hoy
      @elseif($isUrgent)
        Tu membresía está por vencer
      @else
        Recordatorio de membresía
      @endif
    </h1>
  </div>
  <p class="lead">
    @if($isToday)
      Tu membresía vence el día de hoy. Renuévala en recepción para seguir entrenando sin interrupciones.
    @elseif($isUrgent)
      Te quedan pocos días. Renueva cuanto antes para no perder el acceso.
    @else
      Este es un recordatorio sobre el estado de tu membresía.
    @endif
  </p>

  {{-- Días restantes --}}
  <div class="code-box">
    <div style="font-size:10px;font-weight:700;color:#a1a1aa;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">Días restantes</div>
    <div style="font-size:56px;font-weight:900;line-height:1;color:{{ $isToday || $isUrgent ? '#ef4444' : '#6366f1' }};">{{ $daysLeft }}</div>
    <div style="font-size:13px;color:#71717a;margin-top:6px;">{{ $isToday ? 'Vence hoy' : ($daysLeft === 1 ? 'día restante' : 'días restantes') }}</div>
  </div>

  <div class="box">
    <div class="box-label">Detalles</div>
    <div class="row">
      <span class="rk">Miembro</span>
      <span class="rv">{{ $member->first_name }} {{ $member->last_name }}</span>
    </div>
    <div class="row">
      <span class="rk">ID de miembro</span>
      <span class="rv" style="font-family:'Courier New',monospace;">{{ $member->member_code }}</span>
    </div>
    <div class="row">
      <span class="rk">Fecha de vencimiento</span>
      <span class="rv">{{ $endDate }}</span>
    </div>
    @if($member->activeMembership)
    <div class="row">
      <span class="rk">Plan activo</span>
      <span class="rv"><span class="pill pill-{{ $member->activeMembership->type }}">{{ strtoupper($member->activeMembership->type) }}</span></span>
    </div>
    @endif
  </div>

  <div class="notice {{ $noticeClass }}">
    <p class="notice-text">
      @if($isToday || $isUrgent)
        Acércate a recepción con tu ID <strong>{{ $member->member_code }}</strong> para renovar tu membresía y seguir entrenando.
      @else
        Recuerda que puedes renovar en cualquier momento en recepción con tu ID <strong>{{ $member->member_code }}</strong>.
      @endif
    </p>
  </div>
@endsection
