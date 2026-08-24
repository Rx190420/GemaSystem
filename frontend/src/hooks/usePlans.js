import { useQuery } from '@tanstack/react-query'
import api from '../api/axios'

/**
 * Basic/Full prices + the 5 Custom add-ons, straight from the backend's
 * config/plans.php (via GET /api/plans) — the single source of truth for
 * pricing. Never hardcode a price in a component; read it from here so
 * Landing/Register/Profile/SuperAdmin can never drift apart again.
 *
 * Shape: { currency, basic: {label,price,features}, full: {label,price,features},
 *          addons: { whatsapp: {label,price}, products: {...}, ... } }
 */
export default function usePlans() {
  const { data, isLoading } = useQuery({
    queryKey: ['plans'],
    queryFn: () => api.get('/plans').then(r => r.data),
    staleTime: 5 * 60 * 1000, // prices don't change minute to minute
  })
  return { plans: data, isLoading }
}

/** Basic price + the sum of the given addon keys — the live total shown in a
 *  Custom plan picker as the buyer toggles checkboxes. */
export function customTotal(plans, selectedKeys = []) {
  if (!plans) return 0
  const addonsSum = selectedKeys.reduce((sum, key) => sum + (plans.addons?.[key]?.price ?? 0), 0)
  return plans.basic.price + addonsSum
}

// What Basic includes — these 5 aren't part of the addon system (config/plans.php
// only lists the 5 *gated* extras), so there's nothing in the API response to
// derive this from. Shared here so Landing/Register show the identical list.
export const BASIC_INCLUDES = ['Dashboard', 'Miembros', 'Membresías', 'Visitas', 'Finanzas']

/** "Todo lo de Basic" + the label for every feature Full includes — driven by
 *  plans.full.features + plans.addons, so it can't drift from what Stripe
 *  actually unlocks. */
export function fullIncludes(plans) {
  return ['Todo lo de Basic', ...plans.full.features.map(key => plans.addons[key]?.label).filter(Boolean)]
}
