@extends('emails._layout')

@section('title', 'Renueva tu membresía — GemaSystem')

@section('nav-extra')
  <span style="margin-left:auto;font-size:11px;font-weight:600;color:#a1a1aa;text-transform:uppercase;letter-spacing:.8px;">Renovación</span>
@endsection

@section('content')
  <div class="hero">
    <div class="icon-badge icon-badge-green">
      <img src="{{ $ICON_DUMBBELL }}" width="26" height="26" alt="" style="display:inline-block;">
    </div>
    <p class="eyebrow">Sigue entrenando</p>
    <h1 class="h1">Te invitamos a renovar tu membresía</h1>
  </div>
  <p class="lead">
    Hola, <strong>{{ $member->first_name }}</strong>. No dejes que el progreso se detenga —
    renueva tu membresía{{ $gymName ? " en <strong>{$gymName}</strong>" : '' }} y sigue alcanzando tus metas.
  </p>

  <div style="text-align:center;padding:18px 20px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;margin-bottom:20px;">
    <div style="font-size:16px;font-weight:700;color:#15803d;">Tu cuerpo te lo agradecerá</div>
  </div>

  <div class="box">
    <div class="box-label">Tu información</div>
    <div class="row">
      <span class="rk">Miembro</span>
      <span class="rv">{{ $member->first_name }} {{ $member->last_name }}</span>
    </div>
    <div class="row">
      <span class="rk">ID de miembro</span>
      <span class="rv" style="font-family:'Courier New',monospace;">{{ $member->member_code }}</span>
    </div>
    @if($endDate)
    <div class="row">
      <span class="rk">Membresía actual hasta</span>
      <span class="rv">{{ $endDate }}</span>
    </div>
    @endif
    @if($member->activeMembership)
    <div class="row">
      <span class="rk">Plan actual</span>
      <span class="rv"><span class="pill pill-{{ $member->activeMembership->type }}">{{ strtoupper($member->activeMembership->type) }}</span></span>
    </div>
    @endif
  </div>

  <div class="notice blue">
    <p class="notice-text">
      Acércate a recepción con tu ID <strong>{{ $member->member_code }}</strong> para renovar tu membresía.
      @if($gymName) ¡El equipo de <strong>{{ $gymName }}</strong> te espera! @endif
    </p>
  </div>
@endsection
