import { useEffect, useState } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { TamaguiProvider, Theme } from 'tamagui'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context'

import config from '../src/config/tamagui.config'
import { useAuthStore } from '../src/store/authStore'
import { useThemeStore } from '../src/store/themeStore'
import { initActivityLogService } from '../src/services/activity/activityLogService'

// Keep splash screen visible while loading
SplashScreen.preventAutoHideAsync()

// Create query client for data fetching
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
    },
  },
})

export default function RootLayout() {
  const isDarkMode = useThemeStore((state) => state.isDarkMode)
  const themeName = isDarkMode ? 'dark' : 'light'
  const [isReady, setIsReady] = useState(false)
  const checkBiometricStatus = useAuthStore((state) => state.checkBiometricStatus)
  const setLoading = useAuthStore((state) => state.setLoading)

  useEffect(() => {
    async function prepare() {
      try {
        // Check biometric status on app launch
        await checkBiometricStatus()

        // Initialize activity log service (sync pending logs)
        await initActivityLogService()
      } catch (e) {
        console.warn('App initialization error:', e)
      } finally {
        setLoading(false)
        setIsReady(true)
        await SplashScreen.hideAsync()
      }
    }

    prepare()
  }, [])

  if (!isReady) {
    return null
  }

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <QueryClientProvider client={queryClient}>
        <TamaguiProvider config={config} defaultTheme={themeName}>
          <Theme name={themeName}>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <StatusBar style={isDarkMode ? 'light' : 'dark'} />
              <Stack
                screenOptions={{
                  headerShown: false,
                  animation: 'slide_from_right',
                  gestureEnabled: true,
                  gestureDirection: 'horizontal',
                }}
              >
                <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="(operations)" options={{ headerShown: false }} />
                <Stack.Screen
                  name="document/[id]"
                  options={{
                    presentation: 'card',
                    animation: 'slide_from_right',
                  }}
                />
                <Stack.Screen
                  name="booking/[id]"
                  options={{
                    presentation: 'card',
                    animation: 'slide_from_bottom',
                  }}
                />
              </Stack>
            </GestureHandlerRootView>
          </Theme>
        </TamaguiProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  )
}
