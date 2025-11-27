import { useState, useMemo, useCallback, memo } from 'react'
import {
  Input as TamaguiInput,
  YStack,
  XStack,
  Text,
  GetProps,
  styled,
} from 'tamagui'
import { Eye, EyeOff } from '@tamagui/lucide-icons'
import { IconButton } from './Button'
import * as Haptics from 'expo-haptics'
import { useThemeStore } from '../../store/themeStore'

// Input styling constants matching design spec
const INPUT_COLORS = {
  background: '#FAF8F5',        // Slightly tinted
  backgroundFocus: '#FFFFFF',   // White on focus/filled
  focusGlow: 'rgba(184, 150, 63, 0.15)', // Gold glow
  borderFocus: '#B8963F',       // Gold border on focus (light)
  borderFocusDark: '#C9A962',   // Gold border on focus (dark)
}

// Pre-defined shadow styles to avoid object recreation
const FOCUS_SHADOW_STYLE = {
  shadowColor: '#B8963F',
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.15,
  shadowRadius: 3,
}

const NO_SHADOW_STYLE = {}

type TamaguiInputProps = GetProps<typeof TamaguiInput>

export interface InputProps extends Omit<TamaguiInputProps, 'ref'> {
  label?: string
  helperText?: string
  errorText?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  containerProps?: GetProps<typeof YStack>
  inputSize?: 'sm' | 'md' | 'lg'
  error?: boolean
}

const sizeStyles = {
  sm: { height: 40, fontSize: 14, paddingHorizontal: 12 },
  md: { height: 48, fontSize: 16, paddingHorizontal: 16 },
  lg: { height: 56, fontSize: 18, paddingHorizontal: 20 },
}

export const Input = ({
  label,
  helperText,
  errorText,
  leftIcon,
  rightIcon,
  error,
  containerProps,
  onFocus,
  onBlur,
  inputSize = 'md',
  value,
  ...props
}: InputProps) => {
  const [isFocused, setIsFocused] = useState(false)
  const isDark = useThemeStore((state) => state.isDarkMode)
  const hasError = error || !!errorText

  const handleFocus = useCallback((e: any) => {
    setIsFocused(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onFocus?.(e)
  }, [onFocus])

  const handleBlur = useCallback((e: any) => {
    setIsFocused(false)
    onBlur?.(e)
  }, [onBlur])

  const sizes = sizeStyles[inputSize]

  // Gold border color on focus
  const focusBorderColor = isDark ? INPUT_COLORS.borderFocusDark : INPUT_COLORS.borderFocus

  // Use static background - avoid changing on hasValue to prevent re-renders
  // Only change background on focus state
  const bgColor = isFocused ? INPUT_COLORS.backgroundFocus : INPUT_COLORS.background

  // Use pre-defined shadow style objects
  const shadowStyle = isFocused ? FOCUS_SHADOW_STYLE : NO_SHADOW_STYLE

  return (
    <YStack gap="$1.5" {...containerProps}>
      {label && (
        <Text
          fontSize="$4"
          fontWeight="500"
          color={isFocused ? (isDark ? '$yellow10' : '$yellow11') : hasError ? '$red10' : '$color'}
        >
          {label}
        </Text>
      )}

      <XStack alignItems="center" position="relative">
        {leftIcon && (
          <YStack
            position="absolute"
            left="$3"
            zIndex={1}
            opacity={isFocused ? 1 : 0.6}
          >
            {leftIcon}
          </YStack>
        )}

        <TamaguiInput
          flex={1}
          backgroundColor={bgColor}
          borderWidth={hasError ? 2 : 1}
          borderColor={hasError ? '$red10' : isFocused ? focusBorderColor : '$borderColor'}
          borderRadius="$3"
          height={sizes.height}
          fontSize={sizes.fontSize}
          paddingHorizontal={sizes.paddingHorizontal}
          paddingLeft={leftIcon ? 44 : sizes.paddingHorizontal}
          paddingRight={rightIcon ? 44 : sizes.paddingHorizontal}
          color="$color"
          placeholderTextColor="$placeholderColor"
          onFocus={handleFocus}
          onBlur={handleBlur}
          value={value}
          style={shadowStyle}
          {...props}
        />

        {rightIcon && (
          <YStack position="absolute" right="$3" zIndex={1}>
            {rightIcon}
          </YStack>
        )}
      </XStack>

      {(helperText || errorText) && (
        <Text
          fontSize="$3"
          color={hasError ? '$red10' : '$gray10'}
          opacity={hasError ? 1 : 0.8}
        >
          {errorText || helperText}
        </Text>
      )}
    </YStack>
  )
}

Input.displayName = 'Input'

// Password input with toggle visibility
export interface PasswordInputProps extends Omit<InputProps, 'rightIcon' | 'secureTextEntry'> {}

export const PasswordInput = (props: PasswordInputProps) => {
  const [showPassword, setShowPassword] = useState(false)

  const toggleVisibility = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setShowPassword(!showPassword)
  }

  return (
    <Input
      secureTextEntry={!showPassword}
      autoCapitalize="none"
      autoCorrect={false}
      rightIcon={
        <IconButton
          size="sm"
          variant="ghost"
          onPress={toggleVisibility}
          hapticFeedback="none"
        >
          {showPassword ? (
            <EyeOff size={20} color="$gray10" />
          ) : (
            <Eye size={20} color="$gray10" />
          )}
        </IconButton>
      }
      {...props}
    />
  )
}

PasswordInput.displayName = 'PasswordInput'

// Search input
export interface SearchInputProps extends Omit<InputProps, 'leftIcon'> {
  onSearch?: (value: string) => void
}

export const SearchInput = ({ onSearch, ...props }: SearchInputProps) => {
  return (
    <Input
      placeholder="Search..."
      returnKeyType="search"
      onSubmitEditing={(e) => onSearch?.(e.nativeEvent.text)}
      {...props}
    />
  )
}

SearchInput.displayName = 'SearchInput'

// Currency input for amounts
export interface CurrencyInputProps extends InputProps {
  currency?: 'MYR' | 'JPY'
}

export const CurrencyInput = ({ currency = 'MYR', ...props }: CurrencyInputProps) => {
  return (
    <Input
      keyboardType="decimal-pad"
      leftIcon={
        <Text
          fontSize="$4"
          fontWeight="600"
          color={currency === 'MYR' ? '$green10' : '$orange10'}
        >
          {currency}
        </Text>
      }
      {...props}
    />
  )
}

CurrencyInput.displayName = 'CurrencyInput'
