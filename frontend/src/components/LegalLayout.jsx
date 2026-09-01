import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, Printer, Clock, CalendarClock } from 'lucide-react'
import GemaSystemLogo from './GemaSystemLogo'

// A numbered section with a stable anchor id — the id is what the sidebar
// TOC and the scroll-spy below both key off, independent of how the title
// text is worded (so re-wording a heading later never breaks a deep link).
export function LegalSection({ id, index, title, children }) {
  return (
    <section id={id} className="mb-10 last:mb-0 scroll-mt-24">
      <h2 className="flex items-baseline gap-2.5 text-lg font-bold text-gray-900 mb-3">
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 text-[11px] font-extrabold flex-shrink-0 translate-y-0.5">
          {index}
        </span>
        {title}
      </h2>
      <div className="text-sm text-gray-600 leading-relaxed space-y-3 pl-[34px]">{children}</div>
    </section>
  )
}

// Sidebar table of contents with scroll-spy — highlights whichever section
// is currently crossing the top third of the viewport. IntersectionObserver
// instead of a scroll listener: no manual throttling, and it naturally
// tolerates sections of very different heights (a one-paragraph section next
// to a long bulleted one) without special-casing.
function TableOfContents({ toc, activeId, onJump }) {
  return (
    <nav aria-label="Tabla de contenido" className="space-y-0.5">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 px-3">En esta página</p>
      {toc.map((item, i) => {
        const active = item.id === activeId
        return (
          <a
            key={item.id}
            href={`#${item.id}`}
            onClick={(e) => { e.preventDefault(); onJump(item.id) }}
            className={`flex items-baseline gap-2.5 px-3 py-1.5 rounded-lg text-[13px] leading-snug transition-colors ${
              active ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            <span className={`text-[10px] font-bold tabular-nums ${active ? 'text-indigo-500' : 'text-gray-300'}`}>{i + 1}</span>
            <span>{item.label}</span>
          </a>
        )
      })}
    </nav>
  )
}

export default function LegalLayout({ title, updated, summary, toc, children }) {
  const [activeId, setActiveId] = useState(toc?.[0]?.id)
  const [readMins, setReadMins] = useState(null)
  const contentRef = useRef(null)

  // Real reading-time estimate — measured off the rendered text rather than
  // hardcoded, so it never drifts out of sync as sections get edited.
  useEffect(() => {
    if (!contentRef.current) return
    const words = contentRef.current.textContent.trim().split(/\s+/).filter(Boolean).length
    setReadMins(Math.max(1, Math.round(words / 200)))
  }, [children])

  useEffect(() => {
    if (!toc?.length) return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter(e => e.isIntersecting)
        if (visible.length > 0) {
          setActiveId(visible[0].target.id)
        }
      },
      { rootMargin: '-15% 0px -70% 0px', threshold: 0 }
    )
    const els = toc.map(t => document.getElementById(t.id)).filter(Boolean)
    els.forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [toc])

  const jumpTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActiveId(id)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 print:bg-white">
      <div className="sticky top-0 z-10 backdrop-blur-md bg-slate-900/70 border-b border-white/10 print:hidden">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-500/25">
              <GemaSystemLogo className="w-4 h-4" />
            </div>
            <span className="font-extrabold text-white text-base tracking-tight">GemaSystem</span>
          </Link>
          <Link to="/" className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors">
            <ChevronLeft className="w-4 h-4" /> Volver
          </Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-10 sm:py-14">
        <div className="lg:grid lg:grid-cols-[220px_1fr] lg:gap-10 lg:items-start">

          {/* ── Sidebar TOC — desktop only, sticky under the header ── */}
          {toc?.length > 0 && (
            <aside className="hidden lg:block sticky top-24 self-start print:hidden">
              <TableOfContents toc={toc} activeId={activeId} onJump={jumpTo} />
            </aside>
          )}

          {/* ── Document ── */}
          <div className="bg-white rounded-3xl shadow-2xl shadow-black/30 p-6 sm:p-12 print:shadow-none print:p-0 print:rounded-none">

            {/* Print/PDF-only header — just the mark and the name, no
                gradient box or border around the logo like the on-screen
                nav (that one stays print:hidden below). */}
            <div className="hidden print:flex items-center gap-2 mb-6">
              <GemaSystemLogo className="w-6 h-6" color="#4F46E5" />
              <span className="font-extrabold text-gray-900 text-base tracking-tight">GemaSystem</span>
            </div>

            <div className="flex items-start justify-between gap-4 mb-1">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">{title}</h1>
              <button
                onClick={() => window.print()}
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-500 hover:text-gray-800 hover:border-gray-300 transition-colors flex-shrink-0 print:hidden"
              >
                <Printer className="w-3.5 h-3.5" /> Imprimir / PDF
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400 mb-8">
              <span className="flex items-center gap-1.5"><CalendarClock className="w-3.5 h-3.5" /> Actualizado el {updated}</span>
              {readMins && <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> ≈ {readMins} min de lectura</span>}
            </div>

            {/* ── Mobile TOC — collapsed by default, same anchors as the sidebar ── */}
            {toc?.length > 0 && (
              <details className="lg:hidden mb-8 rounded-xl border border-gray-200 bg-gray-50 print:hidden">
                <summary className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide cursor-pointer select-none">
                  Ver contenido de esta página
                </summary>
                <div className="px-2 pb-2">
                  <TableOfContents toc={toc} activeId={activeId} onJump={jumpTo} />
                </div>
              </details>
            )}

            {summary?.length > 0 && (
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5 mb-10">
                <p className="text-[11px] font-bold text-indigo-600 uppercase tracking-widest mb-3">En resumen</p>
                <ul className="space-y-2">
                  {summary.map((line, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-indigo-900 leading-snug">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 flex-shrink-0" />
                      {line}
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] text-indigo-400 mt-3">Este resumen es solo orientativo — el texto completo abajo es lo que aplica legalmente.</p>
              </div>
            )}

            <div ref={contentRef}>{children}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
