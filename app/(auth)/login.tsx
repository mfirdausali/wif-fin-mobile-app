import { useState, useEffect, useMemo, useRef } from 'react'
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  View,
  Text,
  ScrollView,
  Animated,
  Pressable,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { Wifi, WifiOff, Eye, EyeOff } from '@tamagui/lucide-icons'
import * as Haptics from 'expo-haptics'
import Svg, { Path, Circle } from 'react-native-svg'
import {
  useFonts,
  CormorantGaramond_400Regular,
  CormorantGaramond_500Medium,
  CormorantGaramond_600SemiBold,
} from '@expo-google-fonts/cormorant-garamond'

import { useAuthStore } from '../../src/store/authStore'
import { useThemeStore } from '../../src/store/themeStore'
import { BiometricAuthService } from '../../src/services/auth/biometricAuth'
import {
  login as authLogin,
  testConnection,
} from '../../src/services/auth/authService'
import { JAPANESE_THEME } from '../../src/constants/theme'

// Face ID Icon Component
function FaceIDIcon({ color, size = 24 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Face outline corners */}
      <Path
        d="M7 3H5C3.89543 3 3 3.89543 3 5V7"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Path
        d="M17 3H19C20.1046 3 21 3.89543 21 5V7"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Path
        d="M7 21H5C3.89543 21 3 20.1046 3 19V17"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Path
        d="M17 21H19C20.1046 21 21 20.1046 21 19V17"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
      {/* Eyes */}
      <Circle cx="9" cy="10" r="1" fill={color} />
      <Circle cx="15" cy="10" r="1" fill={color} />
      {/* Nose */}
      <Path
        d="M12 10V13"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      {/* Mouth */}
      <Path
        d="M9 16C9 16 10.5 17 12 17C13.5 17 15 16 15 16"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </Svg>
  )
}

// Touch ID Icon Component
function TouchIDIcon({ color, size = 24 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"
        stroke={color}
        strokeWidth={1.5}
        fill="none"
      />
      <Path
        d="M12 6c-3.31 0-6 2.69-6 6s2.69 6 6 6"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M12 9c-1.66 0-3 1.34-3 3s1.34 3 3 3"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        fill="none"
      />
      <Circle cx="12" cy="12" r="1" fill={color} />
    </Svg>
  )
}

