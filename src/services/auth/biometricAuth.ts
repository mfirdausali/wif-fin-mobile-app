import * as LocalAuthentication from 'expo-local-authentication'
import * as SecureStore from 'expo-secure-store'
import * as Haptics from 'expo-haptics'

// Keys for secure storage
const BIOMETRIC_ENABLED_KEY = 'biometric_enabled'
const USER_CREDENTIALS_KEY = 'user_credentials'
const USER_DATA_KEY = 'user_data'
const AUTH_TOKEN_KEY = 'auth_token'
const REFRESH_TOKEN_KEY = 'refresh_token'

export interface BiometricCapabilities {
  hasHardware: boolean
  isEnrolled: boolean
  supportedTypes: LocalAuthentication.AuthenticationType[]
  biometricType: 'face' | 'fingerprint' | 'iris' | 'none'
}

export interface AuthResult {
  success: boolean
  error?: string
  errorCode?: string
}

export interface StoredCredentials {
  userId: string
  email: string
  username: string
  role: string
}

// Full user data for biometric login
export interface StoredUserData {
  id: string
  email: string
  username: string
  name: string
  role: string
  companyId: string
  isActive: boolean
  createdAt: string
  lastLogin?: string
}

/**
 * BiometricAuth Service
 * Handles Face ID / Touch ID authentication and secure credential storage
 */
