import { useState, useEffect, useCallback } from 'react'
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'
import { ActivityIndicator, Alert, StyleSheet, View, Pressable, Text as RNText } from 'react-native'
import { YStack, XStack, Text, ScrollView } from 'tamagui'
import { ChevronLeft, User, Calendar, DollarSign, ChevronRight, Edit3, Share2, Receipt as ReceiptIcon, UserCheck, Link, CreditCard, FileText, Trash2 } from '@tamagui/lucide-icons'
import { LinearGradient } from 'expo-linear-gradient'
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg'
import * as Haptics from 'expo-haptics'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFonts, CormorantGaramond_400Regular, CormorantGaramond_500Medium, CormorantGaramond_600SemiBold } from '@expo-google-fonts/cormorant-garamond'
import { getDocument, sharePDF, deleteDocument } from '../../../src/services'
import type { Receipt } from '../../../src/types'
import { useAuthStore } from '../../../src/store/authStore'
import { canEditDocument, canPrintDocuments, canDeleteDocument, getEditRestrictionMessage } from '../../../src/utils/permissions'
import { InvoiceDetailSkeletonLoader } from '../../../src/components/ui/SkeletonLoader'

const COLORS = {
  sumiInk: '#1A1815',
  sumiInkLight: '#2D2A26',
  kinGold: '#B8963F',
  kinGoldSoft: 'rgba(184, 150, 63, 0.12)',
  kinGoldGlow: 'rgba(184, 150, 63, 0.15)',
  aiIndigo: '#4A5A7A',
  aiIndigoSoft: 'rgba(74, 90, 122, 0.1)',
  midoriJade: '#4A7A5A',
  midoriJadeSoft: 'rgba(74, 122, 90, 0.1)',
  shuVermillion: '#C75B4A',
  shuVermillionSoft: 'rgba(199, 91, 74, 0.1)',
  bgPrimary: '#FAF8F5',
  bgSecondary: '#F3F0EB',
  bgCard: '#FFFFFF',
  bgSection: '#F7F5F2',
  textPrimary: '#1A1815',
  textSecondary: '#5C5650',
  textMuted: '#8C8680',
  textFaint: '#B5B0A8',
  textInverse: '#FFFFFF',
  borderSubtle: 'rgba(26, 24, 21, 0.08)',
  borderMedium: 'rgba(26, 24, 21, 0.12)',
}

