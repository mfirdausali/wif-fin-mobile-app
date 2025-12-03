/**
 * Operations Payment Vouchers Screen
 *
 * Payment Voucher management for operations role users.
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
import { Plus, FileText, ChevronRight } from '@tamagui/lucide-icons'
import * as Haptics from 'expo-haptics'
import { useAuthStore } from '../../src/store/authStore'
import { useThemeStore } from '../../src/store/themeStore'
import { getAppTheme } from '../../src/constants/theme'
import { supabase } from '../../src/services/api/supabaseClient'
import { formatCurrency, formatDate } from '../../src/utils/formatters'

interface PaymentVoucher {
  id: string
  documentNumber: string
  amount: number
  currency: string
  status: string
  vendorName: string
  description: string
  createdAt: string
  voucherDate: string
}

export default function OperationsVouchersScreen() {
  const router = useRouter()
  const user = useAuthStore((state) => state.user)
  const isDark = useThemeStore((state) => state.isDarkMode)
  const appTheme = getAppTheme(isDark)

  const [vouchers, setVouchers] = useState<PaymentVoucher[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadVouchers = useCallback(async () => {
    if (!user?.companyId) return

    try {
      // First get documents
      const { data: docs, error: docsError } = await supabase
        .from('documents')
        .select('id, document_number, amount, currency, status, created_at, notes')
        .eq('company_id', user.companyId)
        .eq('document_type', 'payment_voucher')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })

      if (docsError) throw docsError

      if (!docs || docs.length === 0) {
        setVouchers([])
        return
      }

      // Get payment voucher details
      const docIds = docs.map(d => d.id)
      const { data: pvData, error: pvError } = await supabase
        .from('payment_vouchers')
        .select('document_id, payee_name, voucher_date')
        .in('document_id', docIds)

      if (pvError) throw pvError

      // Map payment voucher details by document_id
      const pvMap = new Map((pvData || []).map(pv => [pv.document_id, pv]))

      const formattedVouchers: PaymentVoucher[] = docs.map((doc: any) => {
        const pv = pvMap.get(doc.id)
        return {
          id: doc.id,
          documentNumber: doc.document_number,
          amount: doc.amount,
          currency: doc.currency,
          status: doc.status,
          vendorName: pv?.payee_name || 'Unknown',
          description: doc.notes || '',
          createdAt: doc.created_at,
          voucherDate: pv?.voucher_date,
        }
      })

      setVouchers(formattedVouchers)
    } catch (error) {
      console.error('Error loading vouchers:', error)
    } finally {
      setLoading(false)
    }
  }, [user?.companyId])

  useEffect(() => {
    loadVouchers()
  }, [loadVouchers])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await loadVouchers()
    setRefreshing(false)
  }, [loadVouchers])

  const handleVoucherPress = (voucher: PaymentVoucher) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    router.push(`/document/voucher/${voucher.id}`)
  }

  const handleCreateVoucher = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    router.push('/document/new?type=payment_voucher')
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return appTheme.textMuted
      case 'issued':
        return appTheme.indigo
      case 'paid':
        return appTheme.positive
      case 'completed':
        return appTheme.positive
      case 'cancelled':
        return appTheme.negative
      default:
        return appTheme.textMuted
    }
  }

  const getStatusLabel = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1)
  }

  const styles = createStyles(appTheme, isDark)

  const renderVoucher = ({ item }: { item: PaymentVoucher }) => (
    <Pressable
      style={styles.voucherCard}
      onPress={() => handleVoucherPress(item)}
    >
      <View style={styles.voucherHeader}>
        <View style={styles.voucherIcon}>
          <FileText size={20} color={appTheme.jade} />
        </View>
        <View style={styles.voucherInfo}>
          <Text style={styles.documentNumber}>{item.documentNumber}</Text>
          <Text style={styles.vendorName}>{item.vendorName}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(item.status)}20` }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {getStatusLabel(item.status)}
          </Text>
        </View>
      </View>
      <View style={styles.voucherDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Amount</Text>
          <Text style={styles.detailValue}>
            {formatCurrency(item.amount, item.currency)}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Date</Text>
          <Text style={styles.detailValue}>
            {formatDate(item.voucherDate || item.createdAt)}
          </Text>
        </View>
      </View>
      {item.description && (
        <Text style={styles.description} numberOfLines={2}>
          {item.description}
        </Text>
      )}
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
        <Text style={styles.headerTitle}>Payment Vouchers</Text>
        <Pressable
          style={styles.addButton}
          onPress={handleCreateVoucher}
        >
          <Plus size={20} color="#fff" />
          <Text style={styles.addButtonText}>New</Text>
        </Pressable>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={appTheme.jade} />
          </View>
        ) : vouchers.length === 0 ? (
          <View style={styles.emptyContainer}>
            <FileText size={48} color={appTheme.textMuted} />
            <Text style={styles.emptyTitle}>No Payment Vouchers</Text>
            <Text style={styles.emptySubtitle}>
              Create your first payment voucher
            </Text>
            <Pressable
              style={styles.emptyButton}
              onPress={handleCreateVoucher}
            >
              <Plus size={20} color="#fff" />
              <Text style={styles.emptyButtonText}>Create Voucher</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={vouchers}
            keyExtractor={(item) => item.id}
            renderItem={renderVoucher}
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
      backgroundColor: theme.jade,
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
      color: theme.textPrimary,
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
      backgroundColor: theme.jade,
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
    voucherCard: {
      backgroundColor: theme.bgCard,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      borderLeftWidth: 4,
      borderLeftColor: theme.jade,
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
    voucherHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    voucherIcon: {
      width: 40,
      height: 40,
      borderRadius: 10,
      backgroundColor: theme.jadeSoft,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    voucherInfo: {
      flex: 1,
    },
    documentNumber: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.textPrimary,
    },
    vendorName: {
      fontSize: 14,
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
    voucherDetails: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    detailRow: {
      flex: 1,
    },
    detailLabel: {
      fontSize: 12,
      color: theme.textMuted,
    },
    detailValue: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.textPrimary,
      marginTop: 2,
    },
    description: {
      fontSize: 13,
      color: theme.textMuted,
      marginTop: 8,
      lineHeight: 18,
    },
    cardFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.borderSubtle,
    },
    viewDetails: {
      fontSize: 13,
      color: theme.textMuted,
      marginRight: 4,
    },
  })