export class BiometricAuthService {
  /**
   * Check device biometric capabilities
   */
  static async checkCapabilities(): Promise<BiometricCapabilities> {
    const hasHardware = await LocalAuthentication.hasHardwareAsync()
    const isEnrolled = await LocalAuthentication.isEnrolledAsync()
    const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync()

    let biometricType: BiometricCapabilities['biometricType'] = 'none'

    if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      biometricType = 'face'
    } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      biometricType = 'fingerprint'
    } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.IRIS)) {
      biometricType = 'iris'
    }

    return {
      hasHardware,
      isEnrolled,
      supportedTypes,
      biometricType,
    }
  }

  /**
   * Check if biometric authentication is available
   */
  static async isAvailable(): Promise<boolean> {
    const capabilities = await this.checkCapabilities()
    return capabilities.hasHardware && capabilities.isEnrolled
  }

  /**
   * Check if user has enabled biometric login
   */
  static async isBiometricEnabled(): Promise<boolean> {
    const enabled = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY)
    return enabled === 'true'
  }

  /**
   * Enable biometric authentication for user
   */
  static async enableBiometric(credentials: StoredCredentials): Promise<AuthResult> {
    try {
      // Verify biometric first
      const authResult = await this.authenticate('Enable biometric login')

      if (!authResult.success) {
        return authResult
      }

      // Store credentials securely
      await SecureStore.setItemAsync(
        USER_CREDENTIALS_KEY,
        JSON.stringify(credentials),
        {
          keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
        }
      )

      // Mark biometric as enabled
      await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, 'true')

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to enable biometric',
      }
    }
  }

  /**
   * Disable biometric authentication
   */
  static async disableBiometric(): Promise<void> {
    await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY)
    await SecureStore.deleteItemAsync(USER_CREDENTIALS_KEY)
    await SecureStore.deleteItemAsync(USER_DATA_KEY)
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  }

  /**
   * Authenticate user with biometrics
   */
  static async authenticate(
    promptMessage: string = 'Authenticate to continue'
  ): Promise<AuthResult> {
    try {
      const capabilities = await this.checkCapabilities()

      if (!capabilities.hasHardware) {
        return {
          success: false,
          error: 'This device does not support biometric authentication',
          errorCode: 'NOT_AVAILABLE',
        }
      }

      if (!capabilities.isEnrolled) {
        return {
          success: false,
          error: `No ${capabilities.biometricType === 'face' ? 'Face ID' : 'Touch ID'} enrolled. Please set it up in your device Settings.`,
          errorCode: 'NOT_ENROLLED',
        }
      }

      // Request biometric-only authentication (no passcode fallback)
      // This ensures Face ID/Touch ID is shown, not passcode
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage,
        cancelLabel: 'Cancel',
        disableDeviceFallback: true, // Force biometric only, no passcode fallback
      })

      if (result.success) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        return { success: true }
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)

      // Handle different error types
      let errorMessage = 'Authentication failed'
      let errorCode = 'UNKNOWN'

      if ('error' in result) {
        switch (result.error) {
          case 'user_cancel':
            errorMessage = 'Authentication cancelled'
            errorCode = 'USER_CANCELLED'
            break
          case 'user_fallback':
            errorMessage = 'User chose passcode'
            errorCode = 'USER_FALLBACK'
            break
          case 'system_cancel':
            errorMessage = 'System cancelled authentication'
            errorCode = 'SYSTEM_CANCEL'
            break
          case 'not_enrolled':
            errorMessage = 'No biometrics enrolled'
            errorCode = 'NOT_ENROLLED'
            break
          case 'lockout':
            errorMessage = 'Too many failed attempts. Try again later.'
            errorCode = 'LOCKOUT'
            break
          default:
            errorMessage = result.error || 'Authentication failed'
        }
      }

      return {
        success: false,
        error: errorMessage,
        errorCode,
      }
    } catch (error) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication error',
        errorCode: 'EXCEPTION',
      }
    }
  }

  /**
   * Get stored credentials after biometric authentication
   */
  static async getStoredCredentials(): Promise<StoredCredentials | null> {
    try {
      const authResult = await this.authenticate('Sign in to WIF Finance')

      if (!authResult.success) {
        return null
      }

      const credentialsJson = await SecureStore.getItemAsync(USER_CREDENTIALS_KEY)

      if (!credentialsJson) {
        return null
      }

      return JSON.parse(credentialsJson) as StoredCredentials
    } catch {
      return null
    }
  }

  /**
   * Store full user data for biometric login
   */
  static async storeUserData(userData: StoredUserData): Promise<void> {
    await SecureStore.setItemAsync(
      USER_DATA_KEY,
      JSON.stringify(userData),
      {
        keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
      }
    )
  }

  /**
   * Get stored user data after biometric authentication
   */
  static async getStoredUserData(): Promise<StoredUserData | null> {
    try {
      const authResult = await this.authenticate('Sign in to WIF Finance')

      if (!authResult.success) {
        return null
      }

      const userDataJson = await SecureStore.getItemAsync(USER_DATA_KEY)

      if (!userDataJson) {
        return null
      }

      return JSON.parse(userDataJson) as StoredUserData
    } catch {
      return null
    }
  }

  /**
   * Check if user data is stored (without authentication)
   */
  static async hasStoredUserData(): Promise<boolean> {
    try {
      const userDataJson = await SecureStore.getItemAsync(USER_DATA_KEY)
      return userDataJson !== null
    } catch {
      return false
    }
  }

  /**
   * Store authentication token securely
   */
  static async storeAuthToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    })
  }

  /**
   * Get stored authentication token
   */
  static async getAuthToken(): Promise<string | null> {
    return SecureStore.getItemAsync(AUTH_TOKEN_KEY)
  }

  /**
   * Store refresh token securely
   */
  static async storeRefreshToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    })
  }

  /**
   * Get stored refresh token
   */
  static async getRefreshToken(): Promise<string | null> {
    return SecureStore.getItemAsync(REFRESH_TOKEN_KEY)
  }

  /**
   * Clear tokens only (for logout) - KEEPS biometric enabled setting and credentials
   * User can still use biometric to log back in
   */
  static async clearTokens(): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(AUTH_TOKEN_KEY),
      SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    ])
  }

  /**
   * Clear all stored authentication data (full reset)
   */
  static async clearAll(): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY),
      SecureStore.deleteItemAsync(USER_CREDENTIALS_KEY),
      SecureStore.deleteItemAsync(USER_DATA_KEY),
      SecureStore.deleteItemAsync(AUTH_TOKEN_KEY),
      SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    ])
  }

  /**
   * Get friendly name for the biometric type
   */
  static async getBiometricTypeName(): Promise<string> {
    const capabilities = await this.checkCapabilities()

    switch (capabilities.biometricType) {
      case 'face':
        return 'Face ID'
      case 'fingerprint':
        return 'Touch ID'
      case 'iris':
        return 'Iris Scan'
      default:
        return 'Biometric'
    }
  }
}

export default BiometricAuthService