export default function ReceiptDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { user } = useAuthStore()

  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [loading, setLoading] = useState(true)
  const [sharingPDF, setSharingPDF] = useState(false)

  const [fontsLoaded] = useFonts({
    CormorantGaramond_400Regular,
    CormorantGaramond_500Medium,
    CormorantGaramond_600SemiBold,
  })

  useEffect(() => {
    loadReceipt()
  }, [id])

  const loadReceipt = async () => {
    if (!id) return

    try {
      setLoading(true)
      const doc = await getDocument(id, 'receipt') as Receipt | null
      setReceipt(doc)
    } catch (error) {
      console.error('Error loading receipt:', error)
      Alert.alert('Error', 'Failed to load receipt details')
    } finally {
      setLoading(false)
    }
  }

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    router.back()
  }, [router])

  const handleEdit = useCallback(() => {
    if (!receipt || !user) return

    if (!canEditDocument(user, receipt)) {
      const message = getEditRestrictionMessage(user, receipt)
      Alert.alert('Cannot Edit', message || 'You cannot edit this document')
      return
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    router.push(`/document/edit/${id}?type=receipt`)
  }, [receipt, user, id, router])

  const handleSharePDF = useCallback(async () => {
    if (!receipt || !user) return

    if (!canPrintDocuments(user)) {
      Alert.alert(
        'Permission Required',
        'You do not have permission to share documents. Please contact your administrator.'
      )
      return
    }

    try {
      setSharingPDF(true)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

      // Pass printer info for "Printed by" and timestamp on PDF
      const printerInfo = {
        userName: user.name || user.username || 'Unknown',
        printDate: new Date().toISOString(),
      }

      await sharePDF(receipt, undefined, printerInfo, {
        id: user.id,
        name: user.name || '',
        username: user.username || '',
      })
    } catch (error) {
      console.error('Error sharing PDF:', error)
      Alert.alert('Error', 'Failed to share receipt PDF')
    } finally {
      setSharingPDF(false)
    }
  }, [receipt, user])

  const handleLinkedInvoicePress = useCallback(() => {
    if (!receipt?.linkedInvoiceId) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    router.push(`/document/invoice/${receipt.linkedInvoiceId}`)
  }, [receipt, router])

  const handleDelete = useCallback(() => {
    if (!receipt || !user) return

    Alert.alert(
      'Delete Document',
      `Delete ${receipt.documentNumber}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const success = await deleteDocument(receipt.id)
              if (success) {
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
                router.back()
              } else {
                Alert.alert('Error', 'Failed to delete document')
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to delete document')
            }
          },
        },
      ]
    )
  }, [receipt, user, router])

  const formatCurrency = (amount: number, currency?: string): string => {
    const curr = currency || receipt?.currency || 'MYR'
    if (curr === 'JPY') {
      return `¥${amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
    }
    return `RM ${amount.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'issued':
        return {
          label: 'Issued',
          bgColor: COLORS.aiIndigoSoft,
          textColor: COLORS.aiIndigo
        }
      case 'completed':
        return {
          label: 'Completed',
          bgColor: COLORS.midoriJadeSoft,
          textColor: COLORS.midoriJade
        }
      default:
        return {
          label: status,
          bgColor: COLORS.kinGoldSoft,
          textColor: COLORS.kinGold
        }
    }
  }

  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .substring(0, 2)
  }

  // Show skeleton while loading data (don't block on fonts - skeleton doesn't need them)
  if (loading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <InvoiceDetailSkeletonLoader paddingTop={insets.top} />
      </View>
    )
  }

  if (!receipt) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.errorContainer}>
          <Text fontSize={16} color={COLORS.textSecondary}>
            Receipt not found
          </Text>
        </View>
      </View>
    )
  }

  const statusConfig = getStatusConfig(receipt.status)
  const canEdit = user ? canEditDocument(user, receipt) : false
  const canShare = user ? canPrintDocuments(user) : false
  const canDelete = user ? canDeleteDocument(user, receipt) : false

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Dark Header with Gold Glow */}
      <View style={styles.headerContainer}>
        <LinearGradient
          colors={[COLORS.sumiInk, COLORS.sumiInkLight]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.header, { paddingTop: insets.top }]}
        >
          {/* Gold glow - true radial gradient using SVG at top-right */}
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
            <Pressable onPress={handleBack} style={styles.backButton}>
              <ChevronLeft size={20} color="rgba(255,255,255,0.8)" />
              <RNText style={styles.backText}>Back</RNText>
            </Pressable>

            <RNText style={styles.headerTitle}>Receipt Details</RNText>

            <View style={{ width: 80 }} />
          </View>
        </LinearGradient>

        {/* Floating Amount Card - positioned to overlap header */}
        <View style={styles.amountCard}>
          <View style={styles.amountCardHeader}>
            <RNText style={styles.amountLabel}>AMOUNT RECEIVED</RNText>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: statusConfig.bgColor },
              ]}
            >
              <View style={[styles.statusDot, { backgroundColor: statusConfig.textColor }]} />
              <RNText
                style={[
                  styles.statusText,
                  { color: statusConfig.textColor },
                ]}
              >
                {statusConfig.label}
              </RNText>
            </View>
          </View>

          <RNText style={styles.amountValue}>{formatCurrency(receipt.amount)}</RNText>

          <View style={styles.amountCardFooter}>
            <RNText style={styles.documentNumber}>{receipt.documentNumber}</RNText>
            <RNText style={styles.receiptDate}>
              {formatDate(receipt.receiptDate)}
            </RNText>
          </View>
        </View>
      </View>

      <ScrollView
        flex={1}
        backgroundColor={COLORS.bgSecondary}
        showsVerticalScrollIndicator={false}
      >
        <YStack paddingHorizontal={20} paddingTop={16} paddingBottom={100} gap={20}>

          {/* Payer Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleGroup}>
                <View style={styles.sectionIcon}>
                  <User size={15} color={COLORS.kinGold} />
                </View>
                <RNText style={styles.sectionTitle}>Payer</RNText>
              </View>
            </View>
            <View style={styles.customerRow}>
              <View style={styles.customerAvatar}>
                <RNText style={styles.customerAvatarText}>
                  {getInitials(receipt.payerName)}
                </RNText>
              </View>
              <View style={styles.customerInfo}>
                <RNText style={styles.customerName}>{receipt.payerName}</RNText>
                {receipt.payerContact && (
                  <RNText style={styles.customerEmail}>{receipt.payerContact}</RNText>
                )}
              </View>
            </View>
          </View>

          {/* Linked Invoice Section */}
          {receipt.linkedInvoiceNumber && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleGroup}>
                  <View style={styles.sectionIcon}>
                    <Link size={15} color={COLORS.kinGold} />
                  </View>
                  <RNText style={styles.sectionTitle}>Linked Invoice</RNText>
                </View>
              </View>
              <Pressable
                onPress={handleLinkedInvoicePress}
                style={({ pressed }) => [
                  styles.linkedInvoiceRow,
                  pressed && styles.sectionPressed,
                ]}
              >
                <View style={styles.linkedInvoiceInfo}>
                  <RNText style={styles.linkedInvoiceLabel}>Payment for Invoice</RNText>
                  <RNText style={styles.linkedInvoiceNumber}>
                    {receipt.linkedInvoiceNumber}
                  </RNText>
                </View>
                <ChevronRight size={18} color={COLORS.aiIndigo} />
              </Pressable>
            </View>
          )}

          {/* Receipt Details Section */}
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
              <RNText style={styles.infoLabel}>Receipt Date</RNText>
              <RNText style={styles.infoValue}>{formatDate(receipt.receiptDate)}</RNText>
            </View>
            <View style={styles.infoRow}>
              <RNText style={styles.infoLabel}>Payment Method</RNText>
              <View style={styles.infoValueRow}>
                <CreditCard size={14} color={COLORS.textSecondary} />
                <RNText style={styles.infoValue}>{receipt.paymentMethod}</RNText>
              </View>
            </View>
            <View style={[styles.infoRow, styles.infoRowLast]}>
              <RNText style={styles.infoLabel}>Deposit Account</RNText>
              <RNText style={styles.infoValue}>{receipt.accountName}</RNText>
            </View>
          </View>

          {/* Received By Section - CRITICAL */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleGroup}>
                <View style={styles.sectionIcon}>
                  <UserCheck size={15} color={COLORS.kinGold} />
                </View>
                <RNText style={styles.sectionTitle}>Received By</RNText>
              </View>
            </View>
            <View style={styles.customerRow}>
              <View style={styles.customerAvatar}>
                <RNText style={styles.customerAvatarText}>
                  {getInitials(receipt.receivedBy)}
                </RNText>
              </View>
              <View style={styles.customerInfo}>
                <RNText style={styles.customerEmail}>Payment received by</RNText>
                <RNText style={styles.customerName}>{receipt.receivedBy}</RNText>
              </View>
            </View>
          </View>

          {/* Notes Section */}
          {receipt.notes && (
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
                <RNText style={styles.notesText}>{receipt.notes}</RNText>
              </View>
            </View>
          )}
        </YStack>
      </ScrollView>

      {/* Action Bar */}
      <View style={[styles.actionBar, { paddingBottom: insets.bottom + 16 }]}>
        {canDelete && (
          <Pressable
            style={styles.deleteButton}
            onPress={handleDelete}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Trash2 size={18} color={COLORS.shuVermillion} />
          </Pressable>
        )}

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
            style={[styles.shareButton, !canEdit && !canDelete && styles.shareButtonFull]}
            onPress={handleSharePDF}
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
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgSecondary,
  },
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
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 10,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    width: 80, // Fixed width for centering
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

  // Floating Amount Card - overlaps header
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
  receiptDate: {
    fontSize: 12,
    color: COLORS.textMuted,
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
  sectionPressed: {
    opacity: 0.7,
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
  },
  customerName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  customerEmail: {
    fontSize: 12,
    color: COLORS.textMuted,
  },

  // Linked Invoice Row
  linkedInvoiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    paddingHorizontal: 16,
    backgroundColor: COLORS.aiIndigoSoft,
  },
  linkedInvoiceInfo: {
    flex: 1,
  },
  linkedInvoiceLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 2,
  },
  linkedInvoiceNumber: {
    fontFamily: 'CormorantGaramond_600SemiBold',
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.aiIndigo,
  },

  // Info Rows
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    paddingHorizontal: 16,
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
  infoValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  deleteButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.shuVermillionSoft,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.shuVermillion + '30',
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

  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
})
