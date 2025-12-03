/**
 * Operations Bookings Screen
 *
 * Booking management for operations role users.
 * Reuses the existing bookings tab logic but with operations theme.
 */

import { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Pressable,
  ActivityIndicator,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Plus, Plane, Users, MapPin, Calendar, ChevronRight } from '@tamagui/lucide-icons'
import * as Haptics from 'expo-haptics'
import { useAuthStore } from '../../src/store/authStore'
import { useThemeStore } from '../../src/store/themeStore'
import { getAppTheme } from '../../src/constants/theme'
import { supabase } from '../../src/services/api/supabaseClient'
import { formatCurrency, formatDate } from '../../src/utils/formatters'

interface Booking {
  id: string
  bookingCode: string
  guestName: string
  destination: string
  travelDate: string
  paxCount: number
  status: string
  b2bTotalMyr: number
  wifCostMyr: number
  profitMyr: number
  currency: string
}

export default function OperationsBookingsScreen() {
  const router = useRouter()
  const user = useAuthStore((state) => state.user)
  const isDark = useThemeStore((state) => state.isDarkMode)
  const appTheme = getAppTheme(isDark)

  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadBookings = useCallback(async () => {
    if (!user?.companyId) return

    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('company_id', user.companyId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) throw error

      const formattedBookings: Booking[] = (data || []).map((b: any) => ({
        id: b.id,
        bookingCode: b.booking_code,
        guestName: b.guest_name,
        destination: b.destination,
        travelDate: b.travel_date,
        paxCount: b.pax_count,
        status: b.status,
        b2bTotalMyr: b.b2b_total_myr || 0,
        wifCostMyr: b.wif_cost_myr || 0,
        profitMyr: b.profit_myr || 0,
        currency: b.currency || 'MYR',
      }))

      setBookings(formattedBookings)
    } catch (error) {
      console.error('Error loading bookings:', error)
    } finally {
      setLoading(false)
    }
  }, [user?.companyId])

  useEffect(() => {
    loadBookings()
  }, [loadBookings])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await loadBookings()
    setRefreshing(false)
  }, [loadBookings])

  const handleBookingPress = (booking: Booking) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    router.push(`/booking/${booking.id}`)
  }

  const handleCreateBooking = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    router.push('/booking/new')
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return '#6b7280'
      case 'planning':
        return '#f59e0b'
      case 'confirmed':
        return '#3b82f6'
      case 'in_progress':
        return '#8b5cf6'
      case 'completed':
        return '#10b981'
      case 'cancelled':
        return '#ef4444'
      default:
        return '#6b7280'
    }
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      draft: 'Draft',
      planning: 'Planning',
      confirmed: 'Confirmed',
      in_progress: 'In Progress',
      completed: 'Completed',
      cancelled: 'Cancelled',
    }
    return labels[status] || status
  }

  const styles = createStyles(appTheme, isDark)

  const renderBooking = ({ item }: { item: Booking }) => (
    <Pressable
      style={styles.bookingCard}
      onPress={() => handleBookingPress(item)}
    >
      <View style={styles.bookingHeader}>
        <View style={styles.bookingIcon}>
          <Plane size={20} color="#0891b2" />
        </View>
        <View style={styles.bookingInfo}>
          <Text style={styles.guestName}>{item.guestName}</Text>
          <Text style={styles.bookingCode}>{item.bookingCode}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(item.status)}20` }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {getStatusLabel(item.status)}
          </Text>
        </View>
      </View>

      <View style={styles.bookingDetails}>
        <View style={styles.detailItem}>
          <MapPin size={14} color={appTheme.textMuted} />
          <Text style={styles.detailText}>{item.destination}</Text>
        </View>
        <View style={styles.detailItem}>
          <Calendar size={14} color={appTheme.textMuted} />
          <Text style={styles.detailText}>{formatDate(item.travelDate)}</Text>
        </View>
        <View style={styles.detailItem}>
          <Users size={14} color={appTheme.textMuted} />
          <Text style={styles.detailText}>{item.paxCount} pax</Text>
        </View>
      </View>

      <View style={styles.priceRow}>
        <View style={styles.priceItem}>
          <Text style={styles.priceLabel}>B2B Price</Text>
          <Text style={styles.priceValue}>
            {formatCurrency(item.b2bTotalMyr, 'MYR')}
          </Text>
        </View>
        <View style={styles.priceItem}>
          <Text style={styles.priceLabel}>WIF Cost</Text>
          <Text style={styles.priceValue}>
            {formatCurrency(item.wifCostMyr, 'MYR')}
          </Text>
        </View>
        <View style={styles.priceItem}>
          <Text style={styles.priceLabel}>Profit</Text>
          <Text style={[styles.priceValue, { color: item.profitMyr >= 0 ? '#10b981' : '#ef4444' }]}>
            {formatCurrency(item.profitMyr, 'MYR')}
          </Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.viewDetails}>View Details</Text>
        <ChevronRight size={16} color={appTheme.textMuted} />
      </View>
    </Pressable>
  )

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Bookings</Text>
        <Pressable
          style={styles.addButton}
          onPress={handleCreateBooking}
        >
          <Plus size={20} color="#fff" />
          <Text style={styles.addButtonText}>New</Text>
        </Pressable>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#059669" />
          </View>
        ) : bookings.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Plane size={48} color={appTheme.textMuted} />
            <Text style={styles.emptyTitle}>No Bookings</Text>
            <Text style={styles.emptySubtitle}>
              Create your first booking
            </Text>
            <Pressable
              style={styles.emptyButton}
              onPress={handleCreateBooking}
            >
              <Plus size={20} color="#fff" />
              <Text style={styles.emptyButtonText}>Create Booking</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={bookings}
            keyExtractor={(item) => item.id}
            renderItem={renderBooking}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </SafeAreaView>
  )
}

const createStyles = (theme: ReturnType<typeof getAppTheme>, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#059669',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: '#fff',
    },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: 'rgba(255,255,255,0.2)',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
    },
    addButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#fff',
    },
    content: {
      flex: 1,
      backgroundColor: theme.bgPrimary,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
    },
    listContent: {
      padding: 16,
      paddingBottom: 40,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: theme.text,
      marginTop: 16,
    },
    emptySubtitle: {
      fontSize: 14,
      color: theme.textMuted,
      marginTop: 8,
      textAlign: 'center',
    },
    emptyButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: '#059669',
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 12,
      marginTop: 24,
    },
    emptyButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#fff',
    },
    bookingCard: {
      backgroundColor: theme.bgCard,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      borderLeftWidth: 4,
      borderLeftColor: '#0891b2',
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
        },
        android: {
          elevation: 3,
        },
      }),
    },
    bookingHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    bookingIcon: {
      width: 40,
      height: 40,
      borderRadius: 10,
      backgroundColor: '#0891b220',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    bookingInfo: {
      flex: 1,
    },
    guestName: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
    },
    bookingCode: {
      fontSize: 13,
      color: theme.textMuted,
      marginTop: 2,
    },
    statusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    statusText: {
      fontSize: 12,
      fontWeight: '600',
    },
    bookingDetails: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 16,
      marginBottom: 12,
    },
    detailItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    detailText: {
      fontSize: 13,
      color: theme.textMuted,
    },
    priceRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    priceItem: {
      alignItems: 'center',
    },
    priceLabel: {
      fontSize: 11,
      color: theme.textMuted,
    },
    priceValue: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
      marginTop: 2,
    },
    cardFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      marginTop: 12,
    },
    viewDetails: {
      fontSize: 13,
      color: theme.textMuted,
      marginRight: 4,
    },
  })
