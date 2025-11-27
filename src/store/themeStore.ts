import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

export type ThemeMode = 'light' | 'dark' | 'system'

export interface ThemeState {
  // State
  themeMode: ThemeMode
  isDarkMode: boolean

  // Actions
  setThemeMode: (mode: ThemeMode) => void
  setIsDarkMode: (isDark: boolean) => void
  toggleDarkMode: () => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      // Initial state - default to system
      themeMode: 'system',
      isDarkMode: false,

      // Actions
      setThemeMode: (themeMode) => set({ themeMode }),

      setIsDarkMode: (isDarkMode) => set({ isDarkMode }),

      toggleDarkMode: () => {
        const { isDarkMode } = get()
        set({
          isDarkMode: !isDarkMode,
          themeMode: !isDarkMode ? 'dark' : 'light',
        })
      },
    }),
    {
      name: 'wif-theme-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        themeMode: state.themeMode,
        isDarkMode: state.isDarkMode,
      }),
    }
  )
)

// Selectors for better performance
export const useThemeMode = () => useThemeStore((state) => state.themeMode)
export const useIsDarkMode = () => useThemeStore((state) => state.isDarkMode)
