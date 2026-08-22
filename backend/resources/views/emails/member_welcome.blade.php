@extends('emails._layout')

@section('title', 'Bienvenido a GemaSystem')

@section('nav-extra')
  <span style="margin-left:auto;font-size:11px;font-weight:600;color:#a1a1aa;text-transform:uppercase;letter-spacing:.8px;">Bienvenida</span>
@endsection

@section('content')
  <div class="hero">
    <div class="icon-badge icon-badge-indigo">
      <img src="{{ $ICON_USER_CHECK }}" width="26" height="26" alt="" style="display:inline-block;">
    </div>
    <p class="eyebrow">Nuevo miembro</p>
    <h1 class="h1">¡Bienvenido, {{ $member->first_name }}!</h1>
  </div>
  <p class="lead">Tu membresía ha sido registrada. A continuación encontrarás tu ID de miembro y código QR personal para registrar tus visitas.</p>

  {{-- ID de miembro --}}
  <div class="code-box">
    <div style="font-size:10px;font-weight:700;color:#a1a1aa;text-transform:uppercase;letter-spacing:1.2px;margin-bottom:12px;">Tu ID de miembro</div>
    <div class="code" style="letter-spacing:8px;">{{ $member->member_code }}</div>
  </div>

  {{-- QR --}}
  <div style="text-align:center;margin-bottom:20px;">
    <div style="font-size:10px;font-weight:700;color:#a1a1aa;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">Código QR personal</div>
    <div class="qr-wrap">
      <img
        src="{{ url('/mail-assets/qr/' . $member->qr_token) }}"
        alt="QR" width="140" height="140" style="display:block;border-radius:4px;max-width:100%;height:auto;"
      />
    </div>
  </div>

  {{-- Detalles --}}
  <div class="box">
    <div class="box-label">Detalles de membresía</div>
    <div class="row">
      <span class="rk">Tipo</span>
      <span class="rv">
        <span class="pill pill-{{ $member->membership_type }}">{{ strtoupper($member->membership_type) }}</span>
      </span>
    </div>
    @if($member->membership_start)
    <div class="row">
      <span class="rk">Inicio</span>
      <span class="rv">{{ $member->membership_start->format('d/m/Y') }}</span>
    </div>
    @endif
    @if($member->membership_end)
    <div class="row">
      <span class="rk">Vencimiento</span>
      <span class="rv">{{ $member->membership_end->format('d/m/Y') }}</span>
    </div>
    @endif
    @if($member->email)
    <div class="row">
      <span class="rk">Correo</span>
      <span class="rv" style="font-size:12px;">{{ $member->email }}</span>
    </div>
    @endif
  </div>

  <div class="notice green">
    <p class="notice-text">Presenta tu <strong>ID {{ $member->member_code }}</strong> o escanea el código QR en recepción para registrar tu asistencia.</p>
  </div>
@endsection
