import { useState, useEffect } from 'react'
import { Alert, Linking, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import {
  YStack,
  XStack,
  Text,
  ScrollView,
  Switch,
} from 'tamagui'
import {
  User,
  Bell,
  Fingerprint,
  Moon,
  Globe,
  Shield,
  HelpCircle,
  LogOut,
  ChevronRight,
  Building,
  Lock,
  Info,
  FileText,
} from '@tamagui/lucide-icons'
import * as Haptics from 'expo-haptics'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useAuthStore } from '../../src/store/authStore'
import { useThemeStore } from '../../src/store/themeStore'
import { BiometricAuthService } from '../../src/services/auth/biometricAuth'
import { BRAND, getAppTheme } from '../../src/constants/theme'

// iOS Settings icon colors
const ICON_COLORS = {
  gray: '#8E8E93',
  blue: '#007AFF',
  green: '#34C759',
  orange: '#FF9500',
  red: '#FF3B30',
  purple: '#AF52DE',
  teal: '#5AC8FA',
  indigo: '#5856D6',
  navy: BRAND.navy,
}

/**
 * iOS-style settings icon with solid colored rounded square background
 */
interface SettingsIconProps {
  icon: any
  color: string
}

function SettingsIcon({ icon: Icon, color }: SettingsIconProps) {
  return (
    <YStack
      width={29}
      height={29}
      borderRadius={6}
      backgroundColor={color}
      justifyContent="center"
      alignItems="center"
    >
      <Icon size={17} color="#FFFFFF" />
    </YStack>
  )
}

/**
 * iOS-style settings row
 */
interface SettingsRowProps {
  icon: any
  iconColor: string
  title: string
  value?: string
  onPress?: () => void
  rightElement?: React.ReactNode
  isFirst?: boolean
  isLast?: boolean
  destructive?: boolean
}

function SettingsRow({
  icon,
  iconColor,
  title,
  value,
  onPress,
  rightElement,
  isFirst = false,
  isLast = false,
  destructive = false,
}: SettingsRowProps) {
  return (
    <YStack>
      <XStack
        paddingVertical={11}
        paddingLeft={16}
        paddingRight={16}
        alignItems="center"
        gap={15}
        backgroundColor="$background"
        pressStyle={onPress ? { opacity: 0.7 } : undefined}
        onPress={onPress}
        borderTopLeftRadius={isFirst ? 10 : 0}
        borderTopRightRadius={isFirst ? 10 : 0}
        borderBottomLeftRadius={isLast ? 10 : 0}
        borderBottomRightRadius={isLast ? 10 : 0}
      >
        <SettingsIcon icon={icon} color={iconColor} />

        <XStack flex={1} alignItems="center" justifyContent="space-between">
          <Text
            fontSize={17}
            color={destructive ? ICON_COLORS.red : '$color'}
          >
            {title}
          </Text>

          <XStack alignItems="center" gap={6}>
            {value && (
              <Text fontSize={17} color="$colorHover" opacity={0.6}>
                {value}
              </Text>
            )}
            {rightElement}
            {onPress && !rightElement && (
              <ChevronRight size={14} color="$colorHover" opacity={0.3} strokeWidth={3} />
            )}
          </XStack>
        </XStack>
      </XStack>

      {/* Separator - inset to align with text */}
      {!isLast && (
        <YStack backgroundColor="$background" paddingLeft={60}>
          <YStack height={0.5} backgroundColor="$borderColor" />
        </YStack>
      )}
    </YStack>
  )
}

/**
 * iOS-style section header
 */
interface SectionHeaderProps {
  title: string
}

function SectionHeader({ title }: SectionHeaderProps) {
  return (
    <Text
      fontSize={13}
      color="$colorHover"
      opacity={0.6}
      paddingHorizontal={16}
      paddingBottom={8}
      paddingTop={24}
      textTransform="uppercase"
    >
      {title}
    </Text>
  )
}

/**
 * iOS-style grouped section container
 */
interface SectionContainerProps {
  children: React.ReactNode
}

function SectionContainer({ children }: SectionContainerProps) {
  return (
    <YStack
      marginHorizontal={16}
      borderRadius={10}
      overflow="hidden"
    >
      {children}
    </YStack>
  )
}

