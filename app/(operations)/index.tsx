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
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { FileText, Plane, Plus, LogOut, User } from '@tamagui/lucide-icons'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import {
  useFonts,
  CormorantGaramond_400Regular,
  CormorantGaramond_500Medium,
} from '@expo-google-fonts/cormorant-garamond'
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
  const insets = useSafeAreaInsets()
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const isDark = useThemeStore((state) => state.isDarkMode)
  const appTheme = getAppTheme(isDark)

  const [fontsLoaded] = useFonts({
    CormorantGaramond_400Regular,
    CormorantGaramond_500Medium,
  })

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

  if (!fontsLoaded) {
    return <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]} />
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{
        paddingTop: insets.top + 8,
        paddingBottom: insets.bottom + 100,
      }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={appTheme.gold}
        />
      }
    >
      {/* Header - matching Finance app style */}
      <View style={styles.header}>
        <View>
          <Text style={styles.welcomeText}>Welcome back,</Text>
          <Text style={styles.headerTitle}>{user?.name || user?.username}</Text>
        </View>
        <View style={styles.avatar}>
          <LinearGradient
            colors={[appTheme.indigo, isDark ? '#4A5A75' : '#3A4A65']}
            style={styles.avatarGradient}
          >
            <Text style={styles.avatarText}>
              {(user?.name || user?.username)?.charAt(0).toUpperCase() || 'U'}
            </Text>
          </LinearGradient>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <Pressable
          style={styles.quickActionCard}
          onPress={navigateToVouchers}
        >
          <View style={[styles.quickActionIcon, { backgroundColor: appTheme.jadeSoft }]}>
            <FileText size={28} color={appTheme.jade} />
          </View>
          <Text style={styles.quickActionTitle}>Payment Vouchers</Text>
          <Text style={styles.quickActionCount}>{stats.vouchers.total} total</Text>
        </Pressable>

        <Pressable
          style={styles.quickActionCard}
          onPress={navigateToBookings}
        >
          <View style={[styles.quickActionIcon, { backgroundColor: appTheme.indigoSoft }]}>
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
  )
}

const createStyles = (theme: ReturnType<typeof getAppTheme>, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.bgPrimary,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 24,
      paddingHorizontal: 24,
    },
    welcomeText: {
      fontSize: 13,
      color: theme.textMuted,
      letterSpacing: 0.3,
      marginBottom: 4,
    },
    headerTitle: {
      fontFamily: 'CormorantGaramond_500Medium',
      fontSize: 26,
      color: theme.textPrimary,
      letterSpacing: -0.3,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 16,
      overflow: 'hidden',
    },
    avatarGradient: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarText: {
      fontSize: 18,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    quickActions: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 32,
      paddingHorizontal: 24,
    },
    quickActionCard: {
      flex: 1,
      padding: 20,
      borderRadius: 14,
      backgroundColor: theme.bgCard,
      borderWidth: 1,
      borderColor: theme.borderSubtle,
    },
    quickActionIcon: {
      width: 56,
      height: 56,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 12,
    },
    quickActionTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.textPrimary,
      marginBottom: 4,
    },
    quickActionCount: {
      fontSize: 13,
      color: theme.textMuted,
    },
    statsSection: {
      marginBottom: 32,
      paddingHorizontal: 24,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.textPrimary,
      letterSpacing: 0.3,
      marginBottom: 16,
    },
    statsGrid: {
      flexDirection: 'row',
      gap: 12,
    },
    statCard: {
      flex: 1,
      padding: 16,
      borderRadius: 14,
      backgroundColor: theme.bgCard,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.borderSubtle,
    },
    statValue: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.textPrimary,
    },
    statLabel: {
      fontSize: 11,
      color: theme.textMuted,
      marginTop: 4,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
  })
