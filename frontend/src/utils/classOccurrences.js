const DAY_INDEX = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 }

export function toYMD(date) {
  const y   = date.getFullYear()
  const m   = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseYMD(str) {
  return new Date(`${str.slice(0, 10)}T00:00:00`)
}

export function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

export function startOfWeek(date) {
  const d = startOfDay(date)
  const mondayOffset = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - mondayOffset)
  return d
}

export function endOfWeek(date) {
  const d = startOfWeek(date)
  d.setDate(d.getDate() + 6)
  return d
}

/**
 * Reconciles recurring group-class schedules (day_of_week templates) and dated
 * private-session rows into one flat, date-sorted list of occurrences.
 */
export function getOccurrencesInRange(classes, rangeStart, rangeEnd) {
  const occurrences = []

  classes.forEach(c => {
    if (c.type === 'private') {
      (c.sessions ?? []).forEach(s => {
        if (!s.scheduled_date) return
        const d = parseYMD(s.scheduled_date)
        if (d >= rangeStart && d <= rangeEnd) {
          occurrences.push({ date: toYMD(d), gymClass: c, kind: 'session', session: s })
        }
      })
      return
    }

    if (!c.schedules?.length) return
    const startDate = c.start_date ? parseYMD(c.start_date) : null

    const cursor = new Date(rangeStart)
    while (cursor <= rangeEnd) {
      if (!startDate || cursor >= startDate) {
        const weekday = cursor.getDay()
        c.schedules.forEach(sch => {
          if (DAY_INDEX[sch.day_of_week] === weekday) {
            occurrences.push({ date: toYMD(cursor), gymClass: c, kind: 'schedule', schedule: sch })
          }
        })
      }
      cursor.setDate(cursor.getDate() + 1)
    }
  })

  return occurrences.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date)
    const at = a.schedule?.start_time ?? '99:99'
    const bt = b.schedule?.start_time ?? '99:99'
    return at.localeCompare(bt)
  })
}
