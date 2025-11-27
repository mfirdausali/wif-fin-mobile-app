import { useState, useEffect, useCallback } from 'react'
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'
import { ActivityIndicator, Alert, StyleSheet, View, Pressable, Text as RNText } from 'react-native'
import { YStack, XStack, Text, ScrollView } from 'tamagui'
import { ChevronLeft, User, Calendar, DollarSign, ChevronRight, Edit3, Share2, FileText } from '@tamagui/lucide-icons'
import { LinearGradient } from 'expo-linear-gradient'
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg'
import * as Haptics from 'expo-haptics'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFonts, CormorantGaramond_400Regular, CormorantGaramond_500Medium, CormorantGaramond_600SemiBold } from '@expo-google-fonts/cormorant-garamond'
import { getDocument, sharePDF } from '../../../src/services'
import type { Invoice, LineItem } from '../../../src/types'
import { useAuthStore } from '../../../src/store/authStore'
import { canEditDocument, canPrintDocuments, getEditRestrictionMessage } from '../../../src/utils/permissions'
import { InvoiceDetailSkeletonLoader } from '../../../src/components/ui/SkeletonLoader'

// WIF Japan Design System Colors
const COLORS = {
  // Core
  sumiInk: '#1A1815',
  sumiInkLight: '#2D2A26',

  // Accents
  kinGold: '#B8963F',
  kinGoldSoft: 'rgba(184, 150, 63, 0.12)',
  kinGoldGlow: 'rgba(184, 150, 63, 0.15)',

  aiIndigo: '#4A5A7A',
  aiIndigoSoft: 'rgba(74, 90, 122, 0.1)',

  midoriJade: '#4A7A5A',
  midoriJadeSoft: 'rgba(74, 122, 90, 0.1)',

  shuVermillion: '#C75B4A',
  shuVermillionSoft: 'rgba(199, 91, 74, 0.1)',

  // Backgrounds
  bgPrimary: '#FAF8F5',
  bgSecondary: '#F3F0EB',
  bgCard: '#FFFFFF',
  bgSection: '#F7F5F2',

  // Text
  textPrimary: '#1A1815',
  textSecondary: '#5C5650',
  textMuted: '#8C8680',
  textFaint: '#B5B0A8',
  textInverse: '#FFFFFF',

  // Borders
  borderSubtle: 'rgba(26, 24, 21, 0.08)',
  borderMedium: 'rgba(26, 24, 21, 0.12)',
}

