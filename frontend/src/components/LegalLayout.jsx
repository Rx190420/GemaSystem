import { Link } from 'react-router-dom'
import { Dumbbell, ChevronLeft } from 'lucide-react'

export function LegalSection({ title, children }) {
  return (
    <section className="mb-8 last:mb-0">
      <h2 className="text-lg font-bold text-gray-900 mb-3">{title}</h2>
      <div className="text-sm text-gray-600 leading-relaxed space-y-3">{children}</div>
    </section>
  )
}

export default function LegalLayout({ title, updated, children }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900">
      <div className="sticky top-0 z-10 backdrop-blur-md bg-slate-900/70 border-b border-white/10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-500/25">
              <Dumbbell className="w-4 h-4 text-white" />
            </div>
            <span className="font-extrabold text-white text-base tracking-tight">GemaSystem</span>
          </Link>
          <Link to="/" className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors">
            <ChevronLeft className="w-4 h-4" /> Volver
          </Link>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10 sm:py-14">
        <div className="bg-white rounded-3xl shadow-2xl shadow-black/30 p-6 sm:p-12">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-2 tracking-tight">{title}</h1>
          <p className="text-xs text-gray-400 mb-8">Última actualización: {updated}</p>
          {children}
        </div>
      </div>
    </div>
  )
}
