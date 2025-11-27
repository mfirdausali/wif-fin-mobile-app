import { ReactNode } from 'react'
import {
  Button as TamaguiButton,
  GetProps,
  Spinner,
  ButtonProps as TamaguiButtonProps,
} from 'tamagui'
import * as Haptics from 'expo-haptics'

type BaseTamaguiButtonProps = GetProps<typeof TamaguiButton>

export interface ButtonProps extends Omit<BaseTamaguiButtonProps, 'ref' | 'size'> {
  loading?: boolean
  hapticFeedback?: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'none'
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success'
  size?: 'sm' | 'md' | 'lg' | 'xl'
  fullWidth?: boolean
  rounded?: boolean
}

const variantStyles = {
  primary: {
    backgroundColor: '$primary',
    color: '#FFFFFF',
  },
  secondary: {
    backgroundColor: '$secondary',
    color: '#FFFFFF',
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '$primary',
    color: '$primary',
  },
  ghost: {
    backgroundColor: 'transparent',
    color: '$primary',
  },
  danger: {
    backgroundColor: '$error',
    color: '#FFFFFF',
  },
  success: {
    backgroundColor: '$success',
    color: '#FFFFFF',
  },
}

const sizeStyles = {
  sm: { height: 36, paddingHorizontal: 12, fontSize: 14 },
  md: { height: 44, paddingHorizontal: 16, fontSize: 16 },
  lg: { height: 52, paddingHorizontal: 20, fontSize: 18 },
  xl: { height: 60, paddingHorizontal: 24, fontSize: 20 },
}

export const Button = ({
  children,
  loading,
  disabled,
  hapticFeedback = 'light',
  onPress,
  variant = 'primary',
  size = 'md',
  fullWidth,
  rounded,
  ...props
}: ButtonProps) => {
  const handlePress = async (e: any) => {
    if (hapticFeedback !== 'none') {
      switch (hapticFeedback) {
        case 'light':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          break
        case 'medium':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
          break
        case 'heavy':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
          break
        case 'success':
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          break
        case 'warning':
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
          break
        case 'error':
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
          break
      }
    }
    onPress?.(e)
  }

  const variantStyle = variantStyles[variant]
  const sizes = sizeStyles[size]

  return (
    <TamaguiButton
      disabled={disabled || loading}
      opacity={disabled ? 0.5 : 1}
      onPress={handlePress}
      fontWeight="600"
      borderRadius={rounded ? 999 : 12}
      height={sizes.height}
      paddingHorizontal={sizes.paddingHorizontal}
      fontSize={sizes.fontSize}
      width={fullWidth ? '100%' : undefined}
      pressStyle={{ opacity: 0.85, scale: 0.98 }}
      animation="quick"
      {...variantStyle}
      {...props}
    >
      {loading ? (
        <Spinner
          size="small"
          color={variant === 'outline' || variant === 'ghost' ? '$primary' : '#FFFFFF'}
        />
      ) : (
        children
      )}
    </TamaguiButton>
  )
}

Button.displayName = 'Button'

// Icon button variant
export interface IconButtonProps extends Omit<ButtonProps, 'size'> {
  size?: 'sm' | 'md' | 'lg'
  children: ReactNode
}

const iconSizeStyles = {
  sm: { width: 36, height: 36 },
  md: { width: 44, height: 44 },
  lg: { width: 52, height: 52 },
}

export const IconButton = ({
  children,
  size = 'md',
  variant = 'ghost',
  hapticFeedback = 'light',
  onPress,
  disabled,
  ...props
}: IconButtonProps) => {
  const handlePress = async (e: any) => {
    if (hapticFeedback !== 'none') {
      switch (hapticFeedback) {
        case 'light':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          break
        case 'medium':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
          break
        case 'heavy':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
          break
        case 'success':
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          break
        case 'warning':
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
          break
        case 'error':
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
          break
      }
    }
    onPress?.(e)
  }

  const sizeStyle = iconSizeStyles[size]
  const variantStyle = variantStyles[variant]

  return (
    <TamaguiButton
      disabled={disabled}
      opacity={disabled ? 0.5 : 1}
      onPress={handlePress}
      padding={0}
      justifyContent="center"
      alignItems="center"
      borderRadius={12}
      pressStyle={{ opacity: 0.85, scale: 0.98 }}
      animation="quick"
      {...sizeStyle}
      {...variantStyle}
      {...props}
    >
      {children}
    </TamaguiButton>
  )
}

IconButton.displayName = 'IconButton'
