/**
 * AccountCarousel Component
 *
 * Horizontal swipeable carousel of account cards with:
 * - Snap scrolling
 * - Pagination dots
 * - Long press drag to reorder
 */

import React, { useRef, useState, useCallback } from 'react'
import {
  StyleSheet,
  View,
  Dimensions,
} from 'react-native'
import { Text, XStack, YStack } from 'tamagui'
import * as Haptics from 'expo-haptics'
import DraggableFlatList, {
  ScaleDecorator,
  RenderItemParams,
  DragEndParams,
} from 'react-native-draggable-flatlist'

import { AccountCard } from './AccountCard'
import { Account } from '../../types/account'
import { useAccountOrderStore } from '../../store/accountOrderStore'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const CARD_WIDTH = 300
const CARD_MARGIN = 12
const SNAP_INTERVAL = CARD_WIDTH + CARD_MARGIN

interface AccountWithStats {
  account: Account
  monthlyIncome: number
  monthlyExpenses: number
  pendingCount: number
  pendingAmount: number
}

interface AccountCarouselProps {
  accounts: AccountWithStats[]
  onAccountPress?: (account: Account) => void
  onOrderChange?: (newOrder: string[]) => void
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

export function AccountCarousel({ accounts, onAccountPress, onOrderChange, theme }: AccountCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const setAccountOrder = useAccountOrderStore((state) => state.setAccountOrder)

  const handleDragBegin = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
    setIsDragging(true)
  }, [])

  const handleDragEnd = useCallback(({ data }: DragEndParams<AccountWithStats>) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    setIsDragging(false)

    // Update order in store
    const newOrder = data.map(item => item.account.id)
    setAccountOrder(newOrder)
    onOrderChange?.(newOrder)
  }, [setAccountOrder, onOrderChange])

  const handleCardPress = useCallback(async (account: Account) => {
    if (isDragging) return
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onAccountPress?.(account)
  }, [isDragging, onAccountPress])

  const renderItem = useCallback(
    ({ item, index, drag, isActive }: RenderItemParams<AccountWithStats>) => (
      <ScaleDecorator activeScale={1.03}>
        <View
          style={[
            styles.cardWrapper,
            { marginLeft: index === 0 ? 24 : CARD_MARGIN / 2 },
            isActive && styles.cardDragging,
          ]}
        >
          <AccountCard
            account={item.account}
            monthlyIncome={item.monthlyIncome}
            monthlyExpenses={item.monthlyExpenses}
            pendingCount={item.pendingCount}
            pendingAmount={item.pendingAmount}
            onPress={() => handleCardPress(item.account)}
            onLongPress={drag}
            theme={theme}
          />
        </View>
      </ScaleDecorator>
    ),
    [handleCardPress, theme]
  )

  const keyExtractor = useCallback((item: AccountWithStats) => item.account.id, [])

  if (accounts.length === 0) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: theme.bgCard, borderColor: theme.borderSubtle }]}>
        <Text color={theme.textMuted} fontSize={14}>
          No accounts found
        </Text>
      </View>
    )
  }

  return (
    <YStack marginBottom="$4">
      {/* Section Header */}
      <XStack paddingHorizontal="$6" marginBottom="$3" alignItems="center" justifyContent="space-between">
        <Text
          fontSize={13}
          fontWeight="600"
          color={theme.textPrimary}
          letterSpacing={0.3}
        >
          Accounts
        </Text>
        <Text fontSize={12} color={isDragging ? theme.gold : theme.textMuted}>
          {isDragging ? 'Drop to reorder' : 'Hold & drag to reorder'}
        </Text>
      </XStack>

      {/* Draggable Carousel */}
      <DraggableFlatList
        data={accounts}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={SNAP_INTERVAL}
        snapToAlignment="start"
        decelerationRate="fast"
        onDragBegin={handleDragBegin}
        onDragEnd={handleDragEnd}
        contentContainerStyle={styles.listContent}
        activationDistance={10}
      />

      {/* Pagination Dots */}
      {accounts.length > 1 && (
        <XStack justifyContent="center" marginTop="$3" gap="$2">
          {accounts.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                {
                  backgroundColor: index === activeIndex ? theme.gold : theme.borderSubtle,
                  width: index === activeIndex ? 20 : 8,
                },
              ]}
            />
          ))}
        </XStack>
      )}
    </YStack>
  )
}

const styles = StyleSheet.create({
  listContent: {
    paddingRight: 24,
  },
  cardWrapper: {
    marginRight: CARD_MARGIN / 2,
    position: 'relative',
  },
  cardDragging: {
    shadowColor: '#B8963F',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  emptyContainer: {
    marginHorizontal: 24,
    padding: 40,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
