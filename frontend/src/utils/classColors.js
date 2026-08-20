// Same preset palette used for membership-type colors (Settings.jsx →
// TYPE_COLOR_PRESETS), reused here so a class's color swatch looks
// consistent with the rest of the app.
export const CLASS_COLOR_PRESETS = ['#6366F1', '#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#F43F5E', '#06B6D4', '#F97316']

/**
 * A class's assigned color, or a deterministic fallback keyed off its id so
 * classes created before this feature existed (or left uncolored) still get
 * a stable, distinguishable color instead of all collapsing into one.
 */
export function classColor(gymClass) {
  return gymClass?.color || CLASS_COLOR_PRESETS[(gymClass?.id ?? 0) % CLASS_COLOR_PRESETS.length]
}
