/**
 * ActionGrid Component
 *
 * Quick action buttons for creating documents:
 * - Invoice
 * - Receipt
 * - Voucher
 * - Statement
 * - Booking
 */

import React from 'react'
import { StyleSheet, View, Pressable, Text as RNText } from 'react-native'
import { Text, XStack, YStack } from 'tamagui'
import {
  FileText,
  Receipt,
  CreditCard,
  FileCheck,
  Calendar,
} from '@tamagui/lucide-icons'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'

interface ActionGridProps {
  onAction: (actionId: string) => void
  showBooking?: boolean
  compact?: boolean
  theme: {
    bgCard: string
    borderSubtle: string
    textSecondary: string
    invoiceGradient: readonly [string, string]
    receiptGradient: readonly [string, string]
    voucherGradient: readonly [string, string]
    statementGradient: readonly [string, string]
  }
}

const DOCUMENT_ACTIONS = [
  { id: 'invoice', label: 'Invoice', icon: FileText, gradientKey: 'invoiceGradient' as const },
  { id: 'receipt', label: 'Receipt', icon: Receipt, gradientKey: 'receiptGradient' as const },
  { id: 'payment_voucher', label: 'Voucher', icon: CreditCard, gradientKey: 'voucherGradient' as const },
  { id: 'statement_of_payment', label: 'Statement', icon: FileCheck, gradientKey: 'statementGradient' as const },
]

const BOOKING_ACTION = {
  id: 'booking',
  label: 'New Booking',
  icon: Calendar,
  gradientKey: 'statementGradient' as const,
}

export function ActionGrid({ onAction, showBooking = true, compact = false, theme }: ActionGridProps) {
  const handlePress = async (actionId: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    onAction(actionId)
  }

  if (compact) {
    // Compact 2x2 grid for non-financial users
    return (
      <YStack gap="$4" paddingHorizontal="$6">
        <Text
          fontSize={13}
          fontWeight="600"
          color={theme.textSecondary}
          letterSpacing={0.3}
        >
          Create Document
        </Text>

        <YStack gap="$3">
          <XStack gap="$3">
            {DOCUMENT_ACTIONS.slice(0, 2).map((action) => (
              <ActionButton
                key={action.id}
                action={action}
                onPress={() => handlePress(action.id)}
                theme={theme}
                size="large"
              />
            ))}
          </XStack>
          <XStack gap="$3">
            {DOCUMENT_ACTIONS.slice(2, 4).map((action) => (
              <ActionButton
                key={action.id}
                action={action}
                onPress={() => handlePress(action.id)}
                theme={theme}
                size="large"
              />
            ))}
          </XStack>
          {showBooking && (
            <ActionButton
              action={BOOKING_ACTION}
              onPress={() => handlePress('booking')}
              theme={theme}
              size="full"
            />
          )}
        </YStack>
      </YStack>
    )
  }

  // Standard horizontal layout for dashboard with account cards
  return (
    <YStack paddingHorizontal="$6" marginBottom="$4">
      <Text
        fontSize={13}
        fontWeight="600"
        color={theme.textSecondary}
        letterSpacing={0.3}
        marginBottom="$3"
      >
        Quick Actions
      </Text>

      <XStack gap="$3" marginBottom={showBooking ? '$3' : 0}>
        {DOCUMENT_ACTIONS.map((action) => (
          <ActionButton
            key={action.id}
            action={action}
            onPress={() => handlePress(action.id)}
            theme={theme}
            size="small"
          />
        ))}
      </XStack>

      {showBooking && (
        <Pressable
          onPress={() => handlePress('booking')}
          style={({ pressed }) => [
            styles.bookingBtn,
            {
              backgroundColor: theme.bgCard,
              borderColor: theme.borderSubtle,
              opacity: pressed ? 0.8 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            },
          ]}
        >
          <XStack alignItems="center" justifyContent="center" gap="$2">
            <LinearGradient
              colors={theme.statementGradient as unknown as string[]}
              style={styles.bookingIcon}
            >
              <Calendar size={18} color="#FFFFFF" />
            </LinearGradient>
            <RNText style={[styles.bookingLabel, { color: theme.textSecondary }]}>
              New Booking
            </RNText>
          </XStack>
        </Pressable>
      )}
    </YStack>
  )
}

interface ActionButtonProps {
  action: {
    id: string
    label: string
    icon: typeof FileText
    gradientKey: 'invoiceGradient' | 'receiptGradient' | 'voucherGradient' | 'statementGradient'
  }
  onPress: () => void
  theme: ActionGridProps['theme']
  size: 'small' | 'large' | 'full'
}

function ActionButton({ action, onPress, theme, size }: ActionButtonProps) {
  const Icon = action.icon
  const gradient = theme[action.gradientKey]

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        size === 'small' ? styles.actionBtnSmall : size === 'large' ? styles.actionBtnLarge : styles.actionBtnFull,
        {
          backgroundColor: theme.bgCard,
          borderColor: theme.borderSubtle,
          opacity: pressed ? 0.8 : 1,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
      ]}
    >
      <View style={styles.actionBtnInner}>
        <View style={size === 'small' ? styles.actionIconWrapperSmall : styles.actionIconWrapperLarge}>
          <LinearGradient
            colors={gradient as unknown as string[]}
            style={styles.actionIconGradient}
          >
            <Icon size={size === 'small' ? 20 : 24} color="#FFFFFF" />
          </LinearGradient>
        </View>
        <RNText
          style={[
            size === 'small' ? styles.actionLabelSmall : styles.actionLabelLarge,
            { color: theme.textSecondary },
          ]}
        >
          {action.label}
        </RNText>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  actionBtnSmall: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  actionBtnLarge: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  actionBtnFull: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  actionBtnInner: {
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 10,
  },
  actionIconWrapperSmall: {
    width: 44,
    height: 44,
    borderRadius: 12,
    overflow: 'hidden',
  },
  actionIconWrapperLarge: {
    width: 56,
    height: 56,
    borderRadius: 14,
    overflow: 'hidden',
  },
  actionIconGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionLabelSmall: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  actionLabelLarge: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  bookingBtn: {
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  bookingIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookingLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
})
