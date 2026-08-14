import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '../api/axios'
import { applyTheme } from '../utils/theme'

const applyDark = (enabled) => {
  document.documentElement.classList.toggle('dark', enabled)
}

export const useSettingsStore = create(
  persist(
    (set, get) => ({
      privacyMode: false,
      togglePrivacy: () => set(s => ({ privacyMode: !s.privacyMode })),

      darkMode: false,
      toggleDarkMode: () => set(s => {
        const next = !s.darkMode
        applyDark(next)
        return { darkMode: next }
      }),

      systemSettings: {},
      setSystemSettings: (settings) => {
        set({ systemSettings: settings })
        if (settings.theme_color) applyTheme(settings.theme_color)
      },
      loadSettings: async () => {
        try {
          const { data } = await api.get('/settings')
          get().setSystemSettings(data)
        } catch {}
      },
      resetGymData: () => set({ systemSettings: {} }),
    }),
    {
      name: 'gemasystem_settings',
      onRehydrateStorage: () => (state) => {
        if (state?.darkMode) applyDark(true)
      },
    }
  )
)
