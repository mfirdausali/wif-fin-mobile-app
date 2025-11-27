import { useState, useCallback, useMemo } from 'react'
import { RefreshControl, ActivityIndicator, StyleSheet, View, Pressable } from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import {
  YStack,
  XStack,
  Text,
  Input,
  ScrollView,
} from 'tamagui'
import {
  Search,
  Plus,
  Plane,
  Calendar,
  Users,
} from '@tamagui/lucide-icons'
import * as Haptics from 'expo-haptics'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  useFonts,
  CormorantGaramond_400Regular,
  CormorantGaramond_500Medium,
} from '@expo-google-fonts/cormorant-garamond'

import { getBookings } from '../../src/services'
import type { Booking, BookingStatus, Currency } from '../../src/types'
import { getAppTheme } from '../../src/constants/theme'
import { useThemeStore } from '../../src/store/themeStore'

const statusConfig: Record<BookingStatus, { color: string; darkColor: string; label: string }> = {
  draft: { color: '#8C8680', darkColor: '#6B6965', label: 'Draft' },
  planning: { color: '#B8963F', darkColor: '#C9A962', label: 'Planning' },
  confirmed: { color: '#4A5A7A', darkColor: '#5B6B8C', label: 'Confirmed' },
  in_progress: { color: '#5856D6', darkColor: '#7B7AE0', label: 'In Progress' },
  completed: { color: '#4A7A5A', darkColor: '#6B8C7A', label: 'Completed' },
  cancelled: { color: '#C75B4A', darkColor: '#C75B4A', label: 'Cancelled' },
}

// Format date
const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

// Format currency
const formatCurrency = (amount: number, currency: Currency): string => {
  if (currency === 'JPY') {
    return `¥${amount.toLocaleString()}`
  }
  return `RM ${amount.toLocaleString('en-MY', { minimumFractionDigits: 2 })}`
}

