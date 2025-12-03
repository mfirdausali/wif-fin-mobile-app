import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { BiometricAuthService, StoredCredentials, StoredUserData } from '../services/auth/biometricAuth'

export type UserRole = 'viewer' | 'accountant' | 'manager' | 'admin' | 'operations'

export interface User {
  id: string
  email: string
  username: string
  name: string
  role: UserRole
  companyId: string
  isActive: boolean
  createdAt: string
  lastLogin?: string
}

export interface AuthState {
  // State
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  biometricEnabled: boolean
  biometricType: 'face' | 'fingerprint' | 'iris' | 'none'

  // Actions
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void
  setBiometricEnabled: (enabled: boolean) => void
  setBiometricType: (type: 'face' | 'fingerprint' | 'iris' | 'none') => void
  login: (user: User) => Promise<void>
  logout: () => Promise<void>
  checkBiometricStatus: () => Promise<void>
  loginWithBiometric: () => Promise<{ success: boolean; error?: string }>
  enableBiometric: () => Promise<boolean>
  disableBiometric: () => Promise<void>

  // Permission helpers
  hasPermission: (permission: Permission) => boolean
}

export type Permission =
  | 'view_documents'
  | 'create_documents'
  | 'edit_documents'
  | 'delete_documents'
  | 'approve_documents'
  | 'print_documents'
  | 'manage_accounts'
  | 'manage_users'
  | 'view_audit_logs'
  | 'manage_settings'
  | 'view_bookings'
  | 'create_bookings'
  | 'edit_bookings'
  | 'delete_bookings'
  | 'print_bookings'

