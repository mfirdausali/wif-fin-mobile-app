import { useState, useEffect, useCallback } from 'react'
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'
import { ActivityIndicator, Alert, StyleSheet, View, Pressable, Text as RNText } from 'react-native'
import { YStack, XStack, Text, ScrollView } from 'tamagui'
import { ChevronLeft, User, Calendar, DollarSign, Edit3, Share2, Send, CheckCircle, Link, Image, Receipt, FileText, Trash2 } from '@tamagui/lucide-icons'
import { LinearGradient } from 'expo-linear-gradient'
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg'
import * as Haptics from 'expo-haptics'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFonts, CormorantGaramond_400Regular, CormorantGaramond_500Medium, CormorantGaramond_600SemiBold } from '@expo-google-fonts/cormorant-garamond'
import { getDocument, sharePDF, deleteDocument } from '../../../src/services'
import type { StatementOfPayment, LineItem } from '../../../src/types'
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

const GoldGlowBackground = () => (
  <Svg height="300" width="100%" style={StyleSheet.absoluteFill}>
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
        <Stop offset="0%" stopColor={COLORS.kinGold} stopOpacity="0.15" />
        <Stop offset="50%" stopColor={COLORS.kinGold} stopOpacity="0.06" />
        <Stop offset="70%" stopColor={COLORS.kinGold} stopOpacity="0" />
        <Stop offset="100%" stopColor={COLORS.kinGold} stopOpacity="0" />
      </RadialGradient>
    </Defs>
    <Rect x="0" y="0" width="100%" height="300" fill="url(#goldGlow)" />
  </Svg>
)

