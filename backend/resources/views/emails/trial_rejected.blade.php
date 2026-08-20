@extends('emails._layout')

@section('title', 'Solicitud no aprobada — GemaSystem')

@section('nav-extra')
  <span style="margin-left:auto;font-size:11px;font-weight:600;color:#a1a1aa;text-transform:uppercase;letter-spacing:.8px;">Solicitud</span>
@endsection

@section('content')
  <div class="hero">
    <div class="icon-badge icon-badge-gray">
      <img src="{{ $ICON_INFO }}" width="26" height="26" alt="" style="display:inline-block;">
    </div>
    <p class="eyebrow">Solicitud de prueba</p>
    <h1 class="h1">No pudimos aprobar tu solicitud</h1>
  </div>
  <p class="lead">Hemos revisado la solicitud de acceso para <strong>{{ $gymName }}</strong> y en este momento no podemos aprobarla.</p>

  @if(!empty($reason))
  <div class="box">
    <div class="box-label">Motivo</div>
    <p style="font-size:13px;color:#52525b;line-height:1.7;">{{ $reason }}</p>
  </div>
  @endif

  <div class="notice">
    <p class="notice-text">Si crees que esto es un error o tienes más información que pueda ayudar, escríbenos directamente a <a href="mailto:soporte@gemasystem.mx" style="color:#6366f1;text-decoration:none;">soporte@gemasystem.mx</a> y con gusto revisaremos tu caso.</p>
  </div>
@endsection
