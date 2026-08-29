import { useState, useEffect } from 'react'
import { Skeleton } from 'boneyard-js/react'
import SkeletonLogoMark, { LoadingLogoOverlay } from '../components/SkeletonLogoMark'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import {
  Settings2, Palette, DollarSign, Bell, Server, Save, Loader2, CheckCircle2,
  ShieldCheck, Eye, EyeOff, KeyRound, RefreshCw, Lock, Plus, Trash2, Percent, Tag, Check, X,
  Upload, Clock, CreditCard, Globe, Gift, ChevronRight, BadgeCheck,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../api/axios'
import { THEME_OPTIONS, applyTheme } from '../utils/theme'
import { useSettingsStore } from '../store/settingsStore'
import { useAuthStore } from '../store/authStore'
import ImportDataTab from '../components/settings/ImportDataTab'

const TABS = [
  { id: 'general',       label: 'General',       icon: Settings2 },
  { id: 'appearance',    label: 'Apariencia',     icon: Palette },
  { id: 'prices',        label: 'Precios',        icon: DollarSign },
  { id: 'notifications', label: 'Notificaciones', icon: Bell },
  { id: 'system',        label: 'Sistema',        icon: Server },
  { id: 'import',        label: 'Importar datos', icon: Upload },
  { id: 'security',      label: 'Seguridad',      icon: ShieldCheck },
]

// Groups the flat tab list into labeled sections in the sidebar — purely a
// reading aid, doesn't change which component renders for a given tab id.
const TAB_GROUPS = [
  { label: 'General',   tabs: ['general', 'appearance'] },
  { label: 'Negocio',   tabs: ['prices', 'notifications'] },
  { label: 'Sistema',   tabs: ['system', 'import'] },
  { label: 'Cuenta',    tabs: ['security'] },
]

// ── Section header — neutral icon tile + title + description, shared by every tab.
// Deliberately colorless: the app's purple is reserved for actionable buttons,
// so page chrome stays white/gray and the accent isn't diluted by overuse.
function SectionHeader({ icon: Icon, title, description }) {
  return (
    <div className="flex items-start gap-3.5 pb-4 mb-4 border-b border-gray-100">
      <div className="w-11 h-11 rounded-xl border border-gray-200 bg-white flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5 text-gray-600" />
      </div>
      <div className="min-w-0 pt-0.5">
        <h2 className="text-base font-bold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-500 mt-0.5">{description}</p>
      </div>
    </div>
  )
}

// A card-in-card — groups a related cluster of fields behind a neutral icon
// tile so a tab full of settings reads as distinct, labeled sections instead
// of one long undifferentiated scroll.
function SubCard({ icon: Icon, title, description, children }) {
  return (
    <div className="rounded-2xl border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 bg-white border-b border-gray-100">
        <span className="w-7 h-7 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center flex-shrink-0">
          <Icon className="w-3.5 h-3.5 text-gray-500" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-800">{title}</p>
          {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
        </div>
      </div>
      <div className="p-4 sm:p-5 space-y-4 bg-gray-50">
        {children}
      </div>
    </div>
  )
}

// ── Save button shared ─────────────────────────────────────────
// `form` lets this button live outside its `<form>` in the DOM (still
// submits it via the HTML form/id association) — used to place a tab's save
// button after content that must stay outside the form, like PricesTab's
// membership-type/discount sections (each with their own nested forms).
function SaveBtn({ saving, form }) {
  return (
    <button type="submit" form={form} disabled={saving} className="btn-primary">
      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
      {saving ? 'Guardando...' : 'Guardar cambios'}
    </button>
  )
}

// ── General Tab ────────────────────────────────────────────────
function GeneralTab({ settings, onSave, saving }) {
  const { register, handleSubmit } = useForm({ values: settings })
  return (
    <form onSubmit={handleSubmit(d => onSave({
      gym_name:        d.gym_name,
      gym_description: d.gym_description,
      gym_address:     d.gym_address,
      gym_phone:       d.gym_phone,
      gym_email:       d.gym_email,
    }))} className="space-y-5">
      <SectionHeader icon={Settings2} title="Información del gimnasio" description="Datos que aparecen en toda la aplicación." />

      <SubCard icon={BadgeCheck} title="Identidad" description="Nombre y descripción visibles para tus miembros.">
        <div>
          <label className="label">Nombre del gimnasio *</label>
          <input {...register('gym_name')} className="input bg-white" placeholder="GemaSystem" />
        </div>
        <div>
          <label className="label">Descripción</label>
          <textarea {...register('gym_description')} rows={3} className="input bg-white resize-none" placeholder="Descripción breve del gimnasio..." />
        </div>
      </SubCard>

      <SubCard icon={Globe} title="Contacto" description="Cómo pueden encontrarte o comunicarse contigo.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Teléfono</label>
            <input {...register('gym_phone')} className="input bg-white" placeholder="+1 234 567 8900" />
          </div>
          <div>
            <label className="label">Email de contacto</label>
            <input {...register('gym_email')} type="email" className="input bg-white" placeholder="info@tugimnasio.com" />
          </div>
        </div>
        <div>
          <label className="label">Dirección</label>
          <input {...register('gym_address')} className="input bg-white" placeholder="Calle, ciudad, país" />
        </div>
      </SubCard>

      <div className="pt-1 flex justify-end">
        <SaveBtn saving={saving} />
      </div>
    </form>
  )
}

// ── Appearance Tab ────────────────────────────────────────────
function AppearanceTab({ settings, onSave, saving }) {
  const [selected, setSelected] = useState(settings.theme_color || 'indigo')

  useEffect(() => { setSelected(settings.theme_color || 'indigo') }, [settings.theme_color])

  function handleSelect(id) {
    setSelected(id)
    applyTheme(id)
  }

  function handleSave(e) {
    e.preventDefault()
    onSave({ theme_color: selected })
  }

  return (
    <form onSubmit={handleSave} className="space-y-5">
      <SectionHeader icon={Palette} title="Color principal" description="Elige el color que define la identidad de tu aplicación." />

      <SubCard icon={Palette} title="Paleta de colores" description="Se aplica de inmediato a botones, enlaces y acentos.">
        <div className="grid grid-cols-3 gap-3">
          {THEME_OPTIONS.map(({ id, label, hex }) => (
            <button
              key={id}
              type="button"
              onClick={() => handleSelect(id)}
              className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 bg-white transition-all
                ${selected === id ? 'border-gray-900 shadow-md' : 'border-gray-200 hover:border-gray-300'}`}
            >
              <div className="w-10 h-10 rounded-full shadow-inner" style={{ backgroundColor: hex }} />
              <span className="text-xs font-medium text-gray-700">{label}</span>
              {selected === id && (
                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-gray-900 flex items-center justify-center">
                  <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                </div>
              )}
            </button>
          ))}
        </div>
      </SubCard>

      <SubCard icon={Settings2} title="Vista previa" description="Así se verán los componentes principales.">
        <div className="flex items-center gap-3 flex-wrap">
          <button type="button" className="btn-primary pointer-events-none">Botón primario</button>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white" style={{ backgroundColor: 'var(--color-primary-600)' }}>
            <Settings2 className="w-4 h-4" />
          </div>
          <input readOnly className="input bg-white w-40" value="Campo activo" onFocus={e => e.target.select()} />
        </div>
      </SubCard>

      <div className="pt-1 flex justify-end">
        <SaveBtn saving={saving} />
      </div>
    </form>
  )
}

// ── Prices Tab ────────────────────────────────────────────────
const VISIT_TYPES = [
  { key: 'price_visit_training',     label: 'Visita' },
  { key: 'price_visit_class',        label: 'Clase' },
  { key: 'price_visit_consultation', label: 'Consulta' },
  { key: 'price_visit_other',        label: 'Otro' },
]

const MEMBERSHIP_TYPES = [
  { key: 'price_membership_weekly',    label: 'Semana (7 días)' },
  { key: 'price_membership_biweekly',  label: 'Quincena (15 días)' },
  { key: 'price_membership_monthly',   label: 'Mensual (1 mes)' },
  { key: 'price_membership_quarterly', label: 'Trimestral (3 meses)' },
  { key: 'price_membership_biannual',  label: 'Semestral (6 meses)' },
  { key: 'price_membership_annual',    label: 'Anual (12 meses)' },
]

// Preset palette for membership types — picked once per type at creation
// time so each one (Básica, Premium, VIP, or whatever a gym names them) can
// be told apart at a glance instead of all sharing one default color.
const TYPE_COLOR_PRESETS = ['#6366F1', '#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#F43F5E', '#06B6D4', '#F97316']

function MembershipTypesSection() {
  const qc = useQueryClient()
  const [newName, setNewName]   = useState('')
  const [newColor, setNewColor] = useState(TYPE_COLOR_PRESETS[0])
  const [adding, setAdding]     = useState(false)

  const { data: types = [], isLoading } = useQuery({
    queryKey: ['membership-types'],
    queryFn: () => api.get('/membership-types').then(r => r.data),
  })

  const createMut = useMutation({
    mutationFn: d => api.post('/membership-types', d),
    onSuccess: () => {
      toast.success('Tipo guardado')
      qc.invalidateQueries(['membership-types'])
      setNewName(''); setNewColor(TYPE_COLOR_PRESETS[0]); setAdding(false)
    },
    onError: () => toast.error('Error al guardar'),
  })
  const deleteMut = useMutation({
    mutationFn: id => api.delete(`/membership-types/${id}`),
    onSuccess: () => { toast.success('Tipo eliminado'); qc.invalidateQueries(['membership-types']) },
    onError: () => toast.error('Error al eliminar'),
  })

  return (
    <SubCard icon={Tag} title="Tipos de membresía" description="Opciones que aparecen en los formularios de registro, cada una con su propio color.">
      <LoadingLogoOverlay show={isLoading} size={32} />
      <Skeleton name="settings-membership-types" loading={isLoading}>
      {(
        <div className="flex flex-wrap gap-2">
          {types.map(t => {
            const color = t.color || '#94A3B8'
            return (
              <div key={t.id} className="flex items-center gap-1.5 pl-2.5 pr-1.5 py-1.5 rounded-full text-xs font-semibold"
                style={{
                  background: `color-mix(in srgb, ${color} 14%, transparent)`,
                  color,
                  border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
                }}>
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                {t.name}
                <button type="button" onClick={() => deleteMut.mutate(t.id)} disabled={deleteMut.isPending}
                  className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-red-100 hover:text-red-500 transition-colors"
                  style={{ background: `color-mix(in srgb, ${color} 20%, transparent)` }}>
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            )
          })}
          {adding ? (
            <form onSubmit={e => { e.preventDefault(); if (newName.trim()) createMut.mutate({ name: newName.trim(), color: newColor }) }}
              className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1">
                {TYPE_COLOR_PRESETS.map(c => (
                  <button key={c} type="button" onClick={() => setNewColor(c)} title={c}
                    className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center transition-transform"
                    style={{
                      background: c,
                      transform: newColor === c ? 'scale(1.15)' : 'scale(1)',
                      boxShadow: newColor === c ? `0 0 0 2px white, 0 0 0 3.5px ${c}` : 'none',
                    }}>
                    {newColor === c && <Check className="w-3 h-3 text-white" />}
                  </button>
                ))}
              </div>
              <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Escape' && setAdding(false)}
                placeholder="Nuevo tipo..."
                className="h-8 px-3 text-xs rounded-full border-2 border-gray-300 focus:border-[var(--color-primary-500)] outline-none w-32 bg-white transition-colors" />
              <button type="submit" disabled={createMut.isPending || !newName.trim()}
                className="w-8 h-8 rounded-full text-white flex items-center justify-center hover:brightness-110 disabled:opacity-40 transition-colors flex-shrink-0"
                style={{ background: newColor }}>
                {createMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              </button>
              <button type="button" onClick={() => { setAdding(false); setNewName('') }}
                className="w-8 h-8 rounded-full border-2 border-gray-200 bg-white text-gray-400 flex items-center justify-center hover:border-gray-300 transition-colors flex-shrink-0">
                <X className="w-3 h-3" />
              </button>
            </form>
          ) : (
            <button type="button" onClick={() => setAdding(true)}
              className="px-3 py-1.5 rounded-full border-2 border-dashed border-gray-300 bg-white text-gray-400 text-xs font-medium hover:border-gray-400 hover:text-gray-600 transition-all flex items-center gap-1">
              <Plus className="w-3 h-3" /> Añadir
            </button>
          )}
        </div>
      )}
      </Skeleton>
    </SubCard>
  )
}

function DiscountCategoriesSection() {
  const qc = useQueryClient()
  const [newName, setNewName] = useState('')
  const [newPct, setNewPct]   = useState('')
  const [adding, setAdding]   = useState(false)

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['discount-categories'],
    queryFn: () => api.get('/discount-categories').then(r => r.data),
  })

  const createMut = useMutation({
    mutationFn: d => api.post('/discount-categories', d),
    onSuccess: () => { toast.success('Categoría guardada'); qc.invalidateQueries(['discount-categories']); setNewName(''); setNewPct(''); setAdding(false) },
    onError: () => toast.error('Error al guardar'),
  })
  const deleteMut = useMutation({
    mutationFn: id => api.delete(`/discount-categories/${id}`),
    onSuccess: () => { toast.success('Categoría eliminada'); qc.invalidateQueries(['discount-categories']) },
    onError: () => toast.error('Error al eliminar'),
  })

  function handleAdd(e) {
    e.preventDefault()
    if (!newName.trim()) return toast.error('Escribe un nombre')
    const pct = parseFloat(newPct)
    if (isNaN(pct) || pct < 0 || pct > 100) return toast.error('Porcentaje inválido (0–100)')
    createMut.mutate({ name: newName.trim(), discount_percent: pct })
  }

  return (
    <SubCard icon={Percent} title="Categorías de descuento" description="Se asignan a miembros al registrarlos. Edita el % aquí después de crearlas.">
      <LoadingLogoOverlay show={isLoading} size={32} />
      <Skeleton name="settings-discount-categories" loading={isLoading}>
      {categories.length === 0 ? (
        <p className="text-sm text-gray-400">Sin categorías aún.</p>
      ) : (
        <div className="space-y-2">
          {categories.map(cat => (
            <div key={cat.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white border border-gray-200">
              <p className="flex-1 text-sm font-medium text-gray-900">{cat.name}</p>
              <div className="flex items-center gap-1 text-gray-500 font-semibold text-sm">
                <Percent className="w-3.5 h-3.5" />
                <span>{parseFloat(cat.discount_percent).toFixed(0)}% desc.</span>
              </div>
              <button type="button" onClick={() => deleteMut.mutate(cat.id)} disabled={deleteMut.isPending}
                className="p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      </Skeleton>

      {adding ? (
        <form onSubmit={handleAdd} className="flex items-end gap-2 flex-wrap">
          <div className="flex-1 min-w-32">
            <label className="label">Nombre</label>
            <input value={newName} onChange={e => setNewName(e.target.value)} className="input bg-white"
              placeholder="Estudiante, Adulto mayor..." autoFocus />
          </div>
          <div className="w-28">
            <label className="label">Descuento %</label>
            <div className="relative">
              <input type="number" min="0" max="100" step="0.5" value={newPct} onChange={e => setNewPct(e.target.value)} className="input bg-white pr-7" placeholder="20" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
            </div>
          </div>
          <button type="submit" disabled={createMut.isPending} className="btn-primary h-10">
            {createMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Agregar'}
          </button>
          <button type="button" onClick={() => { setAdding(false); setNewName(''); setNewPct('') }} className="btn-secondary h-10">Cancelar</button>
        </form>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="btn-secondary text-sm">
          <Plus className="w-4 h-4" /> Nueva categoría de descuento
        </button>
      )}
    </SubCard>
  )
}

function PricesTab({ settings, onSave, saving }) {
  const { register, handleSubmit } = useForm({ values: settings })
  const keys = [...VISIT_TYPES, ...MEMBERSHIP_TYPES].map(t => t.key)
  return (
    <div className="space-y-6">
      <SectionHeader icon={DollarSign} title="Precios por defecto" description="Se auto-rellenan al registrar visitas y membresías. Deja en 0 si varía." />

      {/* id'd so the save button below (outside this form, after the
          membership-type/discount sections) can still submit it — those
          sections render their own inline forms, which can't nest inside
          this one. */}
      <form id="prices-form" onSubmit={handleSubmit(d => onSave(Object.fromEntries(keys.map(k => [k, d[k] || '0']))))} className="space-y-5">
        <SubCard icon={Clock} title="Visitas">
          <div className="grid grid-cols-2 gap-3">
            {VISIT_TYPES.map(({ key, label }) => (
              <div key={key}>
                <label className="label">{label}</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input
                    {...register(key)}
                    type="number" min="0" step="0.01"
                    className="input pl-7 bg-white"
                    placeholder="0.00"
                  />
                </div>
              </div>
            ))}
          </div>
        </SubCard>

        <SubCard icon={CreditCard} title="Membresías">
          <div className="grid grid-cols-2 gap-3">
            {MEMBERSHIP_TYPES.map(({ key, label }) => (
              <div key={key}>
                <label className="label">{label}</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input
                    {...register(key)}
                    type="number" min="0" step="0.01"
                    className="input pl-7 bg-white"
                    placeholder="0.00"
                  />
                </div>
              </div>
            ))}
          </div>
        </SubCard>
      </form>

      <MembershipTypesSection />
      <DiscountCategoriesSection />

      <div className="pt-1 flex justify-end">
        <SaveBtn saving={saving} form="prices-form" />
      </div>
    </div>
  )
}

// ── Notifications Tab ─────────────────────────────────────────
function NotificationsTab({ settings, onSave, saving }) {
  const { register, handleSubmit, watch } = useForm({
    values: {
      send_welcome_email: settings.send_welcome_email === '1' || settings.send_welcome_email === true,
      expiry_alert_days: settings.expiry_alert_days || '7',
    },
  })
  const emailEnabled = watch('send_welcome_email')

  return (
    <form onSubmit={handleSubmit(d => onSave({
      send_welcome_email: d.send_welcome_email ? '1' : '0',
      expiry_alert_days:  String(d.expiry_alert_days || '7'),
    }))} className="space-y-5">
      <SectionHeader icon={Bell} title="Notificaciones" description="Configura alertas automáticas del sistema." />

      <SubCard icon={Bell} title="Alertas automáticas" description="Correos y avisos que el sistema envía sin intervención manual.">
        <div className="flex items-center justify-between p-4 rounded-xl border border-gray-200 bg-white">
          <div>
            <p className="text-sm font-medium text-gray-900">Email de bienvenida</p>
            <p className="text-xs text-gray-500 mt-0.5">Enviar correo automático al registrar un nuevo miembro</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" {...register('send_welcome_email')} className="sr-only peer" />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer
              peer-checked:after:translate-x-full peer-checked:after:border-white
              after:content-[''] after:absolute after:top-[2px] after:left-[2px]
              after:bg-white after:border-gray-300 after:border after:rounded-full
              after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-primary-600)]" />
          </label>
        </div>

        <div className={`p-4 rounded-xl border border-gray-200 bg-white transition-opacity ${emailEnabled ? '' : 'opacity-50 pointer-events-none'}`}>
          <label className="label">Días de alerta antes del vencimiento</label>
          <p className="text-xs text-gray-500 mb-2">Enviar alerta cuando falten N días para que expire una membresía</p>
          <div className="flex items-center gap-3">
            <input
              {...register('expiry_alert_days')}
              type="number" min="1" max="90"
              className="input bg-gray-50 w-28"
            />
            <span className="text-sm text-gray-500">días antes</span>
          </div>
        </div>
      </SubCard>

      <div className="pt-1 flex justify-end">
        <SaveBtn saving={saving} />
      </div>
    </form>
  )
}

// ── System Tab ────────────────────────────────────────────────
const CURRENCIES = [
  { value: 'USD', label: 'USD — Dólar estadounidense' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'COP', label: 'COP — Peso colombiano' },
  { value: 'MXN', label: 'MXN — Peso mexicano' },
  { value: 'ARS', label: 'ARS — Peso argentino' },
  { value: 'PEN', label: 'PEN — Sol peruano' },
  { value: 'CLP', label: 'CLP — Peso chileno' },
  { value: 'BRL', label: 'BRL — Real brasileño' },
]

const TIMEZONES = [
  { value: 'America/Bogota',      label: 'Bogotá, Lima, Quito (UTC-5)' },
  { value: 'America/Mexico_City', label: 'México (UTC-6)' },
  { value: 'America/Buenos_Aires',label: 'Buenos Aires (UTC-3)' },
  { value: 'America/Santiago',    label: 'Santiago de Chile (UTC-4)' },
  { value: 'America/Caracas',     label: 'Caracas (UTC-4)' },
  { value: 'America/New_York',    label: 'Nueva York (UTC-5)' },
  { value: 'Europe/Madrid',       label: 'Madrid (UTC+1)' },
  { value: 'UTC',                 label: 'UTC (Coordinado universal)' },
]


function CurrencyPreview({ code }) {
  const amount = (() => {
    try { return new Intl.NumberFormat('es-MX', { style: 'currency', currency: code || 'USD', maximumFractionDigits: 2 }).format(1234.5) }
    catch { return '—' }
  })()
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-white border border-gray-200">
      <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
        <DollarSign className="w-4 h-4 text-gray-500" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-400">Así se verán los montos</p>
        <p className="text-sm font-semibold text-gray-900 truncate">{amount}</p>
      </div>
    </div>
  )
}

function TimezonePreview({ tz }) {
  const now = new Date()
  const time = (() => {
    try { return new Intl.DateTimeFormat('es-MX', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: true }).format(now) }
    catch { return '—' }
  })()
  const date = (() => {
    try { return new Intl.DateTimeFormat('es-MX', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long' }).format(now) }
    catch { return '' }
  })()
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-white border border-gray-200">
      <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
        <Clock className="w-4 h-4 text-gray-500" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-400">Hora actual en tu zona</p>
        <p className="text-sm font-semibold text-gray-900 truncate">{time} <span className="font-normal text-gray-400 capitalize">· {date}</span></p>
      </div>
    </div>
  )
}

function SystemTab({ settings, onSave, saving }) {
  const navigate = useNavigate()
  const { hash } = useParams()
  const { register, handleSubmit, watch } = useForm({ values: settings })
  const currency = watch('currency')
  const timezone = watch('timezone')
  const trialDays = Number(watch('trial_days') || 0)

  return (
    <form onSubmit={handleSubmit(d => onSave({
      currency:   d.currency,
      timezone:   d.timezone,
      trial_days: String(d.trial_days || '0'),
    }))} className="space-y-5">
      <SectionHeader icon={Server} title="Sistema" description="Configuración global de la aplicación." />

      <SubCard icon={Globe} title="Región y localización" description="Define cómo se muestran los montos, fechas y horarios en toda la app.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Moneda</label>
            <select {...register('currency')} className="input bg-white">
              {CURRENCIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Zona horaria</label>
            <select {...register('timezone')} className="input bg-white">
              {TIMEZONES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <CurrencyPreview code={currency} />
          <TimezonePreview tz={timezone} />
        </div>
      </SubCard>

      <SubCard icon={Gift} title="Prueba gratuita" description="Días gratis que se ofrecen automáticamente al crear una nueva membresía.">
        <div className="flex items-center justify-between p-4 rounded-xl border border-gray-200 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
              <Gift className="w-4 h-4 text-gray-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">
                {trialDays > 0 ? `${trialDays} día${trialDays !== 1 ? 's' : ''} de prueba` : 'Prueba gratuita desactivada'}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">0 para desactivar esta función</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 text-xs font-semibold text-gray-700">
            <span className={`w-1.5 h-1.5 rounded-full ${trialDays > 0 ? 'bg-emerald-500' : 'bg-gray-400'}`} />
            {trialDays > 0 ? 'Activa' : 'Inactiva'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <input {...register('trial_days')} type="number" min="0" max="365" className="input w-28 bg-white" />
          <span className="text-sm text-gray-500">días</span>
        </div>
      </SubCard>

      <div className="pt-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate(`/g/${hash}/perfil`)}
          className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 hover:border-gray-300 transition-colors text-left w-full sm:w-auto"
        >
          <span className="flex items-center gap-2.5">
            <BadgeCheck className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span className="text-sm text-gray-700">¿Buscas tu plan o facturación? <span className="font-semibold text-gray-900">Ir a mi perfil</span></span>
          </span>
          <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
        </button>
        <SaveBtn saving={saving} />
      </div>
    </form>
  )
}

// ── Security Tab ──────────────────────────────────────────────
function SecurityTab() {
  const [showCode, setShowCode]     = useState(false)
  const [changing, setChanging]     = useState(false)
  const [newCode, setNewCode]       = useState('')
  const [saving, setSaving]         = useState(false)
  const qc = useQueryClient()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['access-code'],
    queryFn: () => api.get('/auth/access-code').then(r => r.data),
  })

  // Gym-wide policy — separate from the personal code above. Shares the
  // ['settings'] query key with the rest of the Settings page so toggling
  // it here doesn't cause an extra fetch or go stale against GeneralTab etc.
  const { data: gymSettings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get('/settings').then(r => r.data),
  })
  const requireCodeEnabled = gymSettings?.require_access_code !== '0' // unset = on by default
  const policyMutation = useMutation({
    mutationFn: (enabled) => api.put('/settings', { require_access_code: enabled ? '1' : '0' }),
    onSuccess: (_, enabled) => {
      toast.success(enabled ? 'Código de acceso requerido para todos los usuarios' : 'Código de acceso desactivado — el login ya no lo pedirá')
      qc.setQueryData(['settings'], (old) => ({ ...old, require_access_code: enabled ? '1' : '0' }))
    },
    onError: () => toast.error('No se pudo guardar el ajuste'),
  })

  const handleChange = async (e) => {
    e.preventDefault()
    if (!newCode.trim() || newCode.trim().length < 6) {
      toast.error('El código debe tener al menos 6 caracteres')
      return
    }
    setSaving(true)
    try {
      await api.put('/auth/access-code', { code: newCode.trim() })
      toast.success('Código de acceso actualizado correctamente')
      setChanging(false)
      setNewCode('')
      refetch()
    } catch (err) {
      const msg = err.response?.data?.message || 'Error al actualizar el código'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) return (
    <div className="flex items-center justify-center py-16">
      <SkeletonLogoMark size={48} />
    </div>
  )

  const changesUsed      = data?.changes_used ?? 0
  const changesRemaining = data?.changes_remaining ?? 5
  const hasCode          = data?.has_code ?? false
  const code             = data?.code ?? ''
  const limitReached     = changesRemaining === 0

  return (
    <div className="space-y-5">
      <SectionHeader
        icon={ShieldCheck}
        title="Código de acceso"
        description="Código de seguridad requerido en cada inicio de sesión. Único por usuario."
      />

      <SubCard icon={ShieldCheck} title="Exigir código de acceso" description="Ajuste general del gimnasio — aplica a todos los usuarios que tengan un código configurado.">
        <div className="flex items-center justify-between p-4 rounded-xl border border-gray-200 bg-white">
          <div>
            <p className="text-sm font-medium text-gray-900">Pedir código de acceso al iniciar sesión</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {requireCodeEnabled
                ? 'Activado (recomendado) — quien tenga un código configurado deberá ingresarlo para entrar.'
                : 'Desactivado — el login no pedirá el código, aunque un usuario tenga uno configurado.'}
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 ml-4">
            <input
              type="checkbox"
              checked={requireCodeEnabled}
              disabled={policyMutation.isPending}
              onChange={(e) => policyMutation.mutate(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer
              peer-checked:after:translate-x-full peer-checked:after:border-white
              after:content-[''] after:absolute after:top-[2px] after:left-[2px]
              after:bg-white after:border-gray-300 after:border after:rounded-full
              after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-primary-600)]" />
          </label>
        </div>
      </SubCard>

      <SubCard icon={KeyRound} title="Tu código de acceso" description="Solo visible para ti · Requerido al iniciar sesión">
        {hasCode ? (
          <div>
            <label className="label">Código actual</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <input
                  readOnly
                  value={showCode ? code : '••••••••'}
                  className="input bg-white font-mono tracking-[0.3em] text-base cursor-default select-none"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowCode(s => !s)}
                title={showCode ? 'Ocultar código' : 'Mostrar código'}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm text-gray-600 hover:bg-gray-100 transition-colors"
              >
                {showCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                <span className="hidden sm:inline">{showCode ? 'Ocultar' : 'Mostrar'}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="settings-status-box flex items-start gap-3 p-4 rounded-lg bg-amber-50 border border-amber-200">
            <Lock className="settings-status-icon w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="settings-status-title text-sm font-semibold text-amber-800">Sin código configurado</p>
              <p className="settings-status-body text-xs text-amber-700 mt-0.5">
                Tu cuenta no tiene código de acceso. Configura uno para mayor seguridad.
              </p>
            </div>
          </div>
        )}

        {/* Change counter */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-white border border-gray-200">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <RefreshCw className="w-4 h-4" />
            <span>Cambios realizados:</span>
            <span className="font-semibold text-gray-900">{changesUsed} de 5</span>
          </div>
          <div className="flex gap-1">
            {[0,1,2,3,4].map(i => (
              <div key={i} className={`w-4 h-1.5 rounded-full transition-colors ${i < changesUsed ? 'bg-gray-700' : 'bg-gray-200'}`} />
            ))}
          </div>
        </div>

        {limitReached && (
          <div className="settings-status-box settings-status-body flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
            <Lock className="settings-status-icon w-4 h-4 flex-shrink-0 mt-0.5 text-red-500" />
            Has alcanzado el límite de 5 cambios. Ya no puedes modificar tu código de acceso.
          </div>
        )}
      </SubCard>

      {/* Change form */}
      {!limitReached && (
        <div className="rounded-2xl border border-gray-200 overflow-hidden">
          <div
            className="px-5 py-3.5 bg-white border-b border-gray-100 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => setChanging(c => !c)}
          >
            <div className="flex items-center gap-2.5">
              <KeyRound className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {hasCode ? 'Cambiar código de acceso' : 'Configurar código de acceso'}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {changesRemaining} cambio{changesRemaining !== 1 ? 's' : ''} restante{changesRemaining !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${changing ? 'rotate-90' : ''}`} />
          </div>

          {changing && (
            <form onSubmit={handleChange} className="p-5 space-y-4 bg-gray-50">
              <div>
                <label className="label">{hasCode ? 'Nuevo código' : 'Código de acceso'}</label>
                <p className="text-xs text-gray-500 mb-2">
                  Mínimo 6 caracteres. Puedes usar letras, números o símbolos.
                </p>
                <input
                  type="text"
                  value={newCode}
                  onChange={e => setNewCode(e.target.value)}
                  placeholder="Ej: MIGYM2024"
                  maxLength={30}
                  className="input bg-white font-mono tracking-wider"
                  autoComplete="off"
                />
                <p className="mt-1 text-xs text-gray-400">{newCode.length}/30 caracteres</p>
              </div>
              <div className="flex items-center gap-3 pt-1">
                <button type="submit" disabled={saving || newCode.trim().length < 6} className="btn-primary">
                  {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Guardando...</> : <><Save className="w-4 h-4" />{hasCode ? 'Actualizar código' : 'Guardar código'}</>}
                </button>
                <button type="button" onClick={() => { setChanging(false); setNewCode('') }} className="btn-ghost">
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Info note */}
      <div className="settings-status-box settings-status-body flex items-start gap-3 p-4 rounded-xl border border-blue-100 bg-blue-50 text-xs text-blue-700">
        <ShieldCheck className="settings-status-icon w-4 h-4 flex-shrink-0 mt-0.5 text-blue-500" />
        <div>
          <p className="settings-status-title font-semibold text-blue-800 mb-0.5">¿Para qué sirve el código de acceso?</p>
          El código de acceso es un segundo factor de seguridad. Se solicita al iniciar sesión junto
          con tu contraseña. Si olvidaste tu código, puedes verlo aquí. Recuerda que solo puedes cambiarlo 5 veces en total.
        </div>
      </div>
    </div>
  )
}

// ── Main Settings Page ────────────────────────────────────────
export default function SettingsPage() {
  const [tab, setTab] = useState('general')
  const qc = useQueryClient()
  const { setSystemSettings, systemSettings } = useSettingsStore()

  // Basic-tier gyms don't get the "Importar datos" tab (see plan_features
  // gating — same feature key the backend's `feature:import` middleware
  // enforces on the actual /api/import routes; this just hides the tab so a
  // Basic user never sees a dead-end button).
  const { user } = useAuthStore()
  const hasImport = user?.plan_features?.import !== false
  const visibleGroups = TAB_GROUPS.map(group => ({
    ...group,
    tabs: group.tabs.filter(id => id !== 'import' || hasImport),
  })).filter(group => group.tabs.length > 0)

  const { data: settings = {}, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get('/settings').then(r => r.data),
  })

  const mutation = useMutation({
    mutationFn: (data) => api.put('/settings', data),
    onSuccess: (_, sent) => {
      toast.success('Configuración guardada')
      qc.invalidateQueries(['settings'])
      setSystemSettings({ ...systemSettings, ...sent })
    },
    onError: () => toast.error('Error al guardar la configuración'),
  })

  if (isLoading) return (
    <div className="flex items-center justify-center py-20">
      <SkeletonLogoMark size={56} />
    </div>
  )

  const STANDALONE_TABS = ['security', 'import']

  const ActiveTab = {
    general:       GeneralTab,
    appearance:    AppearanceTab,
    prices:        PricesTab,
    notifications: NotificationsTab,
    system:        SystemTab,
    import:        ImportDataTab,
    security:      SecurityTab,
  }[tab]

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3.5">
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, var(--color-primary-500), var(--color-primary-600))',
            boxShadow: '0 4px 14px color-mix(in srgb, var(--color-primary-500) 35%, transparent)',
          }}
        >
          <Settings2 className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
          <p className="text-sm text-gray-500 mt-0.5">Personaliza y gestiona tu sistema GemaSystem</p>
        </div>
      </div>

      <div className="card overflow-hidden flex flex-col md:flex-row">
        {/* Tab list — grouped for a quicker scan. Deliberately monochrome:
            the active tab stands out through weight and a neutral gray fill,
            not color, so the app's purple stays reserved for actual buttons. */}
        <div className="md:w-64 border-b md:border-b-0 md:border-r border-gray-100 p-3 flex md:flex-col gap-1 md:gap-4 overflow-x-auto">
          {visibleGroups.map(group => (
            <div key={group.label} className="flex md:flex-col gap-1 flex-shrink-0">
              <p className="hidden md:block px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                {group.label}
              </p>
              {group.tabs.map(id => {
                const t = TABS.find(x => x.id === id)
                const Icon = t.icon
                const active = tab === id
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTab(id)}
                    className={`flex-shrink-0 flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm whitespace-nowrap transition-colors
                      ${active ? 'bg-gray-100 text-gray-900 font-semibold' : 'text-gray-500 font-medium hover:bg-gray-50 hover:text-gray-800'}`}
                  >
                    <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-gray-900' : 'text-gray-400'}`} />
                    {t.label}
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 p-5 sm:p-6 min-w-0">
          {STANDALONE_TABS.includes(tab)
            ? <ActiveTab />
            : <ActiveTab settings={settings} onSave={mutation.mutate} saving={mutation.isPending} />
          }
        </div>
      </div>
    </div>
  )
}