export default function LoginScreen() {
  const router = useRouter()
  const isDark = useThemeStore((state) => state.isDarkMode)
  const theme = isDark ? JAPANESE_THEME.dark : JAPANESE_THEME.light

  // Load Cormorant Garamond font
  const [fontsLoaded] = useFonts({
    CormorantGaramond_400Regular,
    CormorantGaramond_500Medium,
    CormorantGaramond_600SemiBold,
  })

  const [usernameOrEmail, setUsernameOrEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [biometricAvailable, setBiometricAvailable] = useState(false)
  const [biometricType, setBiometricType] = useState<'face' | 'fingerprint' | 'none'>('none')
  const [connectionStatus, setConnectionStatus] = useState<
    'checking' | 'connected' | 'error'
  >('checking')

  const {
    biometricEnabled,
    loginWithBiometric,
    login,
    checkBiometricStatus,
  } = useAuthStore()

  // Dynamic styles based on theme
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: theme.background,
        },
        scrollContent: {
          flexGrow: 1,
          justifyContent: 'center',
          paddingHorizontal: 32,
          paddingVertical: 48,
        },
        logoContainer: {
          alignItems: 'center',
          marginBottom: 48,
        },
        logoCircle: {
          width: 80,
          height: 80,
          borderRadius: 40,
          overflow: 'hidden',
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: 24,
          // Shadow
          shadowColor: isDark ? '#C9A962' : '#1A1815',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.2,
          shadowRadius: 32,
          elevation: 8,
        },
        logoGradient: {
          width: 80,
          height: 80,
          borderRadius: 40,
          justifyContent: 'center',
          alignItems: 'center',
        },
        logoText: {
          fontSize: 28,
          color: theme.logoText,
          fontFamily: fontsLoaded ? 'CormorantGaramond_500Medium' : (Platform.OS === 'ios' ? 'Georgia' : 'serif'),
          letterSpacing: 1,
        },
        brandName: {
          fontSize: 28,
          color: theme.text,
          letterSpacing: -0.5,
          marginBottom: 8,
          fontFamily: fontsLoaded ? 'CormorantGaramond_500Medium' : (Platform.OS === 'ios' ? 'Georgia' : 'serif'),
        },
        tagline: {
          fontSize: 13,
          fontWeight: '400',
          color: theme.textMuted,
          letterSpacing: 2,
          textTransform: 'uppercase',
        },
        formContainer: {
          width: '100%',
          maxWidth: 400,
          alignSelf: 'center',
          gap: 20,
        },
        inputContainer: {
          width: '100%',
        },
        inputLabel: {
          fontSize: 12,
          fontWeight: '500',
          color: theme.textSecondary,
          letterSpacing: 1,
          textTransform: 'uppercase',
          marginBottom: 8,
        },
        input: {
          height: 52,
          borderWidth: 1,
          borderColor: theme.inputBorder,
          borderRadius: 8,
          paddingHorizontal: 16,
          fontSize: 16,
          color: theme.text,
          backgroundColor: theme.inputBackground,
        },
        inputFocused: {
          borderColor: theme.borderFocus,
          backgroundColor: theme.inputBackgroundFocus,
          // Gold glow effect using shadow
          shadowColor: '#B8963F',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.15,
          shadowRadius: 3,
          elevation: 0,
        },
        inputFilled: {
          backgroundColor: theme.inputBackgroundFocus,
        },
        inputError: {
          borderColor: theme.error,
        },
        passwordContainer: {
          position: 'relative',
        },
        passwordInput: {
          paddingRight: 52,
        },
        eyeButton: {
          position: 'absolute',
          right: 16,
          top: 14,
          padding: 4,
        },
        errorText: {
          fontSize: 13,
          color: theme.error,
          textAlign: 'center',
          marginTop: 4,
        },
        signInButton: {
          height: 56,
          borderRadius: 12,
          justifyContent: 'center',
          alignItems: 'center',
          marginTop: 8,
          // Shadow - matches HTML: 0 4px 16px rgba()
          shadowColor: isDark ? '#C9A962' : '#1A1815',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: isDark ? 0.25 : 0.2,
          shadowRadius: 16,
          elevation: 8,
        },
        signInButtonInner: {
          width: '100%',
          height: 56,
          borderRadius: 12,
          overflow: 'hidden',
        },
        signInButtonGradient: {
          flex: 1,
          width: '100%',
          justifyContent: 'center',
          alignItems: 'center',
          paddingVertical: 18,
        },
        signInButtonDisabled: {
          opacity: 0.6,
        },
        signInButtonText: {
          fontSize: 14,
          fontWeight: '600',
          color: theme.buttonText,
          letterSpacing: 1.2,
          textTransform: 'uppercase',
        },
        dividerContainer: {
          flexDirection: 'row',
          alignItems: 'center',
          marginVertical: 24,
        },
        dividerLine: {
          flex: 1,
          height: 1,
          backgroundColor: theme.border,
        },
        dividerText: {
          fontSize: 12,
          color: theme.textMuted,
          paddingHorizontal: 16,
          letterSpacing: 1,
        },
        biometricButton: {
          height: 52,
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: 8,
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 12,
          backgroundColor: 'transparent',
        },
        biometricButtonText: {
          fontSize: 15,
          fontWeight: '500',
          color: theme.text,
          letterSpacing: 0.5,
        },
        forgotPassword: {
          alignItems: 'center',
          marginTop: 24,
        },
        forgotPasswordText: {
          fontSize: 14,
          color: theme.textSecondary,
        },
        footer: {
          alignItems: 'center',
          marginTop: 48,
          gap: 8,
        },
        footerLocations: {
          fontSize: 12,
          color: theme.textMuted,
          letterSpacing: 4,
        },
        footerVersion: {
          fontSize: 11,
          color: theme.textMuted,
          opacity: 0.6,
        },
        connectionStatus: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          marginTop: 8,
        },
        connectionText: {
          fontSize: 11,
          color: theme.textMuted,
        },
        connectionError: {
          backgroundColor: isDark ? '#2D1F1F' : '#FFF5F5',
          borderRadius: 8,
          padding: 16,
          marginBottom: 24,
          borderWidth: 1,
          borderColor: isDark ? '#4A2D2D' : '#FECACA',
        },
        connectionErrorText: {
          fontSize: 14,
          color: theme.error,
          textAlign: 'center',
        },
        retryButton: {
          marginTop: 12,
          alignSelf: 'center',
          paddingVertical: 8,
          paddingHorizontal: 16,
        },
        retryButtonText: {
          fontSize: 14,
          color: theme.gold,
          fontWeight: '500',
        },
      }),
    [theme, isDark, fontsLoaded]
  )

  useEffect(() => {
    checkBiometricAvailability()
    checkSupabaseConnection()
  }, [])

  const checkSupabaseConnection = async () => {
    setConnectionStatus('checking')
    const result = await testConnection()
    setConnectionStatus(result.success ? 'connected' : 'error')

    if (!result.success) {
      console.log('Connection test failed:', result.message)
    }
  }

  const checkBiometricAvailability = async () => {
    const isAvailable = await BiometricAuthService.isAvailable()
    const capabilities = await BiometricAuthService.checkCapabilities()
    setBiometricAvailable(isAvailable)
    setBiometricType(capabilities.biometricType === 'iris' ? 'face' : capabilities.biometricType)
    await checkBiometricStatus()

    // Get fresh biometric enabled status from store (not stale closure value)
    const isBiometricEnabled = useAuthStore.getState().biometricEnabled

    // Auto-prompt biometric if enabled
    if (isAvailable && isBiometricEnabled) {
      handleBiometricLogin()
    }
  }

  const handleBiometricLogin = async () => {
    setIsLoading(true)
    setError('')

    try {
      const result = await loginWithBiometric()

      if (result.success) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        // Route based on user role - operations users go to dedicated interface
        const currentUser = useAuthStore.getState().user
        if (currentUser?.role === 'operations') {
          router.replace('/(operations)')
        } else {
          router.replace('/(tabs)')
        }
      } else {
        setError(result.error || 'Biometric authentication failed. Please use credentials.')
      }
    } catch (err) {
      setError('Authentication error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleEmailLogin = async () => {
    Keyboard.dismiss()

    if (!usernameOrEmail.trim()) {
      setError('Please enter your username or email')
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
      return
    }

    if (!password) {
      setError('Please enter your password')
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const response = await authLogin({
        usernameOrEmail: usernameOrEmail.trim(),
        password,
      })

      if (response.success && response.user) {
        const storeUser = {
          id: response.user.id,
          email: response.user.email,
          username: response.user.username,
          name: response.user.fullName,
          role: response.user.role,
          companyId: response.user.companyId,
          isActive: response.user.isActive,
          createdAt: response.user.createdAt,
          lastLogin: response.user.lastLogin,
        }

        await login(storeUser)
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        // Route based on user role - operations users go to dedicated interface
        if (storeUser.role === 'operations') {
          router.replace('/(operations)')
        } else {
          router.replace('/(tabs)')
        }
      } else {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        setError(response.error || 'Invalid username or password')
      }
    } catch (err: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      setError(err.message || 'An error occurred during login')
    } finally {
      setIsLoading(false)
    }
  }

  const [emailFocused, setEmailFocused] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)

  // Animation for Sign In button press
  const buttonScale = useRef(new Animated.Value(1)).current
  const buttonTranslateY = useRef(new Animated.Value(0)).current

  // Press lifts button up (like HTML hover: translateY(-2px))
  const handlePressIn = () => {
    Animated.parallel([
      Animated.spring(buttonScale, {
        toValue: 1.02,
        useNativeDriver: true,
      }),
      Animated.spring(buttonTranslateY, {
        toValue: -2,
        useNativeDriver: true,
      }),
    ]).start()
  }

  const handlePressOut = () => {
    Animated.parallel([
      Animated.spring(buttonScale, {
        toValue: 1,
        friction: 4,
        tension: 50,
        useNativeDriver: true,
      }),
      Animated.spring(buttonTranslateY, {
        toValue: 0,
        friction: 4,
        tension: 50,
        useNativeDriver: true,
      }),
    ]).start()
  }

  const getBiometricName = () => {
    return biometricType === 'face' ? 'Face ID' : 'Touch ID'
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo Section */}
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <LinearGradient
              colors={[theme.logoGradientStart, theme.logoGradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.logoGradient}
            >
              <Text style={styles.logoText}>和</Text>
            </LinearGradient>
          </View>
          <Text style={styles.brandName}>WIF Japan</Text>
          <Text style={styles.tagline}>Finance Department</Text>
        </View>

        {/* Connection Error */}
        {connectionStatus === 'error' && (
          <View style={styles.connectionError}>
            <Text style={styles.connectionErrorText}>
              Unable to connect to server
            </Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={checkSupabaseConnection}
            >
              <Text style={styles.retryButtonText}>Retry Connection</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Login Form */}
        <View style={styles.formContainer}>
          {/* Username/Email Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Username or Email</Text>
            <TextInput
              style={[
                styles.input,
                usernameOrEmail && styles.inputFilled,
                emailFocused && styles.inputFocused,
                error && !usernameOrEmail && styles.inputError,
              ]}
              value={usernameOrEmail}
              onChangeText={(text) => {
                setUsernameOrEmail(text)
                setError('')
              }}
              placeholder="🇲🇾🤝🇯🇵@wifjapan.com"
              placeholderTextColor={theme.placeholder}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              onFocus={() => setEmailFocused(true)}
              onBlur={() => setEmailFocused(false)}
              editable={!isLoading}
            />
          </View>

          {/* Password Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={[
                  styles.input,
                  styles.passwordInput,
                  password && styles.inputFilled,
                  passwordFocused && styles.inputFocused,
                  error && !password && styles.inputError,
                ]}
                value={password}
                onChangeText={(text) => {
                  setPassword(text)
                  setError('')
                }}
                placeholder="Enter your password"
                placeholderTextColor={theme.placeholder}
                secureTextEntry={!showPassword}
                autoComplete="password"
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                editable={!isLoading}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff size={22} color={theme.textMuted} />
                ) : (
                  <Eye size={22} color={theme.textMuted} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Error Message */}
          {error && <Text style={styles.errorText}>{error}</Text>}

          {/* Sign In Button */}
          <Animated.View
            style={[
              styles.signInButton,
              (isLoading || connectionStatus === 'error') &&
                styles.signInButtonDisabled,
              {
                transform: [
                  { scale: buttonScale },
                  { translateY: buttonTranslateY },
                ],
              },
            ]}
          >
            <Pressable
              onPress={handleEmailLogin}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              disabled={isLoading || connectionStatus === 'error'}
              style={styles.signInButtonInner}
            >
              <LinearGradient
                colors={[theme.buttonGradientStart, theme.buttonGradientEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.signInButtonGradient}
              >
                {isLoading ? (
                  <ActivityIndicator color={theme.buttonText} />
                ) : (
                  <Text style={styles.signInButtonText}>Sign In</Text>
                )}
              </LinearGradient>
            </Pressable>
          </Animated.View>

          {/* Biometric Login */}
          {biometricAvailable && biometricEnabled && (
            <>
              <View style={styles.dividerContainer}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
              </View>

              <TouchableOpacity
                style={styles.biometricButton}
                onPress={handleBiometricLogin}
                disabled={isLoading}
                activeOpacity={0.7}
              >
                {biometricType === 'face' ? (
                  <FaceIDIcon color={theme.text} size={22} />
                ) : (
                  <TouchIDIcon color={theme.text} size={22} />
                )}
                <Text style={styles.biometricButtonText}>
                  Sign in with {getBiometricName()}
                </Text>
              </TouchableOpacity>
            </>
          )}

          {/* Forgot Password */}
          <TouchableOpacity
            style={styles.forgotPassword}
            onPress={() => {
              Alert.alert(
                'Reset Password',
                'Please contact your administrator to reset your password.',
                [{ text: 'OK' }]
              )
            }}
          >
            <Text style={styles.forgotPasswordText}>Forgot password?</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerLocations}>KUALA LUMPUR · TOKYO</Text>
          <View style={styles.connectionStatus}>
            {connectionStatus === 'connected' && (
              <Wifi size={12} color={theme.success} />
            )}
            {connectionStatus === 'error' && (
              <WifiOff size={12} color={theme.error} />
            )}
            <Text style={styles.connectionText}>
              {connectionStatus === 'connected'
                ? 'Connected'
                : connectionStatus === 'error'
                ? 'Offline'
                : 'Checking...'}
            </Text>
          </View>
          <Text style={styles.footerVersion}>Version 1.0.0</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