/**
 * iOS-style profile row (larger, like Apple ID section)
 */
interface ProfileRowProps {
  name: string
  email: string
  role: string
  onPress?: () => void
}

function ProfileRow({ name, email, role, onPress }: ProfileRowProps) {
  return (
    <XStack
      paddingVertical={10}
      paddingHorizontal={16}
      alignItems="center"
      gap={15}
      backgroundColor="$background"
      borderRadius={10}
      marginHorizontal={16}
      pressStyle={onPress ? { opacity: 0.7 } : undefined}
      onPress={onPress}
    >
      {/* Avatar */}
      <YStack
        width={60}
        height={60}
        borderRadius={30}
        backgroundColor={BRAND.navy}
        justifyContent="center"
        alignItems="center"
      >
        <Text fontSize={26} fontWeight="400" color="#FFFFFF">
          {name?.charAt(0)?.toUpperCase() || 'U'}
        </Text>
      </YStack>

      {/* Name and details */}
      <YStack flex={1} gap={2}>
        <Text fontSize={20} color="$color">
          {name || 'User'}
        </Text>
        <Text fontSize={14} color="$colorHover" opacity={0.6}>
          {email || 'user@example.com'}
        </Text>
        <Text
          fontSize={12}
          color={BRAND.navy}
          fontWeight="500"
          textTransform="capitalize"
          marginTop={2}
        >
          {role || 'User'}
        </Text>
      </YStack>

      <ChevronRight size={14} color="$colorHover" opacity={0.3} strokeWidth={3} />
    </XStack>
  )
}

