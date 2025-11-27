import { useEffect } from 'react'
import { useRouter } from 'expo-router'
import {
  YStack,
  Text,
  Spinner,
} from 'tamagui'
import { Fingerprint } from '@tamagui/lucide-icons'
import * as Haptics from 'expo-haptics'

import { Button } from '../../src/components/ui'
import { useAuthStore } from '../../src/store/authStore'
import { BiometricAuthService } from '../../src/services/auth/biometricAuth'
import { BRAND } from '../../src/constants/theme'

export default function BiometricScreen() {
  const router = useRouter()
  const { loginWithBiometric, biometricType } = useAuthStore()

  useEffect(() => {
    attemptBiometricLogin()
  }, [])

  const attemptBiometricLogin = async () => {
    const result = await loginWithBiometric()

    if (result.success) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      router.replace('/(tabs)')
    }
  }

  const handleRetry = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    attemptBiometricLogin()
  }

  const handleUsePassword = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    router.replace('/(auth)/login')
  }

  return (
    <YStack
      flex={1}
      backgroundColor="$background"
      justifyContent="center"
      alignItems="center"
      padding="$6"
    >
      <YStack
        width={100}
        height={100}
        borderRadius="$round"
        backgroundColor={BRAND.navy}
        justifyContent="center"
        alignItems="center"
        marginBottom="$6"
        animation="bouncy"
        enterStyle={{ scale: 0.8, opacity: 0 }}
      >
        <Fingerprint size={48} color="#FFFFFF" />
      </YStack>

      <Text
        fontSize="$7"
        fontWeight="700"
        color="$color"
        textAlign="center"
        marginBottom="$2"
        animation="quick"
        enterStyle={{ opacity: 0, y: 10 }}
      >
        {biometricType === 'face' ? 'Face ID' : 'Touch ID'}
      </Text>

      <Text
        fontSize="$4"
        color="$colorHover"
        opacity={0.7}
        textAlign="center"
        marginBottom="$8"
        animation="quick"
        enterStyle={{ opacity: 0, y: 10 }}
      >
        Use {biometricType === 'face' ? 'Face ID' : 'Touch ID'} to sign in quickly
      </Text>

      <YStack gap="$3" width="100%" maxWidth={300}>
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onPress={handleRetry}
        >
          Try Again
        </Button>

        <Button
          variant="ghost"
          size="lg"
          fullWidth
          onPress={handleUsePassword}
        >
          Use Password Instead
        </Button>
      </YStack>
    </YStack>
  )
}
