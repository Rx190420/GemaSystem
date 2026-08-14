@extends('emails._layout')

@section('title', 'Recibo de pago — GemaSystem')

@section('nav-extra')
  <span style="margin-left:auto;font-size:11px;font-weight:600;color:#16a34a;text-transform:uppercase;letter-spacing:.8px;">Pago confirmado</span>
@endsection

@section('content')
  <p class="eyebrow">Facturación</p>
  <h1 class="h1">Pago procesado correctamente</h1>
  <p class="lead">Tu suscripción al plan <strong>{{ $planLabel }}</strong> para <strong>{{ $gymName }}</strong> ha sido procesada exitosamente.</p>

  {{-- Monto --}}
  <div class="code-box" style="background:#f0fdf4;border-color:#bbf7d0;">
    <div style="font-size:10px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">Total cobrado</div>
    <div style="font-size:44px;font-weight:900;color:#09090b;line-height:1;">
      <span style="font-size:22px;vertical-align:super;color:#16a34a;">$</span>{{ $amount }}<span style="font-size:16px;color:#16a34a;margin-left:4px;">{{ $currency }}</span>
    </div>
    <div style="margin-top:12px;display:inline-flex;align-items:center;gap:6px;background:#dcfce7;border:1px solid #bbf7d0;border-radius:4px;padding:3px 10px;font-size:11px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:.8px;">
      ✓ Pago confirmado
    </div>
  </div>

  <div class="box">
    <div class="box-label">Detalles de facturación</div>
    <div class="row"><span class="rk">Gimnasio</span><span class="rv">{{ $gymName }}</span></div>
    <div class="row"><span class="rk">Plan</span><span class="rv">{{ $planLabel }}</span></div>
    @if($periodStart)
    <div class="row"><span class="rk">Período</span><span class="rv">{{ $periodStart->format('d/m/Y') }} → {{ $periodEnd?->format('d/m/Y') }}</span></div>
    @endif
    @if($invoiceId)
    <div class="row"><span class="rk">Referencia</span><span class="rv" style="font-family:'Courier New',monospace;font-size:11px;">{{ $invoiceId }}</span></div>
    @endif
  </div>

  @if($invoiceUrl || $invoicePdf)
  <a href="{{ $invoiceUrl ?? $invoicePdf }}" class="btn btn-indigo">Descargar comprobante de pago</a>
  @endif

  <div class="notice blue">
    <p class="notice-text">Tu próximo cobro de <strong>${{ $amount }} {{ $currency }}</strong> se realizará automáticamente el <strong>{{ $periodEnd?->locale('es')->isoFormat('D [de] MMMM [de] YYYY') }}</strong>.</p>
  </div>
@endsection

@section('footer-extra')
  <p style="margin-top:4px;">¿Preguntas? Escríbenos a <a href="mailto:soporte@gemasystem.mx" style="color:#6366f1;text-decoration:none;">soporte@gemasystem.mx</a></p>
@endsection
