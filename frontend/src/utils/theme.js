export const THEME_OPTIONS = [
  { id: 'indigo',  label: 'Índigo',    hex: '#4F46E5' },
  { id: 'blue',    label: 'Azul',      hex: '#2563EB' },
  { id: 'emerald', label: 'Esmeralda', hex: '#059669' },
  { id: 'violet',  label: 'Violeta',   hex: '#7C3AED' },
  { id: 'rose',    label: 'Rosa',      hex: '#E11D48' },
  { id: 'amber',   label: 'Ámbar',     hex: '#D97706' },
]

const THEMES = {
  indigo:  { 50:'#EEF2FF', 100:'#E0E7FF', 500:'#6366F1', 600:'#4F46E5', 700:'#4338CA', 800:'#3730A3' },
  blue:    { 50:'#EFF6FF', 100:'#DBEAFE', 500:'#3B82F6', 600:'#2563EB', 700:'#1D4ED8', 800:'#1E40AF' },
  emerald: { 50:'#ECFDF5', 100:'#D1FAE5', 500:'#10B981', 600:'#059669', 700:'#047857', 800:'#065F46' },
  violet:  { 50:'#F5F3FF', 100:'#EDE9FE', 500:'#8B5CF6', 600:'#7C3AED', 700:'#6D28D9', 800:'#5B21B6' },
  rose:    { 50:'#FFF1F2', 100:'#FFE4E6', 500:'#F43F5E', 600:'#E11D48', 700:'#BE123C', 800:'#9F1239' },
  amber:   { 50:'#FFFBEB', 100:'#FEF3C7', 500:'#F59E0B', 600:'#D97706', 700:'#B45309', 800:'#92400E' },
}

export function applyTheme(colorName) {
  const theme = THEMES[colorName] ?? THEMES.indigo
  const root = document.documentElement
  Object.entries(theme).forEach(([shade, hex]) => {
    root.style.setProperty(`--color-primary-${shade}`, hex)
  })
}
