import { useState, useRef, useCallback, useEffect } from 'react'
import {
  Users, Dumbbell, CreditCard, Upload, FileSpreadsheet, FileText, Table, ArrowRight,
  CheckCircle, AlertCircle, Loader2, RotateCcw, Info, Wand2, UserPlus, ShieldAlert,
} from 'lucide-react'
import api from '../../api/axios'
import { parseFile } from '../../utils/fileParser'

const ENTITIES = [
  {
    id: 'members',
    label: 'Miembros',
    icon: Users,
    description: 'Importa la lista de miembros del gimnasio',
    fields: [
      { key: 'nombre',              label: 'Nombre completo',        required: true },
      { key: 'email',               label: 'Correo electrónico' },
      { key: 'telefono',            label: 'Teléfono' },
      { key: 'tipo',                label: 'Tipo de membresía' },
      { key: 'contacto_emergencia', label: 'Contacto de emergencia' },
      { key: 'telefono_emergencia', label: 'Tel. de emergencia' },
      { key: 'nacimiento',          label: 'Fecha de nacimiento' },
      { key: 'genero',              label: 'Género' },
      { key: 'direccion',           label: 'Dirección' },
    ],
    accent: { bg: '#EEF2FF', border: '#C7D2FE', text: '#4F46E5', icon: '#6366F1' },
  },
  {
    id: 'trainers',
    label: 'Entrenadores',
    icon: Dumbbell,
    description: 'Importa la lista de entrenadores',
    fields: [
      { key: 'nombre',              label: 'Nombre completo', required: true },
      { key: 'email',               label: 'Correo electrónico' },
      { key: 'telefono',            label: 'Teléfono' },
      { key: 'especialidad',        label: 'Especialidad' },
      { key: 'certificaciones',     label: 'Certificaciones' },
      { key: 'bio',                 label: 'Biografía' },
      { key: 'fecha_contratacion',  label: 'Fecha de contratación' },
    ],
    accent: { bg: '#F5F3FF', border: '#DDD6FE', text: '#7C3AED', icon: '#8B5CF6' },
  },
  {
    id: 'memberships',
    label: 'Membresías',
    icon: CreditCard,
    description: 'Importa membresías — si el socio no existe, lo registramos automáticamente',
    fields: [
      { key: 'nombre',       label: 'Nombre del socio', required: true },
      { key: 'email',        label: 'Correo electrónico' },
      { key: 'telefono',     label: 'Teléfono' },
      { key: 'plan',         label: 'Plan (semanal/mensual/etc.)' },
      { key: 'fecha_inicio', label: 'Fecha de inicio' },
      { key: 'fecha_fin',    label: 'Fecha de fin' },
      { key: 'monto',        label: 'Monto pagado' },
      { key: 'metodo_pago',  label: 'Método de pago' },
      { key: 'estado',       label: 'Estado (activa/vencida/cancelada)' },
    ],
    accent: { bg: '#ECFDF5', border: '#A7F3D0', text: '#065F46', icon: '#10B981' },
  },
]

const STEPS = ['Tipo de datos', 'Archivo', 'Mapeo', 'Resultado']

// ── helpers ────────────────────────────────────────────────────────────────────
const normalizeCol = s =>
  s.toLowerCase().trim()
   .replace(/[áàä]/g,'a').replace(/[éèë]/g,'e').replace(/[íìï]/g,'i').replace(/[óòö]/g,'o').replace(/[úùü]/g,'u')
   .replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'')

// Best-guess mapping: for each expected field, find the file column whose
// normalized name matches most closely. Purely a starting point — the user
// confirms or overrides every field before anything gets imported.
function guessMapping(fields, fileColumns) {
  const normalizedFile = fileColumns.map(c => ({ raw: c, norm: normalizeCol(c) }))
  const mapping = {}
  fields.forEach(({ key }) => {
    const norm = normalizeCol(key)
    const hit  = normalizedFile.find(fc => fc.norm === norm || fc.norm.includes(norm) || norm.includes(fc.norm))
    mapping[key] = hit?.raw ?? ''
  })
  return mapping
}