// Role permissions matrix (matching web app)
const rolePermissions: Record<UserRole, Permission[]> = {
  viewer: [
    'view_documents',
    'print_documents',
    'view_bookings',
    'print_bookings',
  ],
  accountant: [
    'view_documents',
    'create_documents',
    'edit_documents',
    'print_documents',
    'manage_accounts',
    'view_bookings',
    'create_bookings',
    'edit_bookings',
    'print_bookings',
  ],
  manager: [
    'view_documents',
    'create_documents',
    'edit_documents',
    'delete_documents',
    'approve_documents',
    'print_documents',
    'manage_accounts',
    'view_bookings',
    'create_bookings',
    'edit_bookings',
    'delete_bookings',
    'print_bookings',
  ],
  admin: [
    'view_documents',
    'create_documents',
    'edit_documents',
    'delete_documents',
    'approve_documents',
    'print_documents',
    'manage_accounts',
    'manage_users',
    'view_audit_logs',
    'manage_settings',
    'view_bookings',
    'create_bookings',
    'edit_bookings',
    'delete_bookings',
    'print_bookings',
  ],
  // Operations: Limited to Payment Vouchers and Bookings only
  operations: [
    'view_documents',     // Limited to PV only (enforced in UI)
    'create_documents',   // Limited to PV only (enforced in UI)
    'edit_documents',     // Limited to PV only (enforced in UI)
    'print_documents',
    'view_bookings',
    'create_bookings',
    'edit_bookings',
    'print_bookings',
  ],
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      isAuthenticated: false,
      isLoading: true,
      biometricEnabled: false,
      biometricType: 'none',

      // Actions
      setUser: (user) =>
        set({
          user,
          isAuthenticated: !!user,
        }),

      setLoading: (isLoading) => set({ isLoading }),

      setBiometricEnabled: (biometricEnabled) => set({ biometricEnabled }),

      setBiometricType: (biometricType) => set({ biometricType }),

      login: async (user) => {
        set({
          user,
          isAuthenticated: true,
          isLoading: false,
        })
      },

      logout: async () => {
        // Clear only tokens - keep biometric enabled setting and stored credentials
        // This allows user to log back in with biometric
        await BiometricAuthService.clearTokens()

        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
        })
      },

      checkBiometricStatus: async () => {
        const capabilities = await BiometricAuthService.checkCapabilities()
        const isEnabled = await BiometricAuthService.isBiometricEnabled()

        set({
          biometricEnabled: isEnabled,
          biometricType: capabilities.biometricType,
        })
      },

      loginWithBiometric: async (): Promise<{ success: boolean; error?: string }> => {
        const { biometricEnabled } = get()

        if (!biometricEnabled) {
          return { success: false, error: 'Biometric login is not enabled. Please sign in with your credentials first and enable biometric in Settings.' }
        }

        // Check if we have stored credentials before prompting biometric
        const hasStoredData = await BiometricAuthService.hasStoredUserData()
        if (!hasStoredData) {
          // Check legacy credentials
          const isEnabled = await BiometricAuthService.isBiometricEnabled()
          if (!isEnabled) {
            return { success: false, error: 'No stored credentials found. Please sign in with your credentials first.' }
          }
        }

        // Get stored user data with biometric authentication
        const userData = await BiometricAuthService.getStoredUserData()

        if (!userData) {
          // Fallback to old credentials format for backwards compatibility
          const credentials = await BiometricAuthService.getStoredCredentials()
          if (!credentials) {
            return { success: false, error: 'Authentication cancelled or failed. Please try again.' }
          }

          // Create user from legacy credentials
          const user: User = {
            id: credentials.userId,
            email: credentials.email,
            username: credentials.username,
            name: credentials.username,
            role: credentials.role as UserRole,
            companyId: '',
            isActive: true,
            createdAt: new Date().toISOString(),
            lastLogin: new Date().toISOString(),
          }

          set({
            user,
            isAuthenticated: true,
            isLoading: false,
          })

          return { success: true }
        }

        // Create user from full stored data
        const user: User = {
          id: userData.id,
          email: userData.email,
          username: userData.username,
          name: userData.name,
          role: userData.role as UserRole,
          companyId: userData.companyId,
          isActive: userData.isActive,
          createdAt: userData.createdAt,
          lastLogin: new Date().toISOString(),
        }

        set({
          user,
          isAuthenticated: true,
          isLoading: false,
        })

        return { success: true }
      },

      enableBiometric: async () => {
        const { user } = get()

        if (!user) {
          return false
        }

        // Store legacy credentials for backwards compatibility
        const credentials: StoredCredentials = {
          userId: user.id,
          email: user.email,
          username: user.username,
          role: user.role,
        }

        const result = await BiometricAuthService.enableBiometric(credentials)

        if (result.success) {
          // Also store full user data for complete login
          const userData: StoredUserData = {
            id: user.id,
            email: user.email,
            username: user.username,
            name: user.name,
            role: user.role,
            companyId: user.companyId,
            isActive: user.isActive,
            createdAt: user.createdAt,
            lastLogin: user.lastLogin,
          }
          await BiometricAuthService.storeUserData(userData)

          set({ biometricEnabled: true })
          return true
        }

        return false
      },

      disableBiometric: async () => {
        await BiometricAuthService.disableBiometric()
        // Note: disableBiometric in BiometricAuthService already clears credentials
        // User data will be cleared on next clearAll() call
        set({ biometricEnabled: false })
      },

      // Permission helper
      hasPermission: (permission) => {
        const { user } = get()

        if (!user) {
          return false
        }

        const permissions = rolePermissions[user.role] || []
        return permissions.includes(permission)
      },
    }),
    {
      name: 'wif-auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        biometricEnabled: state.biometricEnabled,
      }),
    }
  )
)

// Selectors for better performance
export const useUser = () => useAuthStore((state) => state.user)
export const useIsAuthenticated = () => useAuthStore((state) => state.isAuthenticated)
export const useIsLoading = () => useAuthStore((state) => state.isLoading)
export const useBiometricEnabled = () => useAuthStore((state) => state.biometricEnabled)
export const useBiometricType = () => useAuthStore((state) => state.biometricType)
export const useHasPermission = (permission: Permission) =>
  useAuthStore((state) => state.hasPermission(permission))
