@extends('emails._layout')

@section('title', '¡Feliz cumpleaños! — GemaSystem')

@section('nav-extra')
  <span style="margin-left:auto;font-size:11px;font-weight:600;color:#a1a1aa;text-transform:uppercase;letter-spacing:.8px;">Cumpleaños</span>
@endsection

@section('content')
  <div class="hero">
    <div class="icon-badge icon-badge-purple">
      <img src="{{ $ICON_GIFT }}" width="26" height="26" alt="" style="display:inline-block;">
    </div>
    <p class="eyebrow">Un día especial</p>
    <h1 class="h1">¡Feliz cumpleaños, {{ $member->first_name }}!</h1>
  </div>
  <p class="lead">
    Todo el equipo{{ $gymName ? " de <strong>{$gymName}</strong>" : '' }} te desea un día increíble lleno de energía y alegría.
    Gracias por ser parte de nuestra comunidad.
  </p>

  <div style="text-align:center;padding:24px 20px;background:#fdf4ff;border:1px solid #e9d5ff;border-radius:8px;margin-bottom:20px;">
    <div style="font-size:20px;font-weight:800;color:#7c3aed;">¡Feliz cumpleaños!</div>
    <div style="font-size:14px;color:#9333ea;margin-top:6px;">{{ $member->first_name }} {{ $member->last_name }}</div>
  </div>

  <div class="box">
    <div class="box-label">Tu información</div>
    <div class="row">
      <span class="rk">ID de miembro</span>
      <span class="rv" style="font-family:'Courier New',monospace;">{{ $member->member_code }}</span>
    </div>
    @if($member->membership_end)
    <div class="row">
      <span class="rk">Membresía hasta</span>
      <span class="rv">{{ $member->membership_end->format('d/m/Y') }}</span>
    </div>
    @endif
  </div>

  <div class="notice green">
    <p class="notice-text">Sigue entrenando fuerte — tu constancia es lo que te ha traído hasta aquí.</p>
  </div>
@endsection