export default function BookingsScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const isDark = useThemeStore((state) => state.isDarkMode)
  const theme = getAppTheme(isDark)

  const [fontsLoaded] = useFonts({
    CormorantGaramond_400Regular,
    CormorantGaramond_500Medium,
  })

  const [searchQuery, setSearchQuery] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [bookings, setBookings] = useState<Booking[]>([])

  const fetchBookings = useCallback(async () => {
    try {
      const data = await getBookings()
      setBookings(data)
    } catch (error) {
      console.error('Error fetching bookings:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      fetchBookings()
    }, [fetchBookings])
  )

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    const activeBookings = bookings.filter(b =>
      b.status !== 'completed' && b.status !== 'cancelled'
    )
    const totalB2BValue = bookings.reduce((sum, b) => sum + b.totalB2BCostJPY, 0)

    return {
      active: activeBookings.length,
      totalValue: totalB2BValue,
    }
  }, [bookings])

  const filteredBookings = useMemo(() => {
    return bookings.filter((booking) => {
      const matchesSearch =
        searchQuery === '' ||
        booking.tripName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        booking.bookingNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        booking.guestName.toLowerCase().includes(searchQuery.toLowerCase())

      return matchesSearch
    })
  }, [searchQuery, bookings])

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    await fetchBookings()
    setIsRefreshing(false)
  }, [fetchBookings])

  const handleBookingPress = async (id: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    router.push(`/booking/${id}`)
  }

  const handleCreateBooking = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    router.push('/booking/new')
  }

  if (!fontsLoaded) {
    return (
      <YStack flex={1} backgroundColor={theme.bgPrimary} justifyContent="center" alignItems="center">
        <ActivityIndicator size="large" color={theme.gold} />
      </YStack>
    )
  }

  return (
    <YStack flex={1} backgroundColor={theme.bgPrimary}>
      {/* Header */}
      <YStack
        paddingTop={insets.top + 8}
        paddingHorizontal={24}
        paddingBottom={20}
      >
        <XStack justifyContent="space-between" alignItems="center" marginBottom={20}>
          <Text
            fontFamily="CormorantGaramond_500Medium"
            fontSize={24}
            color={theme.textPrimary}
          >
            Bookings
          </Text>
          <View style={[styles.addBtn, { backgroundColor: theme.bgCard, borderColor: theme.borderSubtle }]}>
            <Pressable
              onPress={handleCreateBooking}
              style={styles.addBtnInner}
            >
              <Plus size={18} color={theme.textSecondary} />
            </Pressable>
          </View>
        </XStack>

        {/* Search Bar */}
        <View style={[styles.searchBar, { backgroundColor: theme.bgCard, borderColor: theme.borderSubtle }]}>
          <Search size={18} color={theme.textMuted} />
          <Input
            flex={1}
            placeholder="Search bookings..."
            placeholderTextColor={theme.textFaint}
            value={searchQuery}
            onChangeText={setSearchQuery}
            borderWidth={0}
            backgroundColor="transparent"
            fontSize={14}
            color={theme.textPrimary}
            paddingHorizontal={12}
          />
        </View>
      </YStack>

      {/* Booking List */}
      <ScrollView
        flex={1}
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingBottom: insets.bottom + 100,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={theme.gold}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <YStack alignItems="center" paddingVertical={40}>
            <ActivityIndicator size="large" color={theme.gold} />
            <Text fontSize={14} color={theme.textMuted} marginTop={12}>
              Loading bookings...
            </Text>
          </YStack>
        ) : filteredBookings.length === 0 ? (
          <YStack
            alignItems="center"
            paddingVertical={40}
            backgroundColor={theme.bgCard}
            borderRadius={14}
            borderWidth={1}
            borderColor={theme.borderSubtle}
          >
            <Plane size={48} color={theme.textMuted} opacity={0.3} />
            <Text fontSize={15} fontWeight="600" color={theme.textPrimary} marginTop={12}>
              No bookings found
            </Text>
            <Text fontSize={14} color={theme.textMuted} textAlign="center" marginTop={4}>
              {searchQuery
                ? 'Try adjusting your search'
                : 'Create your first booking to get started'}
            </Text>
          </YStack>
        ) : (
          filteredBookings.map((booking) => {
            const statusColor = isDark
              ? statusConfig[booking.status].darkColor
              : statusConfig[booking.status].color

            return (
              <Pressable
                key={booking.id}
                onPress={() => handleBookingPress(booking.id)}
                style={({ pressed }) => [
                  styles.bookingCard,
                  {
                    backgroundColor: theme.bgCard,
                    borderColor: theme.borderSubtle,
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                  }
                ]}
              >
                {/* Top row: Status indicator + Booking number + Status badge */}
                <XStack justifyContent="space-between" alignItems="center" marginBottom={12}>
                  <XStack alignItems="center" gap={8}>
                    <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                    <Text fontSize={12} color={theme.textMuted}>
                      {booking.bookingNumber}
                    </Text>
                  </XStack>
                  <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
                    <Text fontSize={11} fontWeight="600" color={statusColor}>
                      {statusConfig[booking.status].label}
                    </Text>
                  </View>
                </XStack>

                {/* Trip name */}
                <Text
                  fontSize={16}
                  fontWeight="600"
                  color={theme.textPrimary}
                  marginBottom={4}
                  numberOfLines={1}
                >
                  {booking.tripName}
                </Text>

                {/* Guest name */}
                <Text fontSize={13} color={theme.textSecondary} marginBottom={14}>
                  {booking.guestName}
                </Text>

                {/* Details row */}
                <XStack gap={16} marginBottom={14}>
                  <XStack alignItems="center" gap={6}>
                    <Calendar size={14} color={theme.textMuted} />
                    <Text fontSize={12} color={theme.textMuted}>
                      {formatDate(booking.startDate)} - {formatDate(booking.endDate)}
                    </Text>
                  </XStack>
                  <XStack alignItems="center" gap={6}>
                    <Users size={14} color={theme.textMuted} />
                    <Text fontSize={12} color={theme.textMuted}>
                      {booking.pax} pax
                    </Text>
                  </XStack>
                </XStack>

                {/* Financial row */}
                <View style={[styles.financialRow, { borderTopColor: theme.borderSubtle }]}>
                  <YStack>
                    <Text fontSize={10} color={theme.textMuted} textTransform="uppercase" letterSpacing={0.5}>
                      Cost
                    </Text>
                    <Text fontSize={14} fontWeight="500" color={theme.textPrimary}>
                      {formatCurrency(booking.totalInternalCostJPY, 'JPY')}
                    </Text>
                  </YStack>
                  <YStack alignItems="center">
                    <Text fontSize={10} color={theme.textMuted} textTransform="uppercase" letterSpacing={0.5}>
                      Margin
                    </Text>
                    <Text fontSize={14} fontWeight="600" color={theme.positive}>
                      {booking.profitMargin.toFixed(1)}%
                    </Text>
                  </YStack>
                  <YStack alignItems="flex-end">
                    <Text fontSize={10} color={theme.textMuted} textTransform="uppercase" letterSpacing={0.5}>
                      B2B Price
                    </Text>
                    <Text fontSize={14} fontWeight="600" color={theme.gold}>
                      {formatCurrency(booking.totalB2BCostJPY, 'JPY')}
                    </Text>
                  </YStack>
                </View>
              </Pressable>
            )
          })
        )}
      </ScrollView>
    </YStack>
  )
}

const styles = StyleSheet.create({
  addBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  addBtnInner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
  },
  summaryItem: {
    flex: 1,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
  },
  bookingCard: {
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  financialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 14,
    borderTopWidth: 1,
  },
})