// ── Step bar ──────────────────────────────────────────────────────────────────
function StepBar({ current }) {
  return (
    <div className="flex items-center px-1 py-4 flex-shrink-0">
      {STEPS.map((label, i) => {
        const done   = i < current
        const active = i === current
        const last   = i === STEPS.length - 1
        return (
          <div key={label} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                style={{
                  background: done ? '#10B981' : active ? '#6366F1' : '#E8E8EC',
                  color:      done || active ? '#fff' : '#9CA3AF',
                  boxShadow:  active ? '0 0 0 4px rgba(99,102,241,0.15)' : 'none',
                }}>
                {done ? <CheckCircle className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span className="text-[9px] font-semibold whitespace-nowrap"
                style={{ color: active ? '#6366F1' : done ? '#10B981' : '#9CA3AF' }}>
                {label}
              </span>
            </div>
            {!last && (
              <div className="flex-1 h-px mx-2 mb-4 transition-colors"
                style={{ background: done ? '#10B981' : '#E8E8EC' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Entity card ───────────────────────────────────────────────────────────────
function EntityCard({ entity, selected, onClick }) {
  const { icon: Icon, label, description, fields, accent } = entity
  return (
    <button onClick={onClick} className="w-full p-4 rounded-2xl text-left transition-all"
      style={{
        background: selected ? accent.bg : '#F7F8FA',
        border: `2px solid ${selected ? accent.border : 'transparent'}`,
      }}>
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: selected ? accent.border : '#EBEBF0' }}>
          <Icon className="w-5 h-5" style={{ color: selected ? accent.icon : '#9CA3AF' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm" style={{ color: selected ? accent.text : '#374151' }}>{label}</p>
          <p className="text-xs mt-0.5 leading-relaxed" style={{ color: '#9CA3AF' }}>{description}</p>
        </div>
        {selected && <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: accent.icon }} />}
      </div>
      <div className="flex flex-wrap gap-1">
        {fields.map(f => (
          <span key={f.key} className="text-[10px] font-medium px-2 py-0.5 rounded-md"
            style={{ background: selected ? accent.border : '#E5E7EB', color: selected ? accent.text : '#6B7280' }}>
            {f.label}{f.required ? ' *' : ''}
          </span>
        ))}
      </div>
    </button>
  )
}

// ── Field checklist — decide upfront which fields your file even has ──────────
function FieldChecklist({ fields, activeKeys, onToggle }) {
  return (
    <div>
      <p className="text-sm font-semibold mb-0.5 text-gray-900">¿Qué datos tiene tu archivo?</p>
      <p className="text-xs mb-3 text-gray-400">
        Desmarca los que sepas que tu archivo no trae — así no aparecerán al mapear columnas.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {fields.map(f => {
          const checked = f.required || activeKeys.has(f.key)
          return (
            <label
              key={f.key}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs transition-colors ${f.required ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
              style={{ borderColor: checked ? '#C7D2FE' : '#E5E7EB', background: checked ? '#EEF2FF' : '#fff' }}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={f.required}
                onChange={() => onToggle(f.key)}
                className="w-3.5 h-3.5 rounded flex-shrink-0"
                style={{ accentColor: '#6366F1' }}
              />
              <span className="font-medium" style={{ color: checked ? '#4338CA' : '#6B7280' }}>
                {f.label}{f.required && ' *'}
              </span>
            </label>
          )
        })}
      </div>
    </div>
  )
}

// ── Drop zone ─────────────────────────────────────────────────────────────────
function DropZone({ dragOver, setDragOver, onFile, fileInputRef }) {
  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) onFile(f) }}
      onClick={() => fileInputRef.current?.click()}
      className="rounded-2xl cursor-pointer transition-all flex flex-col items-center gap-3 py-10 px-6"
      style={{
        border: `2px dashed ${dragOver ? '#6366F1' : '#D1D5DB'}`,
        background: dragOver ? '#EEF2FF' : '#F7F8FA',
      }}>
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center transition-all"
        style={{ background: dragOver ? '#C7D2FE' : '#EBEBF0', transform: dragOver ? 'scale(1.12)' : 'scale(1)' }}>
        <Upload className="w-8 h-8" style={{ color: dragOver ? '#6366F1' : '#9CA3AF' }} />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold" style={{ color: '#374151' }}>
          {dragOver ? 'Suelta el archivo aquí' : 'Arrastra tu archivo aquí'}
        </p>
        <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>
          o <span style={{ color: '#6366F1', fontWeight: 600 }}>haz clic para seleccionar</span>
        </p>
      </div>
      <div className="flex gap-2">
        {[{ ext: 'Excel', Icon: FileSpreadsheet }, { ext: 'CSV', Icon: FileText }, { ext: 'ODS', Icon: Table }].map(({ ext, Icon }) => (
          <span key={ext} className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full"
            style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', color: '#6B7280' }}>
            <Icon className="w-3 h-3" /> {ext}
          </span>
        ))}
      </div>
      <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv,.ods"
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = '' }}
        className="hidden" />
    </div>
  )
}

// ── Mapping panel — the user decides which file column feeds each field ───────
function MappingPanel({ fields, fileColumns, mapping, onChange, matchedCount }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #E5E7EB' }}>
      <div className="flex items-center justify-between px-4 py-2.5" style={{ background: '#F7F8FA', borderBottom: '1px solid #EBEBF0' }}>
        <p className="text-xs font-semibold" style={{ color: '#374151' }}>¿Qué columna de tu archivo corresponde a cada dato?</p>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1"
          style={{ background: '#EEF2FF', color: '#4338CA' }}>
          <Wand2 className="w-3 h-3" /> {matchedCount}/{fields.length} sugeridas
        </span>
      </div>
      <div className="p-3.5 space-y-2.5">
        {fields.map(f => {
          const value = mapping[f.key] ?? ''
          const missing = f.required && !value
          return (
            <div key={f.key} className="flex items-center gap-3">
              <div className="w-36 flex-shrink-0">
                <p className="text-xs font-semibold" style={{ color: missing ? '#DC2626' : '#374151' }}>
                  {f.label}{f.required && <span style={{ color: '#EF4444' }}> *</span>}
                </p>
              </div>
              <select
                value={value}
                onChange={e => onChange(f.key, e.target.value)}
                className="input text-xs flex-1 py-1.5"
                style={missing ? { borderColor: '#FCA5A5' } : undefined}
              >
                <option value="">— No importar este dato —</option>
                {fileColumns.map(col => <option key={col} value={col}>{col}</option>)}
              </select>
            </div>
          )
        })}
      </div>
      <div className="px-4 py-2.5 flex gap-2" style={{ background: '#F8FAFF', borderTop: '1px solid #EBEBF0' }}>
        <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: '#6366F1' }} />
        <p className="text-[11px] leading-relaxed" style={{ color: '#4338CA' }}>
          Prellenamos lo que reconocimos automáticamente — ajusta cualquier campo o elige <strong>"No importar este dato"</strong> si tu archivo no lo tiene.
        </p>
      </div>
    </div>
  )
}

// ── Mapped preview — shows exactly what will be imported ──────────────────────
function MappedPreviewTable({ fields, mapping, rows, fileName, existsResults, checkingExists }) {
  const preview     = rows.slice(0, 5)
  const showStatus  = checkingExists || !!existsResults
  const existsCount = existsResults?.filter(r => r.exists).length ?? 0
  const newCount    = existsResults ? existsResults.length - existsCount : 0

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: '#EEF2FF' }}>
            <FileSpreadsheet className="w-4 h-4" style={{ color: '#6366F1' }} />
          </div>
          <div>
            <p className="text-sm font-semibold truncate max-w-[220px]" style={{ color: '#374151' }}>{fileName}</p>
            <p className="text-xs" style={{ color: '#9CA3AF' }}>{rows.length} registros encontrados</p>
          </div>
        </div>
        <span className="text-xs font-bold text-white px-2.5 py-1 rounded-full"
          style={{ background: 'linear-gradient(135deg,#6366f1,#7c3aed)' }}>
          {rows.length} filas
        </span>
      </div>
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #EBEBF0' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: '#F7F8FA', borderBottom: '1px solid #EBEBF0' }}>
                {fields.map(f => (
                  <th key={f.key} className="px-3 py-2.5 text-left font-semibold whitespace-nowrap" style={{ color: '#6B7280' }}>
                    {f.label}
                  </th>
                ))}
                {showStatus && (
                  <th className="px-3 py-2.5 text-left font-semibold whitespace-nowrap" style={{ color: '#6B7280' }}>Estado</th>
                )}
              </tr>
            </thead>
            <tbody>
              {preview.map((row, i) => (
                <tr key={i} style={{ borderBottom: i < preview.length - 1 ? '1px solid #F0F0F5' : 'none', background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                  {fields.map(f => {
                    const col = mapping[f.key]
                    return (
                      <td key={f.key} className="px-3 py-2.5 whitespace-nowrap max-w-[140px] truncate"
                        style={{ color: col ? '#374151' : '#D1D5DB' }}>
                        {col ? String(row[col] ?? '') : '—'}
                      </td>
                    )
                  })}
                  {showStatus && (
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {checkingExists ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: '#C7D2FE' }} />
                      ) : existsResults?.[i]?.exists ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#FEF3C7', color: '#92400E' }}>Ya existe</span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#D1FAE5', color: '#065F46' }}>Nuevo</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length > 5 && (
          <p className="text-center text-xs py-2.5" style={{ color: '#9CA3AF', borderTop: '1px solid #F0F0F5', background: '#FAFAFA' }}>
            Mostrando 5 de {rows.length} filas — se importarán todas
          </p>
        )}
      </div>
      {!checkingExists && existsResults && (
        <p className="text-xs mt-2" style={{ color: '#9CA3AF' }}>
          <strong style={{ color: '#92400E' }}>{existsCount}</strong> ya está{existsCount !== 1 ? 'n' : ''} en el sistema ·{' '}
          <strong style={{ color: '#065F46' }}>{newCount}</strong> son nuevos
        </p>
      )}
    </div>
  )
}

// ── Created detail table — exactly what got imported ──────────────────────────
function CreatedDetailTable({ created }) {
  if (!created?.length) return null
  const cols    = Object.keys(created[0])
  const preview = created.slice(0, 10)

  return (
    <div className="w-full text-left">
      <p className="text-xs font-semibold text-gray-700 mb-2">Detalle de lo importado</p>
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #EBEBF0' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: '#F7F8FA', borderBottom: '1px solid #EBEBF0' }}>
                {cols.map(c => (
                  <th key={c} className="px-3 py-2 text-left font-semibold whitespace-nowrap" style={{ color: '#6B7280' }}>
                    {c.replace(/_/g, ' ')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.map((row, i) => (
                <tr key={i} style={{ borderBottom: i < preview.length - 1 ? '1px solid #F0F0F5' : 'none', background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                  {cols.map(c => {
                    const val = row[c]
                    if (typeof val === 'boolean') {
                      return (
                        <td key={c} className="px-3 py-2 whitespace-nowrap">
                          {val
                            ? <span className="inline-flex items-center gap-1 font-semibold" style={{ color: '#059669' }}><UserPlus className="w-3 h-3" /> Sí</span>
                            : <span style={{ color: '#D1D5DB' }}>No</span>}
                        </td>
                      )
                    }
                    return (
                      <td key={c} className="px-3 py-2 whitespace-nowrap max-w-[160px] truncate" style={{ color: '#374151' }}>
                        {val ?? '—'}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {created.length > 10 && (
          <p className="text-center text-xs py-2" style={{ color: '#9CA3AF', borderTop: '1px solid #F0F0F5', background: '#FAFAFA' }}>
            Mostrando 10 de {created.length} registros importados
          </p>
        )}
      </div>
    </div>
  )
}

// ── Result card ───────────────────────────────────────────────────────────────
function ResultCard({ result, onReset }) {
  return (
    <div className="flex flex-col items-center gap-5 py-8 px-4 text-center">
      <div className="w-20 h-20 rounded-full flex items-center justify-center"
        style={{
          background: result.success ? 'linear-gradient(135deg,#D1FAE5,#A7F3D0)' : 'linear-gradient(135deg,#FEE2E2,#FECACA)',
          boxShadow:  result.success ? '0 8px 24px rgba(16,185,129,0.25)' : '0 8px 24px rgba(239,68,68,0.2)',
        }}>
        {result.success
          ? <CheckCircle className="w-10 h-10 text-emerald-500" />
          : <AlertCircle className="w-10 h-10 text-red-500" />}
      </div>
      <div>
        <p className="font-bold text-lg" style={{ color: result.success ? '#065F46' : '#991B1B' }}>
          {result.success ? '¡Importación completada!' : 'Error en la importación'}
        </p>
        <p className="text-sm mt-1" style={{ color: '#9CA3AF' }}>
          {result.success ? 'Los registros fueron procesados correctamente.' : (result.message ?? 'Ocurrió un error inesperado.')}
        </p>
      </div>
      {result.success && (
        <div className="grid grid-cols-3 gap-3 w-full">
          {[
            { label: 'Importados', value: result.imported ?? 0, bg: 'linear-gradient(135deg,#ECFDF5,#D1FAE5)', border: '#A7F3D0', val: '#065F46' },
            { label: 'Omitidos',   value: result.skipped  ?? 0, bg: '#F9FAFB', border: '#E5E7EB', val: '#6B7280' },
            { label: 'Errores',    value: result.errors?.length ?? 0, bg: 'linear-gradient(135deg,#FEF2F2,#FEE2E2)', border: '#FECACA', val: '#991B1B' },
          ].map(({ label, value, bg, border, val }) => (
            <div key={label} className="rounded-2xl p-4" style={{ background: bg, border: `1px solid ${border}` }}>
              <p className="text-3xl font-black leading-none" style={{ color: val }}>{value}</p>
              <p className="text-xs mt-1 font-medium" style={{ color: val, opacity: 0.7 }}>{label}</p>
            </div>
          ))}
        </div>
      )}

      {result.success && result.membersMade > 0 && (
        <div className="w-full flex items-center gap-2.5 rounded-xl px-4 py-3" style={{ background: '#ECFDF5', border: '1px solid #A7F3D0' }}>
          <UserPlus className="w-4 h-4 flex-shrink-0" style={{ color: '#059669' }} />
          <p className="text-xs leading-relaxed" style={{ color: '#065F46' }}>
            <strong>{result.membersMade}</strong> socio{result.membersMade !== 1 ? 's' : ''} no estaba{result.membersMade !== 1 ? 'n' : ''} registrado{result.membersMade !== 1 ? 's' : ''} y se registró automáticamente antes de asignarle la membresía.
          </p>
        </div>
      )}

      {result.success && result.sanitized > 0 && (
        <div className="w-full flex items-center gap-2.5 rounded-xl px-4 py-3" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
          <ShieldAlert className="w-4 h-4 flex-shrink-0" style={{ color: '#D97706' }} />
          <p className="text-xs leading-relaxed" style={{ color: '#92400E' }}>
            Limpiamos <strong>{result.sanitized}</strong> valor{result.sanitized !== 1 ? 'es' : ''} con contenido sospechoso o mal formado antes de guardarlo (por seguridad).
          </p>
        </div>
      )}

      {result.success && <CreatedDetailTable created={result.created} />}
      {result.errors?.length > 0 && (
        <div className="w-full rounded-xl text-left" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
          <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: '1px solid #FECACA' }}>
            <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
            <p className="text-xs font-semibold" style={{ color: '#DC2626' }}>
              {result.errors.length} error{result.errors.length !== 1 ? 'es' : ''} detectado{result.errors.length !== 1 ? 's' : ''}
            </p>
          </div>
          <ul className="px-4 py-3 space-y-1.5">
            {result.errors.slice(0, 6).map((e, i) => (
              <li key={i} className="text-xs flex gap-1.5" style={{ color: '#EF4444' }}>
                <span style={{ color: '#FECACA' }}>•</span> {e}
              </li>
            ))}
            {result.errors.length > 6 && (
              <li className="text-xs" style={{ color: '#9CA3AF' }}>…y {result.errors.length - 6} errores más</li>
            )}
          </ul>
        </div>
      )}
      <button onClick={onReset}
        className="flex items-center gap-2 text-sm font-medium px-5 py-2.5 rounded-xl transition-all"
        style={{ background: '#F7F8FA', border: '1px solid #E5E7EB', color: '#6B7280' }}
        onMouseOver={e => e.currentTarget.style.background = '#F0F0F5'}
        onMouseOut={e => e.currentTarget.style.background = '#F7F8FA'}>
        <RotateCcw className="w-4 h-4" />
        Importar otro archivo
      </button>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ImportDataTab() {
  const [step, setStep]             = useState(0)
  const [entity, setEntity]         = useState('members')
  const [parsedRows, setParsedRows] = useState(null)
  const [fileName, setFileName]     = useState('')
  const [dragOver, setDragOver]     = useState(false)
  const [parseError, setParseError] = useState('')
  const [mapping, setMapping]       = useState({})
  const [importing, setImporting]   = useState(false)
  const [result, setResult]         = useState(null)
  const fileInputRef                = useRef(null)

  const [activeKeys, setActiveKeys]         = useState(() => new Set(ENTITIES[0].fields.map(f => f.key)))
  const [existsResults, setExistsResults]   = useState(null)
  const [checkingExists, setCheckingExists] = useState(false)

  const entityCfg    = ENTITIES.find(e => e.id === entity)
  const fileColumns  = parsedRows?.[0] ? Object.keys(parsedRows[0]) : []
  const activeFields  = entityCfg.fields.filter(f => f.required || activeKeys.has(f.key))
  const requiredKeys  = activeFields.filter(f => f.required).map(f => f.key)
  const canImport     = requiredKeys.every(k => !!mapping[k])
  const matchedCount  = activeFields.filter(f => !!mapping[f.key]).length

  const emailActive   = activeFields.some(f => f.key === 'email') && !!mapping.email
  const phoneActive   = activeFields.some(f => f.key === 'telefono') && !!mapping.telefono
  const canCheckDupes = step === 2 && !!parsedRows?.length && (emailActive || phoneActive)

  function selectEntity(id) {
    setEntity(id)
    const cfg = ENTITIES.find(e => e.id === id)
    setActiveKeys(new Set(cfg.fields.map(f => f.key)))
  }

  function toggleField(key) {
    setActiveKeys(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // Auto-check for existing records once email or phone is mapped — debounced
  // so it doesn't fire on every keystroke-equivalent dropdown change. Guarded
  // by canCheckDupes so there's nothing to set when the conditions aren't met
  // (the render below only shows existsResults while canCheckDupes is true).
  useEffect(() => {
    if (!canCheckDupes) return

    const timer = setTimeout(async () => {
      setCheckingExists(true)
      try {
        const records = parsedRows.map(row => ({
          email:    emailActive ? (row[mapping.email] ?? '') : '',
          telefono: phoneActive ? (row[mapping.telefono] ?? '') : '',
        }))
        const { data } = await api.post('/import/check', { entity, records })
        setExistsResults(data.results)
      } catch {
        setExistsResults(null)
      } finally {
        setCheckingExists(false)
      }
    }, 500)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canCheckDupes, mapping.email, mapping.telefono, entity, parsedRows])

  const handleFile = useCallback(async (file) => {
    setParseError('')
    setFileName(file.name)
    try {
      const rows = await parseFile(file)
      if (rows.length === 0) throw new Error('El archivo está vacío o no tiene datos reconocibles.')
      setParsedRows(rows)
      setMapping(guessMapping(entityCfg.fields, Object.keys(rows[0])))
      setStep(2)
    } catch (err) {
      setParseError(err.message)
    }
  }, [entityCfg])

  function setFieldMapping(key, column) {
    setMapping(prev => ({ ...prev, [key]: column }))
  }

  async function handleImport() {
    if (!parsedRows?.length || !canImport) return
    const records = parsedRows.map(row => {
      const out = {}
      activeFields.forEach(f => {
        const col = mapping[f.key]
        out[f.key] = col ? (row[col] ?? '') : ''
      })
      return out
    })
    setImporting(true)
    try {
      const { data } = await api.post('/import', { entity, records })
      setResult({ success: true, ...data })
      setStep(3)
    } catch (err) {
      setResult({ success: false, message: err.response?.data?.message ?? 'Error al importar.' })
      setStep(3)
    } finally {
      setImporting(false)
    }
  }

  function reset() {
    setStep(0); setParsedRows(null); setFileName(''); setParseError(''); setMapping({})
    setResult(null); setExistsResults(null)
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Importar datos</h2>
        <p className="text-sm text-gray-500 mt-0.5">Carga miembros o entrenadores desde un archivo Excel, CSV u ODS — tú decides qué columna corresponde a cada dato.</p>
      </div>

      <StepBar current={step} />

      <div className="flex flex-col gap-5">

        {/* ── Step 0: Entity ── */}
        {step === 0 && (
          <>
            <div>
              <p className="text-sm font-semibold mb-0.5 text-gray-900">¿Qué tipo de datos quieres importar?</p>
              <p className="text-xs mb-3 text-gray-400">Selecciona la categoría</p>
              <div className="flex flex-col gap-2.5">
                {ENTITIES.map(e => (
                  <EntityCard key={e.id} entity={e} selected={entity === e.id} onClick={() => selectEntity(e.id)} />
                ))}
              </div>
            </div>

            <FieldChecklist fields={entityCfg.fields} activeKeys={activeKeys} onToggle={toggleField} />

            <button
              onClick={() => setStep(1)}
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl text-white text-sm font-semibold transition-all active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg,#6366f1,#7c3aed)', boxShadow: '0 4px 14px rgba(99,102,241,0.35)' }}>
              Continuar <ArrowRight className="w-4 h-4" />
            </button>
          </>
        )}

        {/* ── Step 1: Upload ── */}
        {step === 1 && (
          <>
            <div>
              <p className="text-sm font-semibold mb-0.5 text-gray-900">
                Sube el archivo con {entityCfg.label.toLowerCase()}
              </p>
              <p className="text-xs text-gray-400">
                Exporta desde Excel, Google Sheets o cualquier tabla compatible.
              </p>
            </div>

            <DropZone dragOver={dragOver} setDragOver={setDragOver} onFile={handleFile} fileInputRef={fileInputRef} />

            {parseError && (
              <div className="flex gap-2.5 rounded-xl px-4 py-3" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-700 leading-relaxed">{parseError}</p>
              </div>
            )}

            <button onClick={() => setStep(0)} className="text-xs text-center transition-colors text-gray-400 hover:text-gray-600">
              ← Volver a tipo de datos
            </button>
          </>
        )}

        {/* ── Step 2: Mapping + live preview ── */}
        {step === 2 && parsedRows && (
          <>
            <div>
              <p className="text-sm font-semibold mb-0.5 text-gray-900">Elige qué trae tu archivo</p>
              <p className="text-xs text-gray-400">Asigna cada dato a su columna, o márcalo como no disponible.</p>
            </div>

            {entity === 'memberships' && (
              <div className="flex gap-2.5 rounded-xl px-4 py-3" style={{ background: '#ECFDF5', border: '1px solid #A7F3D0' }}>
                <UserPlus className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#059669' }} />
                <p className="text-xs leading-relaxed" style={{ color: '#065F46' }}>
                  Buscamos al socio por correo o teléfono. Si no existe, lo registramos automáticamente antes de crear su membresía.
                </p>
              </div>
            )}

            <MappingPanel
              fields={activeFields}
              fileColumns={fileColumns}
              mapping={mapping}
              onChange={setFieldMapping}
              matchedCount={matchedCount}
            />

            <MappedPreviewTable
              fields={activeFields}
              mapping={mapping}
              rows={parsedRows}
              fileName={fileName}
              existsResults={canCheckDupes ? existsResults : null}
              checkingExists={canCheckDupes && checkingExists}
            />

            {!canImport && (
              <div className="flex gap-2.5 rounded-xl px-4 py-3" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-700 leading-relaxed">
                  Asigna una columna para <strong>{activeFields.find(f => f.required)?.label}</strong> antes de continuar — es obligatorio.
                </p>
              </div>
            )}

            <button
              onClick={handleImport}
              disabled={importing || !canImport}
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl text-white text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(135deg,#6366f1,#7c3aed)', boxShadow: '0 4px 14px rgba(99,102,241,0.35)' }}>
              {importing
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Importando…</>
                : <>Importar {parsedRows.length} {entityCfg.label.toLowerCase()}</>}
            </button>

            <button onClick={() => { setParsedRows(null); setStep(1) }}
              className="text-xs text-center text-gray-400">
              ← Subir otro archivo
            </button>
          </>
        )}

        {/* ── Step 3: Result ── */}
        {step === 3 && result && <ResultCard result={result} onReset={reset} />}
      </div>
    </div>
  )
}