export default function InvoiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const user = useAuthStore((state) => state.user)

  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [sharingPDF, setSharingPDF] = useState(false)

  const [fontsLoaded] = useFonts({
    CormorantGaramond_400Regular,
    CormorantGaramond_500Medium,
    CormorantGaramond_600SemiBold,
  })

  const loadInvoice = useCallback(async () => {
    if (!id) return

    try {
      setLoading(true)
      const doc = await getDocument(id, 'invoice') as Invoice | null
      setInvoice(doc)
    } catch (error) {
      console.error('Error loading invoice:', error)
      Alert.alert('Error', 'Failed to load invoice')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadInvoice()
  }, [loadInvoice])

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    router.back()
  }, [router])

  const handleEdit = useCallback(() => {
    if (!invoice || !user) return

    if (!canEditDocument(user, invoice)) {
      const message = getEditRestrictionMessage(user, invoice)
      Alert.alert('Cannot Edit', message || 'You cannot edit this document')
      return
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    router.push(`/document/edit/${invoice.id}?type=invoice`)
  }, [invoice, user, router])

  const handleShare = useCallback(async () => {
    if (!invoice || !user) return

    if (!canPrintDocuments(user)) {
      Alert.alert('Access Restricted', 'You do not have permission to share PDFs')
      return
    }

    try {
      setSharingPDF(true)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      await sharePDF(invoice)
    } catch (error) {
      console.error('Error sharing PDF:', error)
      Alert.alert('Error', 'Failed to share PDF')
    } finally {
      setSharingPDF(false)
    }
  }, [invoice, user])

  const getStatusColor = (status: string, isOverdue: boolean) => {
    if (isOverdue) return COLORS.shuVermillion
    switch (status) {
      case 'paid':
        return COLORS.midoriJade
      case 'issued':
        return COLORS.aiIndigo
      case 'cancelled':
        return COLORS.textMuted
      default:
        return COLORS.textSecondary
    }
  }

  const getStatusBackground = (status: string, isOverdue: boolean) => {
    if (isOverdue) return COLORS.shuVermillionSoft
    switch (status) {
      case 'paid':
        return COLORS.midoriJadeSoft
      case 'issued':
        return COLORS.aiIndigoSoft
      case 'cancelled':
        return 'rgba(140, 134, 128, 0.1)'
      default:
        return COLORS.kinGoldSoft
    }
  }

  const getStatusLabel = (status: string, isOverdue: boolean) => {
    if (isOverdue) return 'Overdue'
    return status.charAt(0).toUpperCase() + status.slice(1)
  }

  const formatCurrency = (amount: number, currency?: string) => {
    const curr = currency || invoice?.currency || 'MYR'
    if (curr === 'JPY') {
      return `¥${amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
    }
    return `RM ${amount.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const getInitials = (name: string) => {
    const parts = name.trim().split(' ')
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  if (!fontsLoaded || loading) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen
          options={{
            headerShown: false,
          }}
        />
        <InvoiceDetailSkeletonLoader />
      </View>
    )
  }

  if (!invoice) {
    return (
      <View style={styles.errorContainer}>
        <Stack.Screen
          options={{
            headerShown: false,
          }}
        />
        <FileText size={48} color={COLORS.textMuted} />
        <RNText style={styles.errorText}>Invoice not found</RNText>
        <Pressable style={styles.errorBackButton} onPress={handleBack}>
          <RNText style={styles.errorBackButtonText}>Go Back</RNText>
        </Pressable>
      </View>
    )
  }

  const isOverdue = invoice.status !== 'paid' &&
                    invoice.status !== 'cancelled' &&
                    new Date(invoice.dueDate) < new Date()

  const taxAmount = invoice.taxRate ? invoice.subtotal * (invoice.taxRate / 100) : 0
  const canEdit = user && canEditDocument(user, invoice)
  const canShare = user && canPrintDocuments(user)

  return (
    <YStack flex={1} backgroundColor={COLORS.bgSecondary}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      {/* Header Container - wraps both header and floating card */}
      <View style={styles.headerContainer}>
        {/* Dark Header with Gold Glow */}
        <LinearGradient
          colors={[COLORS.sumiInk, COLORS.sumiInkLight]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.header, { paddingTop: insets.top }]}
        >
          {/* Gold glow - true radial gradient using SVG */}
          <View style={styles.goldGlowContainer}>
            <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
              <Defs>
                <RadialGradient
                  id="goldGlow"
                  cx="85%"
                  cy="35%"
                  rx="70%"
                  ry="60%"
                  fx="85%"
                  fy="35%"
                >
                  <Stop offset="0%" stopColor="#B8963F" stopOpacity="0.15" />
                  <Stop offset="50%" stopColor="#B8963F" stopOpacity="0.06" />
                  <Stop offset="70%" stopColor="#B8963F" stopOpacity="0" />
                  <Stop offset="100%" stopColor="#B8963F" stopOpacity="0" />
                </RadialGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" fill="url(#goldGlow)" />
            </Svg>
          </View>

          <View style={styles.headerNav}>
            <Pressable
              onPress={handleBack}
              style={styles.backButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <ChevronLeft size={20} color="rgba(255,255,255,0.8)" />
              <RNText style={styles.backText}>Back</RNText>
            </Pressable>
            <RNText style={styles.headerTitle}>Invoice Details</RNText>
            <View style={{ width: 80 }} />
          </View>
        </LinearGradient>

        {/* Floating Amount Card - positioned to overlap header */}
        <View style={styles.amountCard}>
          <View style={styles.amountCardHeader}>
            <RNText style={styles.amountLabel}>TOTAL AMOUNT</RNText>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: getStatusBackground(invoice.status, isOverdue) },
              ]}
            >
              <View style={[styles.statusDot, { backgroundColor: getStatusColor(invoice.status, isOverdue) }]} />
              <RNText
                style={[
                  styles.statusText,
                  { color: getStatusColor(invoice.status, isOverdue) },
                ]}
              >
                {getStatusLabel(invoice.status, isOverdue)}
              </RNText>
            </View>
          </View>

          <RNText style={styles.amountValue}>{formatCurrency(invoice.total)}</RNText>

          <View style={styles.amountCardFooter}>
            <RNText style={styles.documentNumber}>{invoice.documentNumber}</RNText>
            <RNText
              style={[
                styles.dueDate,
                isOverdue && styles.overdueText,
              ]}
            >
              Due: {formatDate(invoice.dueDate)}
            </RNText>
          </View>
        </View>
      </View>

      <ScrollView
        flex={1}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      >
        {/* Content */}
        <View style={styles.content}>
          {/* Customer Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleGroup}>
                <View style={styles.sectionIcon}>
                  <User size={15} color={COLORS.kinGold} />
                </View>
                <RNText style={styles.sectionTitle}>Customer</RNText>
              </View>
            </View>

            <View style={styles.customerRow}>
              <View style={styles.customerAvatar}>
                <RNText style={styles.customerAvatarText}>
                  {getInitials(invoice.customerName)}
                </RNText>
              </View>
              <View style={styles.customerInfo}>
                <RNText style={styles.customerName}>{invoice.customerName}</RNText>
                {invoice.customerEmail && (
                  <RNText style={styles.customerDetail}>{invoice.customerEmail}</RNText>
                )}
                {invoice.customerAddress && (
                  <RNText style={styles.customerDetail}>{invoice.customerAddress}</RNText>
                )}
              </View>
              <ChevronRight size={18} color={COLORS.textFaint} />
            </View>
          </View>

          {/* Invoice Details Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleGroup}>
                <View style={styles.sectionIcon}>
                  <Calendar size={15} color={COLORS.kinGold} />
                </View>
                <RNText style={styles.sectionTitle}>Details</RNText>
              </View>
            </View>

            <View style={styles.infoRow}>
              <RNText style={styles.infoLabel}>Invoice Date</RNText>
              <RNText style={styles.infoValue}>{formatDate(invoice.invoiceDate)}</RNText>
            </View>

            <View style={styles.infoRow}>
              <RNText style={styles.infoLabel}>Due Date</RNText>
              <RNText
                style={[
                  styles.infoValue,
                  isOverdue && styles.overdueText,
                ]}
              >
                {formatDate(invoice.dueDate)}
              </RNText>
            </View>

            {invoice.paymentTerms && (
              <View style={styles.infoRow}>
                <RNText style={styles.infoLabel}>Payment Terms</RNText>
                <RNText style={styles.infoValue}>{invoice.paymentTerms}</RNText>
              </View>
            )}

            {invoice.accountName && (
              <View style={[styles.infoRow, styles.infoRowLast]}>
                <RNText style={styles.infoLabel}>Receiving Account</RNText>
                <RNText style={styles.infoValue}>{invoice.accountName}</RNText>
              </View>
            )}
          </View>

          {/* Line Items Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleGroup}>
                <View style={styles.sectionIcon}>
                  <DollarSign size={15} color={COLORS.kinGold} />
                </View>
                <RNText style={styles.sectionTitle}>Line Items</RNText>
              </View>
              <RNText style={styles.sectionCount}>{invoice.items.length} items</RNText>
            </View>

            {invoice.items.map((item: LineItem, index: number) => (
              <View
                key={index}
                style={[
                  styles.itemRow,
                  index === invoice.items.length - 1 && styles.itemRowLast,
                ]}
              >
                <View style={styles.itemLeft}>
                  <RNText style={styles.itemDescription}>{item.description}</RNText>
                  <RNText style={styles.itemDetail}>
                    {item.quantity} × {formatCurrency(item.unitPrice)}
                  </RNText>
                </View>
                <RNText style={styles.itemAmount}>
                  {formatCurrency(item.quantity * item.unitPrice)}
                </RNText>
              </View>
            ))}

            {/* Totals */}
            <View style={styles.totals}>
              <View style={styles.totalRow}>
                <RNText style={styles.totalLabel}>Subtotal</RNText>
                <RNText style={styles.totalValue}>{formatCurrency(invoice.subtotal)}</RNText>
              </View>

              {invoice.taxRate && invoice.taxRate > 0 && (
                <View style={styles.totalRow}>
                  <RNText style={styles.totalLabel}>Tax ({invoice.taxRate}%)</RNText>
                  <RNText style={styles.totalValue}>{formatCurrency(taxAmount)}</RNText>
                </View>
              )}

              <View style={styles.grandTotalRow}>
                <RNText style={styles.grandTotalLabel}>Total</RNText>
                <RNText style={styles.grandTotalValue}>{formatCurrency(invoice.total)}</RNText>
              </View>
            </View>
          </View>

          {/* Notes Section */}
          {invoice.notes && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleGroup}>
                  <View style={styles.sectionIcon}>
                    <FileText size={15} color={COLORS.kinGold} />
                  </View>
                  <RNText style={styles.sectionTitle}>Notes</RNText>
                </View>
              </View>
              <View style={styles.notesContent}>
                <RNText style={styles.notesText}>{invoice.notes}</RNText>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Action Bar */}
      <View style={[styles.actionBar, { paddingBottom: insets.bottom + 16 }]}>
        {canEdit && (
          <Pressable
            style={styles.editButton}
            onPress={handleEdit}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Edit3 size={18} color={COLORS.textSecondary} />
            <RNText style={styles.editButtonText}>Edit</RNText>
          </Pressable>
        )}

        {canShare && (
          <Pressable
            style={[styles.shareButton, !canEdit && styles.shareButtonFull]}
            onPress={handleShare}
            disabled={sharingPDF}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {sharingPDF ? (
              <ActivityIndicator size="small" color={COLORS.textInverse} />
            ) : (
              <>
                <Share2 size={18} color={COLORS.textInverse} />
                <RNText style={styles.shareButtonText}>Share PDF</RNText>
              </>
            )}
          </Pressable>
        )}
      </View>
    </YStack>
  )
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.bgPrimary,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: COLORS.bgPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.textSecondary,
    marginTop: 16,
    marginBottom: 24,
  },
  errorBackButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: COLORS.kinGold,
    borderRadius: 8,
  },
  errorBackButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textInverse,
  },

  // Header Container
  headerContainer: {
    zIndex: 10,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 80, // Extended padding for card overlap
    position: 'relative',
  },
  goldGlowContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  headerNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    marginTop: 10,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    width: 80,
  },
  backText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.8)',
  },
  headerTitle: {
    fontFamily: 'CormorantGaramond_500Medium',
    fontSize: 18,
    fontWeight: '500',
    color: COLORS.textInverse,
    textAlign: 'center',
    letterSpacing: 0.4,
  },

  // Floating Amount Card
  amountCard: {
    backgroundColor: COLORS.bgCard,
    marginHorizontal: 16,
    marginTop: -60, // Pull up significantly into header area
    marginBottom: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: COLORS.sumiInk,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 32,
    elevation: 12,
  },
  amountCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  amountLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.textMuted,
    letterSpacing: 0.5,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  amountValue: {
    fontFamily: 'CormorantGaramond_600SemiBold',
    fontSize: 32,
    color: COLORS.textPrimary,
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  amountCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  documentNumber: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  dueDate: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  overdueText: {
    color: COLORS.shuVermillion,
  },

  // Content
  content: {
    padding: 16,
    paddingTop: 0, // No top padding since card has marginBottom
  },

  // Section Card
  section: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: COLORS.sumiInk,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    paddingHorizontal: 16,
    backgroundColor: COLORS.bgSection,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
  },
  sectionTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionIcon: {
    width: 28,
    height: 28,
    backgroundColor: COLORS.kinGoldSoft,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  sectionCount: {
    fontSize: 12,
    color: COLORS.textMuted,
  },

  // Customer Row
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    paddingHorizontal: 16,
  },
  customerAvatar: {
    width: 48,
    height: 48,
    backgroundColor: COLORS.kinGoldSoft,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.kinGold,
  },
  customerAvatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.kinGold,
  },
  customerInfo: {
    flex: 1,
    gap: 2,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  customerDetail: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },

  // Info Rows
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
  },
  infoRowLast: {
    borderBottomWidth: 0,
  },
  infoLabel: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },

  // Item Rows
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
  },
  itemRowLast: {
    borderBottomWidth: 0,
  },
  itemLeft: {
    flex: 1,
    paddingRight: 12,
  },
  itemDescription: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  itemDetail: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  itemAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },

  // Totals
  totals: {
    backgroundColor: COLORS.bgSection,
    paddingTop: 8,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  totalLabel: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  totalValue: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  grandTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 4,
    borderTopWidth: 2,
    borderTopColor: COLORS.kinGold,
    backgroundColor: COLORS.kinGoldSoft,
  },
  grandTotalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  grandTotalValue: {
    fontFamily: 'CormorantGaramond_600SemiBold',
    fontSize: 22,
    color: COLORS.kinGold,
  },

  // Notes
  notesContent: {
    padding: 14,
    paddingHorizontal: 16,
  },
  notesText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },

  // Action Bar
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: COLORS.bgCard,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
    flexDirection: 'row',
    gap: 12,
  },
  editButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    backgroundColor: COLORS.bgPrimary,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.borderMedium,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  shareButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    backgroundColor: COLORS.sumiInk,
    borderRadius: 10,
  },
  shareButtonFull: {
    flex: 1,
  },
  shareButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textInverse,
  },
})