const getInitials = (name: string) => {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

const formatCurrency = (amount: number, currency: string = 'MYR') => {
  if (currency === 'JPY') {
    return `¥${amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  }
  return `RM ${amount.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'completed':
      return {
        bg: COLORS.midoriJadeSoft,
        text: COLORS.midoriJade,
        border: COLORS.midoriJade,
      }
    case 'issued':
      return {
        bg: COLORS.aiIndigoSoft,
        text: COLORS.aiIndigo,
        border: COLORS.aiIndigo,
      }
    default:
      return {
        bg: COLORS.kinGoldSoft,
        text: COLORS.kinGold,
        border: COLORS.kinGold,
      }
  }
}

export default function StatementOfPaymentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const currentUser = useAuthStore((state) => state.user)

  const [statement, setStatement] = useState<StatementOfPayment | null>(null)
  const [loading, setLoading] = useState(true)
  const [sharing, setSharing] = useState(false)

  const [fontsLoaded] = useFonts({
    CormorantGaramond_400Regular,
    CormorantGaramond_500Medium,
    CormorantGaramond_600SemiBold,
  })

  useEffect(() => {
    loadStatement()
  }, [id])

  const loadStatement = async () => {
    try {
      setLoading(true)
      const data = await getDocument(id, 'statement_of_payment') as StatementOfPayment | null
      setStatement(data)
    } catch (error) {
      console.error('Error loading statement of payment:', error)
      Alert.alert('Error', 'Failed to load statement of payment')
    } finally {
      setLoading(false)
    }
  }

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    router.back()
  }, [router])

  const handleEdit = useCallback(() => {
    if (!statement || !currentUser) return

    if (!canEditDocument(currentUser, statement)) {
      const message = getEditRestrictionMessage(currentUser, statement)
      Alert.alert('Cannot Edit', message || 'You cannot edit this document')
      return
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    router.push(`/document/edit/${id}?type=statement_of_payment`)
  }, [statement, currentUser, id, router])

  const handleShare = useCallback(async () => {
    if (!statement || !currentUser) return

    const canShare = canPrintDocuments(currentUser)
    if (!canShare) {
      Alert.alert('Permission Denied', 'You do not have permission to share documents')
      return
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      setSharing(true)

      // Pass printer info for "Printed by" and timestamp on PDF
      const printerInfo = {
        userName: currentUser.name || currentUser.username || 'Unknown',
        printDate: new Date().toISOString(),
      }

      await sharePDF(statement, undefined, printerInfo, {
        id: currentUser.id,
        name: currentUser.name || '',
        username: currentUser.username || '',
      })
    } catch (error) {
      console.error('Error sharing statement of payment:', error)
      Alert.alert('Error', 'Failed to share statement of payment')
    } finally {
      setSharing(false)
    }
  }, [statement, currentUser])

  const handleDelete = useCallback(() => {
    if (!statement || !currentUser) return

    Alert.alert(
      'Delete Document',
      `Delete ${statement.documentNumber}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const success = await deleteDocument(statement.id)
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
  }, [statement, currentUser, router])

  // Show skeleton while loading data (don't block on fonts - skeleton doesn't need them)
  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <InvoiceDetailSkeletonLoader paddingTop={insets.top} />
      </>
    )
  }

  if (!statement) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bgPrimary }}>
        <Text color={COLORS.textSecondary}>Statement of payment not found</Text>
      </View>
    )
  }

  const statusColors = getStatusColor(statement.status)
  const taxAmount = statement.taxRate ? statement.subtotal * (statement.taxRate / 100) : 0

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bgSecondary }}>
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
          <View style={styles.goldGlowContainer}>
            <GoldGlowBackground />
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
            <RNText style={styles.headerTitle}>Statement of Payment</RNText>
            <View style={{ width: 80 }} />
          </View>
        </LinearGradient>

        {/* Floating Amount Card - positioned to overlap header */}
        <View style={styles.amountCard}>
          <View style={styles.amountCardHeader}>
            <RNText style={styles.amountLabel}>TOTAL DEDUCTED</RNText>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: statusColors.bg },
              ]}
            >
              <View style={[styles.statusDot, { backgroundColor: statusColors.text }]} />
              <RNText
                style={[
                  styles.statusText,
                  { color: statusColors.text },
                ]}
              >
                {statement.status.toUpperCase()}
              </RNText>
            </View>
          </View>

          <RNText style={styles.amountValue}>{formatCurrency(statement.totalDeducted, statement.currency)}</RNText>

          <View style={styles.amountCardFooter}>
            <RNText style={styles.documentNumber}>{statement.documentNumber}</RNText>
            <RNText style={styles.paymentDate}>
              {formatDate(statement.paymentDate)}
            </RNText>
          </View>
        </View>
      </View>

      {/* Scrollable Content */}
      <ScrollView
        flex={1}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        <YStack padding={20} gap={16}>
          {/* Linked Voucher Section - CRITICAL: Links to authorization */}
          <View
            style={{
              backgroundColor: COLORS.bgCard,
              borderRadius: 16,
              padding: 20,
              borderWidth: 2,
              borderColor: COLORS.kinGold + '30',
            }}
          >
            <XStack alignItems="center" gap={12} marginBottom={12}>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  backgroundColor: COLORS.kinGoldSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Link size={15} color={COLORS.kinGold} />
              </View>
              <YStack flex={1}>
                <Text
                  fontFamily="CormorantGaramond_600SemiBold"
                  fontSize={18}
                  color={COLORS.textPrimary}
                >
                  Linked Voucher
                </Text>
                <Text fontSize={12} color={COLORS.textMuted} marginTop={2}>
                  Payment authorized by this voucher
                </Text>
              </YStack>
            </XStack>

            <Pressable
              onPress={() => router.push(`/document/voucher/${statement.linkedVoucherId}`)}
              style={{
                backgroundColor: COLORS.aiIndigoSoft,
                borderRadius: 12,
                padding: 16,
                borderWidth: 1,
                borderColor: COLORS.aiIndigo + '20',
              }}
            >
              <XStack alignItems="center" justifyContent="space-between">
                <YStack flex={1}>
                  <Text fontSize={12} color={COLORS.textMuted} marginBottom={4}>
                    Payment for Voucher
                  </Text>
                  <Text
                    fontFamily="CormorantGaramond_600SemiBold"
                    fontSize={16}
                    color={COLORS.aiIndigo}
                  >
                    {statement.linkedVoucherNumber}
                  </Text>
                </YStack>
                <FileText size={20} color={COLORS.aiIndigo} />
              </XStack>
            </Pressable>
          </View>

          {/* Payee Section */}
          <View
            style={{
              backgroundColor: COLORS.bgCard,
              borderRadius: 16,
              padding: 20,
              borderWidth: 1,
              borderColor: COLORS.borderSubtle,
            }}
          >
            <XStack alignItems="center" gap={12} marginBottom={16}>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  backgroundColor: COLORS.kinGoldSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <User size={15} color={COLORS.kinGold} />
              </View>
              <Text
                fontFamily="CormorantGaramond_600SemiBold"
                fontSize={18}
                color={COLORS.textPrimary}
              >
                Payee Information
              </Text>
            </XStack>

            <XStack alignItems="center" gap={12}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: COLORS.kinGoldSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 2,
                  borderColor: COLORS.kinGold,
                }}
              >
                <Text
                  fontFamily="CormorantGaramond_600SemiBold"
                  fontSize={16}
                  color={COLORS.kinGold}
                >
                  {getInitials(statement.payeeName)}
                </Text>
              </View>
              <YStack flex={1}>
                <Text fontSize={16} fontWeight="600" color={COLORS.textPrimary}>
                  {statement.payeeName}
                </Text>
                <Text fontSize={13} color={COLORS.textMuted} marginTop={2}>
                  Payment recipient
                </Text>
              </YStack>
            </XStack>
          </View>

          {/* Payment Execution Section - CRITICAL: Shows how payment was made */}
          <View
            style={{
              backgroundColor: COLORS.bgCard,
              borderRadius: 16,
              padding: 20,
              borderWidth: 1,
              borderColor: COLORS.borderSubtle,
            }}
          >
            <XStack alignItems="center" gap={12} marginBottom={16}>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  backgroundColor: COLORS.kinGoldSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Send size={15} color={COLORS.kinGold} />
              </View>
              <Text
                fontFamily="CormorantGaramond_600SemiBold"
                fontSize={18}
                color={COLORS.textPrimary}
              >
                Payment Execution
              </Text>
            </XStack>

            <YStack gap={12}>
              <XStack justifyContent="space-between">
                <Text fontSize={13} color={COLORS.textMuted}>Payment Date</Text>
                <Text fontSize={14} fontWeight="600" color={COLORS.textPrimary}>
                  {formatDate(statement.paymentDate)}
                </Text>
              </XStack>
              <XStack justifyContent="space-between">
                <Text fontSize={13} color={COLORS.textMuted}>Payment Method</Text>
                <Text fontSize={14} fontWeight="600" color={COLORS.textPrimary}>
                  {statement.paymentMethod}
                </Text>
              </XStack>
              <YStack gap={4}>
                <Text fontSize={12} color={COLORS.textMuted} textTransform="uppercase" letterSpacing={0.5}>
                  Transaction Reference
                </Text>
                <Text
                  fontSize={15}
                  fontFamily="CormorantGaramond_500Medium"
                  color={COLORS.kinGold}
                >
                  {statement.transactionReference}
                </Text>
              </YStack>
              {statement.accountName && (
                <XStack justifyContent="space-between">
                  <Text fontSize={13} color={COLORS.textMuted}>Pay From Account</Text>
                  <Text fontSize={14} fontWeight="600" color={COLORS.textPrimary}>
                    {statement.accountName}
                  </Text>
                </XStack>
              )}
            </YStack>
          </View>

          {/* Transaction Fees Section - CRITICAL: Show fee breakdown */}
          {statement.transactionFee && statement.transactionFee > 0 && (
            <View
              style={{
                backgroundColor: COLORS.shuVermillionSoft,
                borderRadius: 16,
                padding: 20,
                borderWidth: 1,
                borderColor: COLORS.shuVermillion + '30',
              }}
            >
              <XStack alignItems="center" gap={12} marginBottom={16}>
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    backgroundColor: COLORS.bgCard,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Receipt size={15} color={COLORS.shuVermillion} />
                </View>
                <YStack flex={1}>
                  <Text
                    fontFamily="CormorantGaramond_600SemiBold"
                    fontSize={18}
                    color={COLORS.textPrimary}
                  >
                    Transaction Fees
                  </Text>
                  {statement.transactionFeeType && (
                    <Text fontSize={12} color={COLORS.textMuted} marginTop={2}>
                      {statement.transactionFeeType}
                    </Text>
                  )}
                </YStack>
              </XStack>

              <YStack gap={12}>
                <XStack justifyContent="space-between">
                  <Text fontSize={13} color={COLORS.textMuted}>Payment Amount</Text>
                  <Text fontSize={14} fontWeight="600" color={COLORS.textPrimary}>
                    {formatCurrency(statement.total, statement.currency)}
                  </Text>
                </XStack>
                <XStack justifyContent="space-between">
                  <Text fontSize={13} color={COLORS.textMuted}>Transaction Fee</Text>
                  <Text fontSize={14} fontWeight="600" color={COLORS.shuVermillion}>
                    {formatCurrency(statement.transactionFee || 0, statement.currency)}
                  </Text>
                </XStack>
                <View style={{ height: 1, backgroundColor: COLORS.borderMedium, marginVertical: 4 }} />
                <XStack justifyContent="space-between" alignItems="center">
                  <Text
                    fontFamily="CormorantGaramond_600SemiBold"
                    fontSize={16}
                    color={COLORS.textPrimary}
                  >
                    Total Deducted
                  </Text>
                  <Text
                    fontFamily="CormorantGaramond_600SemiBold"
                    fontSize={18}
                    color={COLORS.kinGold}
                  >
                    {formatCurrency(statement.totalDeducted, statement.currency)}
                  </Text>
                </XStack>
              </YStack>
            </View>
          )}

          {/* Line Items Section */}
          <View
            style={{
              backgroundColor: COLORS.bgCard,
              borderRadius: 16,
              padding: 20,
              borderWidth: 1,
              borderColor: COLORS.borderSubtle,
            }}
          >
            <XStack alignItems="center" gap={12} marginBottom={16}>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  backgroundColor: COLORS.kinGoldSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <DollarSign size={15} color={COLORS.kinGold} />
              </View>
              <Text
                fontFamily="CormorantGaramond_600SemiBold"
                fontSize={18}
                color={COLORS.textPrimary}
              >
                Payment Items
              </Text>
            </XStack>

            <YStack gap={16}>
              {statement.items.map((item: LineItem, index: number) => (
                <View key={index}>
                  <YStack gap={6}>
                    <Text fontSize={15} fontWeight="600" color={COLORS.textPrimary}>
                      {item.description}
                    </Text>
                    <XStack justifyContent="space-between" alignItems="center">
                      <Text fontSize={13} color={COLORS.textMuted}>
                        {item.quantity} × {formatCurrency(item.unitPrice, statement.currency)}
                      </Text>
                      <Text fontSize={15} fontWeight="600" color={COLORS.textPrimary}>
                        {formatCurrency(item.amount, statement.currency)}
                      </Text>
                    </XStack>
                  </YStack>
                  {index < statement.items.length - 1 && (
                    <View
                      style={{
                        height: 1,
                        backgroundColor: COLORS.borderSubtle,
                        marginTop: 16,
                      }}
                    />
                  )}
                </View>
              ))}

              <View style={{ height: 1, backgroundColor: COLORS.borderMedium, marginVertical: 4 }} />

              <XStack justifyContent="space-between">
                <Text fontSize={14} color={COLORS.textMuted}>Subtotal</Text>
                <Text fontSize={15} fontWeight="600" color={COLORS.textPrimary}>
                  {formatCurrency(statement.subtotal, statement.currency)}
                </Text>
              </XStack>

              {taxAmount > 0 && (
                <XStack justifyContent="space-between">
                  <Text fontSize={14} color={COLORS.textMuted}>
                    Tax ({statement.taxRate}%)
                  </Text>
                  <Text fontSize={15} fontWeight="600" color={COLORS.textPrimary}>
                    {formatCurrency(taxAmount, statement.currency)}
                  </Text>
                </XStack>
              )}

              <View style={{ height: 1, backgroundColor: COLORS.borderMedium, marginVertical: 4 }} />

              <XStack justifyContent="space-between" alignItems="center">
                <Text
                  fontFamily="CormorantGaramond_600SemiBold"
                  fontSize={18}
                  color={COLORS.textPrimary}
                >
                  Total
                </Text>
                <Text
                  fontFamily="CormorantGaramond_600SemiBold"
                  fontSize={22}
                  color={COLORS.kinGold}
                >
                  {formatCurrency(statement.total, statement.currency)}
                </Text>
              </XStack>
            </YStack>
          </View>

          {/* Confirmation Section - CRITICAL: Shows who confirmed payment was sent */}
          <View
            style={{
              backgroundColor: COLORS.midoriJadeSoft,
              borderRadius: 16,
              padding: 20,
              borderWidth: 2,
              borderColor: COLORS.midoriJade + '30',
            }}
          >
            <XStack alignItems="center" gap={12} marginBottom={12}>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  backgroundColor: COLORS.bgCard,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CheckCircle size={15} color={COLORS.midoriJade} />
              </View>
              <YStack flex={1}>
                <Text
                  fontFamily="CormorantGaramond_600SemiBold"
                  fontSize={18}
                  color={COLORS.textPrimary}
                >
                  Payment Confirmation
                </Text>
                <Text fontSize={12} color={COLORS.textMuted} marginTop={2}>
                  Audit trail
                </Text>
              </YStack>
            </XStack>

            <YStack gap={4}>
              <Text fontSize={12} color={COLORS.textMuted} textTransform="uppercase" letterSpacing={0.5}>
                Confirmed By
              </Text>
              <Text fontSize={15} fontWeight="600" color={COLORS.midoriJade}>
                {statement.confirmedBy}
              </Text>
            </YStack>
          </View>

          {/* Transfer Proof Section - CRITICAL: Shows if bank transfer proof is attached */}
          {statement.transferProofFilename && (
            <View
              style={{
                backgroundColor: COLORS.bgCard,
                borderRadius: 16,
                padding: 20,
                borderWidth: 1,
                borderColor: COLORS.borderSubtle,
              }}
            >
              <XStack alignItems="center" gap={12} marginBottom={12}>
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    backgroundColor: COLORS.kinGoldSoft,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Image size={15} color={COLORS.kinGold} />
                </View>
                <YStack flex={1}>
                  <Text
                    fontFamily="CormorantGaramond_600SemiBold"
                    fontSize={18}
                    color={COLORS.textPrimary}
                  >
                    Transfer Proof
                  </Text>
                  <Text fontSize={12} color={COLORS.textMuted} marginTop={2}>
                    Bank transfer screenshot attached
                  </Text>
                </YStack>
              </XStack>

              <View
                style={{
                  backgroundColor: COLORS.bgSection,
                  borderRadius: 12,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: COLORS.borderSubtle,
                }}
              >
                <XStack alignItems="center" gap={12}>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 8,
                      backgroundColor: COLORS.kinGoldSoft,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Image size={18} color={COLORS.kinGold} />
                  </View>
                  <YStack flex={1}>
                    <Text fontSize={14} fontWeight="600" color={COLORS.textPrimary}>
                      {statement.transferProofFilename}
                    </Text>
                    <Text fontSize={12} color={COLORS.textMuted} marginTop={2}>
                      Proof of transfer
                    </Text>
                  </YStack>
                </XStack>
              </View>
            </View>
          )}

          {/* Notes Section */}
          {statement.notes && (
            <View
              style={{
                backgroundColor: COLORS.bgCard,
                borderRadius: 16,
                padding: 20,
                borderWidth: 1,
                borderColor: COLORS.borderSubtle,
              }}
            >
              <XStack alignItems="center" gap={12} marginBottom={12}>
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    backgroundColor: COLORS.kinGoldSoft,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <FileText size={15} color={COLORS.kinGold} />
                </View>
                <Text
                  fontFamily="CormorantGaramond_600SemiBold"
                  fontSize={18}
                  color={COLORS.textPrimary}
                >
                  Notes
                </Text>
              </XStack>
              <Text fontSize={14} color={COLORS.textSecondary} lineHeight={20}>
                {statement.notes}
              </Text>
            </View>
          )}
        </YStack>
      </ScrollView>

      {/* Action Bar */}
      <View style={[styles.actionBar, { paddingBottom: insets.bottom + 16 }]}>
        {currentUser && statement && canDeleteDocument(currentUser, statement) && (
          <Pressable
            style={styles.deleteButton}
            onPress={handleDelete}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Trash2 size={18} color={COLORS.shuVermillion} />
          </Pressable>
        )}

        {currentUser && statement && canEditDocument(currentUser, statement) && (
          <Pressable
            style={styles.editButton}
            onPress={handleEdit}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Edit3 size={18} color={COLORS.textSecondary} />
            <RNText style={styles.editButtonText}>Edit</RNText>
          </Pressable>
        )}

        {currentUser && canPrintDocuments(currentUser) && (
          <Pressable
            style={[styles.shareButton, !(currentUser && statement && canEditDocument(currentUser, statement)) && !(currentUser && statement && canDeleteDocument(currentUser, statement)) && styles.shareButtonFull]}
            onPress={handleShare}
            disabled={sharing}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {sharing ? (
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
  paymentDate: {
    fontSize: 12,
    color: COLORS.midoriJade,
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
})