export default function SettingsScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const {
    user,
    biometricEnabled,
    biometricType,
    logout,
    enableBiometric,
    disableBiometric,
    checkBiometricStatus,
  } = useAuthStore()

  const { isDarkMode, toggleDarkMode } = useThemeStore()
  const theme = getAppTheme(isDarkMode)

  const [biometricAvailable, setBiometricAvailable] = useState(false)
  const [biometricName, setBiometricName] = useState('Biometric')
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)

  useEffect(() => {
    checkBiometricAvailability()
  }, [])

  const checkBiometricAvailability = async () => {
    const isAvailable = await BiometricAuthService.isAvailable()
    const name = await BiometricAuthService.getBiometricTypeName()
    setBiometricAvailable(isAvailable)
    setBiometricName(name)
    await checkBiometricStatus()
  }

  const handleBiometricToggle = async (enabled: boolean) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    if (enabled) {
      const success = await enableBiometric()
      if (!success) {
        Alert.alert('Error', 'Failed to enable biometric authentication')
      }
    } else {
      Alert.alert(
        'Disable Biometric',
        `Are you sure you want to disable ${biometricName} login?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Disable',
            style: 'destructive',
            onPress: async () => {
              await disableBiometric()
            },
          },
        ]
      )
    }
  }

  const handleNotificationsToggle = async (enabled: boolean) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setNotificationsEnabled(enabled)
  }

  const handleDarkModeToggle = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    toggleDarkMode()
  }

  const handleLogout = async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)

    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await logout()
            router.replace('/(auth)/login')
          },
        },
      ]
    )
  }

  const handleSupport = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    Linking.openURL('mailto:support@wiffinance.com')
  }

  const handlePrivacyPolicy = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    Linking.openURL('https://wiffinance.com/privacy')
  }

  return (
    <ScrollView
      flex={1}
      backgroundColor={theme.bgSecondary}
      contentContainerStyle={{
        paddingTop: insets.top + 8,
        paddingBottom: insets.bottom + 100,
      }}
    >
      {/* iOS Large Title Header */}
      <YStack paddingHorizontal={16} paddingVertical={8} marginBottom={8}>
        <Text fontSize={34} fontWeight="700" color={theme.textPrimary}>
          Settings
        </Text>
      </YStack>

      {/* Profile Section - like Apple ID */}
      <ProfileRow
        name={user?.name || 'User'}
        email={user?.email || 'user@example.com'}
        role={user?.role || 'User'}
        onPress={() => {}}
      />

      {/* Security Section */}
      <SectionHeader title="Security" />
      <SectionContainer>
        {biometricAvailable && (
          <SettingsRow
            icon={Fingerprint}
            iconColor={ICON_COLORS.green}
            title={biometricName}
            isFirst={true}
            isLast={false}
            rightElement={
              <Switch
                checked={biometricEnabled}
                onCheckedChange={handleBiometricToggle}
                backgroundColor={biometricEnabled ? ICON_COLORS.green : '#E9E9EB'}
                native
              />
            }
          />
        )}
        <SettingsRow
          icon={Lock}
          iconColor={ICON_COLORS.gray}
          title="Change Password"
          isFirst={!biometricAvailable}
          isLast={true}
          onPress={() => {}}
        />
      </SectionContainer>

      {/* Preferences Section */}
      <SectionHeader title="Preferences" />
      <SectionContainer>
        <SettingsRow
          icon={Bell}
          iconColor={ICON_COLORS.red}
          title="Notifications"
          isFirst={true}
          rightElement={
            <Switch
              checked={notificationsEnabled}
              onCheckedChange={handleNotificationsToggle}
              backgroundColor={notificationsEnabled ? ICON_COLORS.green : '#E9E9EB'}
              native
            />
          }
        />
        <SettingsRow
          icon={Moon}
          iconColor={ICON_COLORS.indigo}
          title="Dark Mode"
          rightElement={
            <Switch
              checked={isDarkMode}
              onCheckedChange={handleDarkModeToggle}
              backgroundColor={isDarkMode ? ICON_COLORS.green : '#E9E9EB'}
              native
            />
          }
        />
        <SettingsRow
          icon={Globe}
          iconColor={ICON_COLORS.blue}
          title="Language"
          value="English"
          isLast={true}
          onPress={() => {}}
        />
      </SectionContainer>

      {/* Company Section */}
      <SectionHeader title="Company" />
      <SectionContainer>
        <SettingsRow
          icon={Building}
          iconColor={ICON_COLORS.navy}
          title="Company Settings"
          value="WIF JAPAN"
          isFirst={true}
          isLast={true}
          onPress={async () => {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            router.push('/settings/company')
          }}
        />
      </SectionContainer>

      {/* Support Section */}
      <SectionHeader title="Support" />
      <SectionContainer>
        <SettingsRow
          icon={HelpCircle}
          iconColor={ICON_COLORS.blue}
          title="Help & Support"
          isFirst={true}
          onPress={handleSupport}
        />
        <SettingsRow
          icon={FileText}
          iconColor={ICON_COLORS.gray}
          title="Terms of Service"
          onPress={() => Linking.openURL('https://wiffinance.com/terms')}
        />
        <SettingsRow
          icon={Shield}
          iconColor={ICON_COLORS.gray}
          title="Privacy Policy"
          isLast={true}
          onPress={handlePrivacyPolicy}
        />
      </SectionContainer>

      {/* About Section */}
      <SectionHeader title="About" />
      <SectionContainer>
        <SettingsRow
          icon={Info}
          iconColor={ICON_COLORS.gray}
          title="Version"
          value="1.0.0"
          isFirst={true}
          isLast={true}
        />
      </SectionContainer>

      {/* Sign Out Section */}
      <YStack marginTop={24}>
        <SectionContainer>
          <XStack
            paddingVertical={11}
            paddingHorizontal={16}
            alignItems="center"
            justifyContent="center"
            backgroundColor="$background"
            borderRadius={10}
            pressStyle={{ opacity: 0.7 }}
            onPress={handleLogout}
          >
            <Text fontSize={17} color={ICON_COLORS.red}>
              Sign Out
            </Text>
          </XStack>
        </SectionContainer>
      </YStack>

      {/* Footer */}
      <YStack alignItems="center" marginTop={32} gap={4}>
        <Text fontSize={13} color="$colorHover" opacity={0.4}>
          © 2025 WIF JAPAN SDN BHD
        </Text>
        <Text fontSize={12} color="$colorHover" opacity={0.3}>
          TRUST ・ TIME ・ EFFORT
        </Text>
      </YStack>
    </ScrollView>
  )
}
