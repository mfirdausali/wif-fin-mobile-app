/**
 * Operations Dashboard Screen
 *
 * Simplified dashboard for operations role users.
 * Shows Payment Voucher stats and Booking stats.
 */

import { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { FileText, Plane, Plus, LogOut, User } from '@tamagui/lucide-icons'
import * as Haptics from 'expo-haptics'
import { useAuthStore } from '../../src/store/authStore'
import { useThemeStore } from '../../src/store/themeStore'
import { getAppTheme } from '../../src/constants/theme'
import { supabase } from '../../src/services/api/supabaseClient'

interface DashboardStats {
  vouchers: {
    total: number
    draft: number
    pending: number
    completed: number
  }
  bookings: {
    total: number
    draft: number
    confirmed: number
    completed: number
  }
}

export default function OperationsDashboardScreen() {
  const router = useRouter()
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const isDark = useThemeStore((state) => state.isDarkMode)
  const appTheme = getAppTheme(isDark)

  const [refreshing, setRefreshing] = useState(false)
  const [stats, setStats] = useState<DashboardStats>({
    vouchers: { total: 0, draft: 0, pending: 0, completed: 0 },
    bookings: { total: 0, draft: 0, confirmed: 0, completed: 0 },
  })

  const loadStats = useCallback(async () => {
    if (!user?.companyId) return

    try {
      // Load Payment Voucher stats
      const { data: vouchers } = await supabase
        .from('documents')
        .select('status')
        .eq('company_id', user.companyId)
        .eq('document_type', 'payment_voucher')
        .is('deleted_at', null)

      // Load Booking stats
      const { data: bookings } = await supabase
        .from('bookings')
        .select('status')
        .eq('company_id', user.companyId)
        .eq('is_active', true)

      const voucherStats = {
        total: vouchers?.length || 0,
        draft: vouchers?.filter(v => v.status === 'draft').length || 0,
        pending: vouchers?.filter(v => v.status === 'issued').length || 0, // 'issued' is the pending state
        completed: vouchers?.filter(v => v.status === 'completed').length || 0,
      }

      const bookingStats = {
        total: bookings?.length || 0,
        draft: bookings?.filter(b => b.status === 'draft').length || 0,
        confirmed: bookings?.filter(b => b.status === 'confirmed').length || 0,
        completed: bookings?.filter(b => b.status === 'completed').length || 0,
      }

      setStats({
        vouchers: voucherStats,
        bookings: bookingStats,
      })
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }, [user?.companyId])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await loadStats()
    setRefreshing(false)
  }, [loadStats])

  const handleLogout = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    await logout()
  }

  const navigateToVouchers = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    router.push('/(operations)/vouchers')
  }

  const navigateToBookings = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    router.push('/(operations)/bookings')
  }

  const styles = createStyles(appTheme, isDark)

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Operations Portal</Text>
          <Text style={styles.headerSubtitle}>Payment Vouchers & Bookings</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.userBadge}>
            <User size={16} color="#fff" />
            <Text style={styles.userName}>{user?.name || user?.username}</Text>
          </View>
          <Pressable
            style={styles.logoutButton}
            onPress={handleLogout}
          >
            <LogOut size={20} color="#fff" />
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Pressable
            style={[styles.quickActionCard, styles.voucherCard]}
            onPress={navigateToVouchers}
          >
            <View style={styles.quickActionIcon}>
              <FileText size={28} color={appTheme.jade} />
            </View>
            <Text style={styles.quickActionTitle}>Payment Vouchers</Text>
            <Text style={styles.quickActionCount}>{stats.vouchers.total} total</Text>
          </Pressable>

          <Pressable
            style={[styles.quickActionCard, styles.bookingCard]}
            onPress={navigateToBookings}
          >
            <View style={styles.quickActionIcon}>
              <Plane size={28} color={appTheme.indigo} />
            </View>
            <Text style={styles.quickActionTitle}>Bookings</Text>
            <Text style={styles.quickActionCount}>{stats.bookings.total} total</Text>
          </Pressable>
        </View>

        {/* Payment Voucher Stats */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Payment Voucher Status</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.vouchers.draft}</Text>
              <Text style={styles.statLabel}>Draft</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: appTheme.indigo }]}>{stats.vouchers.pending}</Text>
              <Text style={styles.statLabel}>Pending</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: appTheme.positive }]}>{stats.vouchers.completed}</Text>
              <Text style={styles.statLabel}>Completed</Text>
            </View>
          </View>
        </View>

        {/* Booking Stats */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Booking Status</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.bookings.draft}</Text>
              <Text style={styles.statLabel}>Draft</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: appTheme.indigo }]}>{stats.bookings.confirmed}</Text>
              <Text style={styles.statLabel}>Confirmed</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: appTheme.positive }]}>{stats.bookings.completed}</Text>
              <Text style={styles.statLabel}>Completed</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const createStyles = (theme: ReturnType<typeof getAppTheme>, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.jade,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      backgroundColor: theme.jade,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: '#fff',
    },
    headerSubtitle: {
      fontSize: 14,
      color: 'rgba(255,255,255,0.8)',
      marginTop: 2,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    userBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: 'rgba(255,255,255,0.2)',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
    },
    userName: {
      fontSize: 14,
      fontWeight: '500',
      color: '#fff',
    },
    logoutButton: {
      padding: 8,
      backgroundColor: 'rgba(255,255,255,0.2)',
      borderRadius: 20,
    },
    content: {
      flex: 1,
      backgroundColor: theme.bgPrimary,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
    },
    contentContainer: {
      padding: 20,
      paddingBottom: 40,
    },
    quickActions: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 24,
    },
    quickActionCard: {
      flex: 1,
      padding: 20,
      borderRadius: 16,
      backgroundColor: theme.bgCard,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
        },
        android: {
          elevation: 3,
        },
      }),
    },
    voucherCard: {
      borderLeftWidth: 4,
      borderLeftColor: theme.jade,
    },
    bookingCard: {
      borderLeftWidth: 4,
      borderLeftColor: theme.indigo,
    },
    quickActionIcon: {
      marginBottom: 12,
    },
    quickActionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.textPrimary,
      marginBottom: 4,
    },
    quickActionCount: {
      fontSize: 14,
      color: theme.textMuted,
    },
    statsSection: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.textPrimary,
      marginBottom: 12,
    },
    statsGrid: {
      flexDirection: 'row',
      gap: 12,
    },
    statCard: {
      flex: 1,
      padding: 16,
      borderRadius: 12,
      backgroundColor: theme.bgCard,
      alignItems: 'center',
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
        },
        android: {
          elevation: 2,
        },
      }),
    },
    statValue: {
      fontSize: 28,
      fontWeight: '700',
      color: theme.textPrimary,
    },
    statLabel: {
      fontSize: 12,
      color: theme.textMuted,
      marginTop: 4,
    },
  })
