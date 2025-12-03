import { Redirect } from 'expo-router'
import { useAuthStore } from '../src/store/authStore'

export default function Index() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const user = useAuthStore((state) => state.user)

  // Redirect to appropriate screen based on auth state and role
  if (isAuthenticated) {
    // Operations users get dedicated portal
    if (user?.role === 'operations') {
      return <Redirect href="/(operations)" />
    }
    return <Redirect href="/(tabs)" />
  }

  return <Redirect href="/(auth)/login" />
}
