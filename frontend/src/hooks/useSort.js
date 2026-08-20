import { useState } from 'react'

/**
 * Column-sort state for a table. Click cycles asc → desc → none (unsorted).
 * Returns [sort, onSort] where sort = { by: string|null, dir: 'asc'|'desc' }.
 */
export default function useSort(defaultBy = null, defaultDir = 'asc') {
  const [sort, setSort] = useState({ by: defaultBy, dir: defaultDir })

  function onSort(key) {
    setSort(s => {
      if (s.by !== key) return { by: key, dir: 'asc' }
      if (s.dir === 'asc') return { by: key, dir: 'desc' }
      return { by: null, dir: 'asc' }
    })
  }

  return [sort, onSort]
}
