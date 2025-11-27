/**
 * AccountCard Component
 *
 * Displays a single account with:
 * - Country flag and account name
 * - Current balance in native currency
 * - Monthly income/expenses
 * - Pending documents count and amount
 */

import React from 'react'
import { StyleSheet, View } from 'react-native'
import { Text, XStack, YStack } from 'tamagui'
import { Building2, Coins, TrendingUp, TrendingDown, FileText } from '@tamagui/lucide-icons'

import { Account, Currency, formatCurrency } from '../../types/account'

interface AccountCardProps {
  account: Account
  monthlyIncome: number
  monthlyExpenses: number
  pendingCount: number
  pendingAmount: number
  onPress?: () => void
  onLongPress?: () => void
  theme: {
    bgCard: string
    borderSubtle: string
    textPrimary: string
    textSecondary: string
    textMuted: string
    gold: string
    goldSoft: string
    positive: string
    negative: string
    pending: string
    jadeSoft: string
    vermillionSoft: string
  }
}

const COUNTRY_FLAGS: Record<string, string> = {
  Japan: '🇯🇵',
  Malaysia: '🇲🇾',
}

const ACCOUNT_TYPE_ICONS = {
  main_bank: Building2,
  petty_cash: Coins,
}

export function AccountCard({
  account,
  monthlyIncome,
  monthlyExpenses,
  pendingCount,
  pendingAmount,
  onPress,
  onLongPress,
  theme,
}: AccountCardProps) {
  const Icon = ACCOUNT_TYPE_ICONS[account.type]
  const flag = COUNTRY_FLAGS[account.country] || '🏳️'

  return (
    <YStack
      width={300}
      borderRadius={20}
      padding={20}
      borderWidth={1}
      position="relative"
      overflow="hidden"
      backgroundColor={theme.bgCard}
      borderColor={theme.borderSubtle}
      shadowColor="#000"
      shadowOffset={{ width: 0, height: 4 }}
      shadowOpacity={0.08}
      shadowRadius={12}
      elevation={4}
      onPress={onPress}
      onLongPress={onLongPress}
      pressStyle={{
        opacity: 0.95,
        scale: 0.98,
      }}
    >
      {/* Gold accent glow */}
      <View style={[styles.glow, { backgroundColor: theme.goldSoft }]} />

      {/* Header: Flag + Account Name */}
      <XStack alignItems="center" gap="$2" marginBottom="$4">
        <Text fontSize={24}>{flag}</Text>
        <YStack flex={1}>
          <Text
            fontSize={11}
            fontWeight="500"
            color={theme.textMuted}
            textTransform="uppercase"
            letterSpacing={0.8}
          >
            {account.type === 'main_bank' ? 'Bank Account' : 'Petty Cash'}
          </Text>
          <Text
            fontSize={16}
            fontWeight="600"
            color={theme.textPrimary}
            numberOfLines={1}
          >
            {account.name}
          </Text>
        </YStack>
        <View style={[styles.iconBadge, { backgroundColor: theme.goldSoft }]}>
          <Icon size={16} color={theme.gold} />
        </View>
      </XStack>

      {/* Balance */}
      <Text
        fontFamily="CormorantGaramond_500Medium"
        fontSize={36}
        color={theme.textPrimary}
        letterSpacing={-0.5}
        marginBottom="$4"
      >
        {formatCurrency(account.currentBalance, account.currency)}
      </Text>

      {/* Monthly Activity */}
      <XStack gap="$4" marginBottom="$4">
        <XStack alignItems="center" gap="$2" flex={1}>
          <View style={[styles.trendIcon, { backgroundColor: theme.jadeSoft }]}>
            <TrendingUp size={12} color={theme.positive} />
          </View>
          <YStack>
            <Text fontSize={10} color={theme.textMuted}>This month</Text>
            <Text fontSize={13} fontWeight="600" color={theme.positive}>
              +{formatCurrency(monthlyIncome, account.currency)}
            </Text>
          </YStack>
        </XStack>

        <XStack alignItems="center" gap="$2" flex={1}>
          <View style={[styles.trendIcon, { backgroundColor: theme.vermillionSoft }]}>
            <TrendingDown size={12} color={theme.negative} />
          </View>
          <YStack>
            <Text fontSize={10} color={theme.textMuted}>This month</Text>
            <Text fontSize={13} fontWeight="600" color={theme.negative}>
              -{formatCurrency(monthlyExpenses, account.currency)}
            </Text>
          </YStack>
        </XStack>
      </XStack>

      {/* Pending Documents */}
      {pendingCount > 0 && (
        <XStack
          alignItems="center"
          gap="$2"
          paddingVertical="$2"
          paddingHorizontal="$3"
          backgroundColor={theme.goldSoft}
          borderRadius="$3"
        >
          <FileText size={14} color={theme.pending} />
          <Text fontSize={12} color={theme.pending} fontWeight="500">
            {pendingCount} pending ({formatCurrency(pendingAmount, account.currency)})
          </Text>
        </XStack>
      )}
    </YStack>
  )
}

const styles = StyleSheet.create({
  glow: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 120,
    height: 120,
    borderRadius: 60,
    opacity: 0.6,
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trendIcon: {
    width: 24,
    height: 24,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
})
