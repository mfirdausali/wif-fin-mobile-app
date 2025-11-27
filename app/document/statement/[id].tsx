import { useState, useEffect, useCallback } from 'react'
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'
import { ActivityIndicator, Alert, StyleSheet, View, Pressable, Text as RNText } from 'react-native'
import { YStack, XStack, Text, ScrollView } from 'tamagui'
import { ChevronLeft, User, Calendar, DollarSign, Edit3, Share2, Send, CheckCircle, Link, Image, Receipt, FileText } from '@tamagui/lucide-icons'
import { LinearGradient } from 'expo-linear-gradient'
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg'
import * as Haptics from 'expo-haptics'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFonts, CormorantGaramond_400Regular, CormorantGaramond_500Medium, CormorantGaramond_600SemiBold } from '@expo-google-fonts/cormorant-garamond'
import { getDocument, sharePDF } from '../../../src/services'
import type { StatementOfPayment, LineItem } from '../../../src/types'
import { useAuthStore } from '../../../src/store/authStore'
import { canEditDocument, canPrintDocuments, getEditRestrictionMessage } from '../../../src/utils/permissions'
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
      <RadialGradient id="goldGlow" cx="50%" cy="0%">
        <Stop offset="0%" stopColor={COLORS.kinGold} stopOpacity="0.15" />
        <Stop offset="50%" stopColor={COLORS.kinGold} stopOpacity="0.05" />
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
      await sharePDF(statement)
    } catch (error) {
      console.error('Error sharing statement of payment:', error)
      Alert.alert('Error', 'Failed to share statement of payment')
    } finally {
      setSharing(false)
    }
  }, [statement, currentUser])

  if (!fontsLoaded || loading) {
    return <InvoiceDetailSkeletonLoader />
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

      {/* Dark Header with Gold Glow */}
      <View style={{ backgroundColor: COLORS.sumiInk }}>
        <GoldGlowBackground />
        <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 60 }}>
          <XStack alignItems="center" justifyContent="space-between" marginBottom={16}>
            <Pressable onPress={handleBack} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <ChevronLeft size={20} color="rgba(255,255,255,0.8)" />
              <RNText style={{ fontSize: 14, fontWeight: '500', color: 'rgba(255,255,255,0.8)' }}>Back</RNText>
            </Pressable>
            <Text
              fontFamily="CormorantGaramond_500Medium"
              fontSize={18}
              color={COLORS.textInverse}
            >
              Statement of Payment
            </Text>
            <View style={{ width: 60 }} />
          </XStack>
        </View>

        {/* Floating Amount Card - Shows Total Deducted (key number) - OVERLAPS HEADER */}
        <View
          style={{
            backgroundColor: COLORS.bgCard,
            borderRadius: 16,
            padding: 20,
            marginHorizontal: 20,
            marginTop: -40,
            marginBottom: 16,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.12,
            shadowRadius: 32,
            elevation: 12,
          }}
        >
            <XStack justifyContent="space-between" alignItems="flex-start" marginBottom={12}>
              <YStack flex={1}>
                <Text
                  fontFamily="CormorantGaramond_600SemiBold"
                  fontSize={36}
                  color={COLORS.kinGold}
                  lineHeight={42}
                >
                  {formatCurrency(statement.totalDeducted, statement.currency)}
                </Text>
                <Text fontSize={13} color={COLORS.textMuted} marginTop={2}>
                  Total Deducted
                </Text>
              </YStack>
              <View
                style={{
                  backgroundColor: statusColors.bg,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: statusColors.border + '20',
                }}
              >
                <Text fontSize={12} fontWeight="600" color={statusColors.text}>
                  {statement.status.toUpperCase()}
                </Text>
              </View>
            </XStack>

            <View style={{ height: 1, backgroundColor: COLORS.borderSubtle, marginVertical: 12 }} />

            <YStack gap={6}>
              <XStack justifyContent="space-between">
                <Text fontSize={13} color={COLORS.textMuted}>Document Number</Text>
                <Text fontSize={13} fontWeight="600" color={COLORS.textPrimary}>
                  {statement.documentNumber}
                </Text>
              </XStack>
              <XStack justifyContent="space-between">
                <Text fontSize={13} color={COLORS.textMuted}>Payment Date</Text>
                <Text fontSize={13} fontWeight="600" color={COLORS.midoriJade}>
                  {formatDate(statement.paymentDate)}
                </Text>
              </XStack>
            </YStack>
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
                  backgroundColor: COLORS.aiIndigoSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text
                  fontFamily="CormorantGaramond_600SemiBold"
                  fontSize={16}
                  color={COLORS.aiIndigo}
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
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: COLORS.bgCard,
          borderTopWidth: 1,
          borderTopColor: COLORS.borderSubtle,
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: insets.bottom + 16,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
          elevation: 10,
        }}
      >
        <XStack gap={12}>
          {currentUser && statement && canEditDocument(currentUser, statement) && (
            <Pressable
              onPress={handleEdit}
              style={{
                flex: 1,
                backgroundColor: COLORS.bgPrimary,
                borderRadius: 12,
                paddingVertical: 14,
                paddingHorizontal: 20,
                borderWidth: 1.5,
                borderColor: COLORS.borderMedium,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <Edit3 size={18} color={COLORS.textSecondary} />
              <RNText
                style={{
                  fontSize: 15,
                  fontWeight: '600',
                  color: COLORS.textSecondary,
                }}
              >
                Edit
              </RNText>
            </Pressable>
          )}

          {currentUser && canPrintDocuments(currentUser) && (
            <Pressable
              onPress={handleShare}
              disabled={sharing}
              style={{
                flex: 1,
                backgroundColor: COLORS.kinGold,
                borderRadius: 12,
                paddingVertical: 14,
                paddingHorizontal: 20,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                opacity: sharing ? 0.6 : 1,
              }}
            >
              {sharing ? (
                <ActivityIndicator size="small" color={COLORS.textInverse} />
              ) : (
                <>
                  <Share2 size={18} color={COLORS.textInverse} />
                  <RNText
                    style={{
                      fontSize: 15,
                      fontWeight: '600',
                      color: COLORS.textInverse,
                    }}
                  >
                    Share PDF
                  </RNText>
                </>
              )}
            </Pressable>
          )}
        </XStack>
      </View>
    </View>
  )
}
