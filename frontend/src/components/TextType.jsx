import { useEffect, useState } from 'react'

// ─── TextType ───────────────────────────────────────────────────────────────
// Cycles through `texts`, typing and deleting each one — inspired by
// reactbits.dev's "Text Type" animation. Dependency-free (plain timers).

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export default function TextType({
  texts = [''],
  as: Tag = 'span',
  className = '',
  typingSpeed = 45,
  deletingSpeed = 28,
  pauseDuration = 1800,
  initialDelay = 300,
  loop = true,
  showCursor = true,
  cursorClassName = '',
}) {
  const [index, setIndex] = useState(0)
  const [display, setDisplay] = useState(() => (prefersReducedMotion() ? (texts[0] ?? '') : ''))
  const [deleting, setDeleting] = useState(false)
  const [started, setStarted] = useState(false)

  // Initial delay before the first character types.
  useEffect(() => {
    const t = setTimeout(() => setStarted(true), initialDelay)
    return () => clearTimeout(t)
  }, [initialDelay])

  useEffect(() => {
    if (!started || texts.length === 0 || prefersReducedMotion()) return

    const current = texts[index % texts.length]
    const atLastWord = !loop && index === texts.length - 1

    let delay
    let action

    if (!deleting && display.length < current.length) {
      delay = typingSpeed
      action = () => setDisplay(current.slice(0, display.length + 1))
    } else if (!deleting && display.length === current.length) {
      if (atLastWord) return
      delay = pauseDuration
      action = () => setDeleting(true)
    } else if (deleting && display.length > 0) {
      delay = deletingSpeed
      action = () => setDisplay(current.slice(0, display.length - 1))
    } else {
      delay = 0
      action = () => { setDeleting(false); setIndex(i => (i + 1) % texts.length) }
    }

    const timeout = setTimeout(action, delay)
    return () => clearTimeout(timeout)
  }, [started, display, deleting, index, texts, typingSpeed, deletingSpeed, pauseDuration, loop])

  // Once a non-looping run finishes typing its last text, the cursor stops
  // blinking and disappears — for a one-shot reveal (e.g. a wordmark or
  // button label typed in once on mount) a cursor left blinking forever
  // reads as broken, not settled.
  const current = texts[index % texts.length]
  const done = !loop && index === texts.length - 1 && !deleting && display.length === current.length

  return (
    <Tag className={className}>
      <span>{display}</span>
      {showCursor && !done && (
        <span
          aria-hidden="true"
          className={`inline-block w-[2px] ml-0.5 align-[-0.15em] bg-current animate-pulse ${cursorClassName}`}
          style={{ height: '1em' }}
        />
      )}
    </Tag>
  )
}
