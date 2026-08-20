@extends('emails._layout')

@section('title', 'Tu ticket está siendo atendido — GemaSystem')

@section('nav-extra')
  <span style="margin-left:auto;font-size:11px;font-weight:600;color:#6366f1;text-transform:uppercase;letter-spacing:.8px;">Soporte</span>
@endsection

@section('content')
  <div class="hero">
    <div class="icon-badge icon-badge-indigo">
      <img src="{{ $ICON_HEADSET }}" width="26" height="26" alt="" style="display:inline-block;">
    </div>
    <p class="eyebrow">Soporte técnico</p>
    <h1 class="h1">Tu ticket está en proceso</h1>
  </div>
  <p class="lead">Hemos recibido tu solicitud de soporte y nuestro equipo ya está trabajando en ella. Te notificaremos cuando haya actualizaciones.</p>

  <div class="box">
    <div class="box-label">Detalles del ticket</div>
    <div class="row"><span class="rk">Ticket</span><span class="rv" style="font-family:'Courier New',monospace;">#{{ $ticket->id }}</span></div>
    <div class="row"><span class="rk">Asunto</span><span class="rv">{{ $ticket->subject }}</span></div>
    <div class="row"><span class="rk">Categoría</span><span class="rv">{{ ucfirst($ticket->category ?? 'General') }}</span></div>
    <div class="row"><span class="rk">Prioridad</span>
      <span class="rv">
        @if(($ticket->priority ?? 'normal') === 'high')
          <span class="pill pill-red">Alta</span>
        @elseif(($ticket->priority ?? 'normal') === 'low')
          <span class="pill pill-green">Baja</span>
        @else
          <span class="pill pill-basic">Normal</span>
        @endif
      </span>
    </div>
    <div class="row"><span class="rk">Abierto el</span><span class="rv">{{ $ticket->created_at->format('d/m/Y H:i') }}</span></div>
  </div>

  @if($ticket->messages->isNotEmpty())
  <div class="box">
    <div class="box-label">Tu mensaje</div>
    <p style="font-size:13px;color:#52525b;line-height:1.7;">{{ $ticket->messages->first()->body }}</p>
  </div>
  @endif

  <div class="notice blue">
    <p class="notice-text">Responderemos a <strong>{{ $ticket->email }}</strong> en un plazo de 24–48 horas hábiles. Puedes consultar el estado de tu ticket en cualquier momento.</p>
  </div>
@endsection
