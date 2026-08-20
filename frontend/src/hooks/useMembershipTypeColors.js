import { useQuery } from '@tanstack/react-query'
import api from '../api/axios'

/**
 * { [type name]: color } for every membership type that has a color saved
 * (Settings → Precios → Tipos de membresía). Shared react-query cache key,
 * so this is a no-op re-fetch anywhere it's already loaded on the page.
 */
export default function useMembershipTypeColors() {
  const { data: types = [] } = useQuery({
    queryKey: ['membership-types'],
    queryFn: () => api.get('/membership-types').then(r => r.data),
  })
  return Object.fromEntries(types.filter(t => t.color).map(t => [t.name, t.color]))
}
