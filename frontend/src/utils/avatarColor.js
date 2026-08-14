const AVATAR_COLORS = [
  'from-emerald-400 to-teal-600',
  'from-indigo-400 to-violet-600',
  'from-rose-400 to-pink-600',
  'from-amber-400 to-orange-500',
  'from-sky-400 to-blue-600',
  'from-fuchsia-400 to-purple-600',
]

export function avatarColor(id) {
  return AVATAR_COLORS[(id ?? 0) % AVATAR_COLORS.length]
}
