import { useState, useEffect, useCallback } from 'react'
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'
import { ActivityIndicator, Alert, StyleSheet, View, Pressable, Text as RNText } from 'react-native'
import { YStack, XStack, Text, ScrollView } from 'tamagui'
import { ChevronLeft, User, Calendar, DollarSign, ChevronRight, Edit3, Share2, Building2, CheckCircle, Clock, FileCheck, Trash2 } from '@tamagui/lucide-icons'
import { LinearGradient } from 'expo-linear-gradient'
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg'
import * as Haptics from 'expo-haptics'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFonts, CormorantGaramond_400Regular, CormorantGaramond_500Medium, CormorantGaramond_600SemiBold } from '@expo-google-fonts/cormorant-garamond'
import { getDocument, sharePDF, deleteDocument, checkCanDeleteDocument } from '../../../src/services'
import type { PaymentVoucher, LineItem, UserReference } from '../../../src/types'
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

const getUserName = (user: string | UserReference | undefined): string => {
  if (!user) return 'Not assigned'
  if (typeof user === 'string') return user
  return user.name || user.email || 'Unknown'
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
    case 'draft':
    default:
      return {
        bg: COLORS.kinGoldSoft,
        text: COLORS.kinGold,
        border: COLORS.kinGold,
      }
  }
}

const getApprovalStatus = (voucher: PaymentVoucher) => {
  if (voucher.approvedBy && voucher.approvalDate) {
    return {
      status: 'Approved',
      color: COLORS.midoriJade,
      bg: COLORS.midoriJadeSoft,
      icon: CheckCircle,
    }
  }
  return {
    status: 'Pending Approval',
    color: COLORS.kinGold,
    bg: COLORS.kinGoldSoft,
    icon: Clock,
  }
}

export default function PaymentVoucherDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const currentUser = useAuthStore((state) => state.user)

  const [voucher, setVoucher] = useState<PaymentVoucher | null>(null)
  const [loading, setLoading] = useState(true)
  const [sharing, setSharing] = useState(false)

  const [fontsLoaded] = useFonts({
    CormorantGaramond_400Regular,
    CormorantGaramond_500Medium,
    CormorantGaramond_600SemiBold,
  })

  useEffect(() => {
    loadVoucher()
  }, [id])

  const loadVoucher = async () => {
    try {
      setLoading(true)
      const data = await getDocument(id, 'payment_voucher') as PaymentVoucher | null
      setVoucher(data)
    } catch (error) {
      console.error('Error loading payment voucher:', error)
      Alert.alert('Error', 'Failed to load payment voucher')
    } finally {
      setLoading(false)
    }
  }

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    router.back()
  }, [router])

  const handleEdit = useCallback(() => {
    if (!voucher || !currentUser) return

    if (!canEditDocument(currentUser, voucher)) {
      const message = getEditRestrictionMessage(currentUser, voucher)
      Alert.alert('Cannot Edit', message || 'You cannot edit this document')
      return
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    router.push(`/document/edit/${id}?type=payment_voucher`)
  }, [voucher, currentUser, id, router])

  const handleShare = useCallback(async () => {
    if (!voucher || !currentUser) return

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

      await sharePDF(voucher, undefined, printerInfo, {
        id: currentUser.id,
        name: currentUser.name || '',
        username: currentUser.username || '',
      })
    } catch (error) {
      console.error('Error sharing payment voucher:', error)
      Alert.alert('Error', 'Failed to share payment voucher')
    } finally {
      setSharing(false)
    }
  }, [voucher, currentUser])

  const handleDelete = useCallback(async () => {
    if (!voucher || !currentUser) return

    if (!canDeleteDocument(currentUser, voucher)) {
      Alert.alert('Permission Denied', 'You do not have permission to delete documents')
      return
    }

    // Pre-delete validation: Check if Payment Voucher can be deleted
    try {
      const validation = await checkCanDeleteDocument(voucher.id)
      if (!validation.canDelete) {
        Alert.alert('Cannot Delete', validation.reason || 'This document cannot be deleted')
        return
      }
    } catch (error) {
      console.error('Error validating deletion:', error)
      Alert.alert('Error', 'Failed to validate deletion')
      return
    }

    Alert.alert(
      'Delete Payment Voucher',
      `Delete ${voucher.documentNumber}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const success = await deleteDocument(voucher.id)
              if (success) {
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
                router.back()
              } else {
                Alert.alert('Error', 'Failed to delete payment voucher')
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to delete payment voucher')
            }
          },
        },
      ]
    )
  }, [voucher, currentUser, router])

  // Show skeleton while loading data (don't block on fonts - skeleton doesn't need them)
  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <InvoiceDetailSkeletonLoader paddingTop={insets.top} />
      </>
    )
  }

  if (!voucher) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bgPrimary }}>
        <Text color={COLORS.textSecondary}>Payment voucher not found</Text>
      </View>
    )
  }

  const statusColors = getStatusColor(voucher.status)
  const approvalStatus = getApprovalStatus(voucher)
  const taxAmount = voucher.taxRate ? voucher.subtotal * (voucher.taxRate / 100) : 0

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bgPrimary }}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      {/* Dark Header with Gold Glow */}
      <View style={styles.headerContainer}>
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
            <RNText style={styles.headerTitle}>Payment Voucher</RNText>
            <View style={{ width: 80 }} />
          </View>
        </LinearGradient>
      </View>

      {/* Floating Amount Card - positioned to overlap header */}
      <View style={styles.amountCard}>
        <View style={styles.amountCardHeader}>
          <RNText style={styles.amountLabel}>TOTAL AMOUNT</RNText>
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
              {voucher.status.toUpperCase()}
            </RNText>
          </View>
        </View>

        <RNText style={styles.amountValue}>{formatCurrency(voucher.total, voucher.currency)}</RNText>

        <View style={styles.amountCardFooter}>
          <RNText style={styles.documentNumber}>{voucher.documentNumber}</RNText>
          {voucher.paymentDueDate && (
            <RNText style={styles.dueDate}>
              Due: {formatDate(voucher.paymentDueDate)}
            </RNText>
          )}
        </View>
      </View>

      {/* Scrollable Content */}
      <ScrollView
        flex={1}
        backgroundColor={COLORS.bgSecondary}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        <YStack padding={20} gap={16} paddingTop={4}>
          {/* Payee Section */}
          <View
            style={{
              backgroundColor: COLORS.bgCard,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: COLORS.borderSubtle,
              overflow: 'hidden',
            }}
          >
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              paddingHorizontal: 16,
              paddingVertical: 14,
              backgroundColor: COLORS.bgSection,
              borderBottomWidth: 1,
              borderBottomColor: COLORS.borderSubtle,
            }}>
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
              <Text fontSize={13} fontWeight="600" color={COLORS.textPrimary}>
                Payee Information
              </Text>
            </View>

            <View style={{ padding: 14, paddingHorizontal: 16 }}>
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
                  <Text fontSize={16} fontWeight="600" color={COLORS.kinGold}>
                    {getInitials(voucher.payeeName)}
                  </Text>
                </View>
                <YStack flex={1}>
                  <Text fontSize={14} fontWeight="600" color={COLORS.textPrimary} marginBottom={2}>
                    {voucher.payeeName}
                  </Text>
                  {voucher.payeeAddress && (
                    <Text fontSize={12} color={COLORS.textMuted}>
                      {voucher.payeeAddress}
                    </Text>
                  )}
                </YStack>
                <ChevronRight size={18} color={COLORS.textFaint} />
              </XStack>
            </View>
          </View>

          {/* Bank Details Section - CRITICAL for payment authorization */}
          {(voucher.payeeBankName || voucher.payeeBankAccount) && (
            <View
              style={{
                backgroundColor: COLORS.bgCard,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: COLORS.kinGold + '30',
                overflow: 'hidden',
              }}
            >
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingHorizontal: 16,
                paddingVertical: 14,
                backgroundColor: COLORS.bgSection,
                borderBottomWidth: 1,
                borderBottomColor: COLORS.borderSubtle,
              }}>
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
                  <Building2 size={15} color={COLORS.kinGold} />
                </View>
                <Text fontSize={13} fontWeight="600" color={COLORS.textPrimary}>
                  Bank Details
                </Text>
              </View>

              <YStack gap={12} padding={16}>
                {voucher.payeeBankName && (
                  <YStack gap={4}>
                    <Text fontSize={12} color={COLORS.textMuted} textTransform="uppercase" letterSpacing={0.5}>
                      Bank Name
                    </Text>
                    <Text fontSize={15} fontWeight="600" color={COLORS.textPrimary}>
                      {voucher.payeeBankName}
                    </Text>
                  </YStack>
                )}
                {voucher.payeeBankAccount && (
                  <YStack gap={4}>
                    <Text fontSize={12} color={COLORS.textMuted} textTransform="uppercase" letterSpacing={0.5}>
                      Account Number
                    </Text>
                    <Text fontSize={18} fontFamily="CormorantGaramond_600SemiBold" color={COLORS.kinGold}>
                      {voucher.payeeBankAccount}
                    </Text>
                  </YStack>
                )}
              </YStack>
            </View>
          )}

          {/* Voucher Details Section */}
          <View
            style={{
              backgroundColor: COLORS.bgCard,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: COLORS.borderSubtle,
              overflow: 'hidden',
            }}
          >
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              paddingHorizontal: 16,
              paddingVertical: 14,
              backgroundColor: COLORS.bgSection,
              borderBottomWidth: 1,
              borderBottomColor: COLORS.borderSubtle,
            }}>
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
                <Calendar size={15} color={COLORS.kinGold} />
              </View>
              <Text fontSize={13} fontWeight="600" color={COLORS.textPrimary}>
                Voucher Details
              </Text>
            </View>

            <YStack gap={12} padding={16}>
              <View style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingVertical: 2,
              }}>
                <Text fontSize={13} color={COLORS.textMuted}>Voucher Date</Text>
                <Text fontSize={13} fontWeight="500" color={COLORS.textPrimary}>
                  {formatDate(voucher.voucherDate)}
                </Text>
              </View>
              {voucher.paymentDueDate && (
                <View style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingVertical: 2,
                }}>
                  <Text fontSize={13} color={COLORS.textMuted}>Payment Due Date</Text>
                  <Text fontSize={13} fontWeight="500" color={COLORS.textPrimary}>
                    {formatDate(voucher.paymentDueDate)}
                  </Text>
                </View>
              )}
              {voucher.purpose && (
                <YStack gap={4} paddingTop={4}>
                  <Text fontSize={12} color={COLORS.textMuted} textTransform="uppercase" letterSpacing={0.5}>
                    Purpose
                  </Text>
                  <Text fontSize={13} color={COLORS.textPrimary} lineHeight={20}>
                    {voucher.purpose}
                  </Text>
                </YStack>
              )}
              {voucher.accountName && (
                <View style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingVertical: 2,
                }}>
                  <Text fontSize={13} color={COLORS.textMuted}>Pay From Account</Text>
                  <Text fontSize={13} fontWeight="500" color={COLORS.textPrimary}>
                    {voucher.accountName}
                  </Text>
                </View>
              )}
            </YStack>
          </View>

          {/* Approval Workflow Section - CRITICAL for internal authorization */}
          <View
            style={{
              backgroundColor: COLORS.bgCard,
              borderRadius: 12,
              borderWidth: 2,
              borderColor: approvalStatus.color + '30',
              overflow: 'hidden',
            }}
          >
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              paddingHorizontal: 16,
              paddingVertical: 14,
              backgroundColor: approvalStatus.bg,
              borderBottomWidth: 1,
              borderBottomColor: COLORS.borderSubtle,
            }}>
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
                <approvalStatus.icon size={15} color={approvalStatus.color} />
              </View>
              <YStack flex={1}>
                <Text fontSize={13} fontWeight="600" color={COLORS.textPrimary}>
                  Approval Workflow
                </Text>
                <XStack alignItems="center" gap={6} marginTop={2}>
                  <View
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: approvalStatus.color,
                    }}
                  />
                  <Text fontSize={11} fontWeight="600" color={approvalStatus.color} textTransform="uppercase">
                    {approvalStatus.status}
                  </Text>
                </XStack>
              </YStack>
            </View>

            <YStack gap={12} padding={16}>
              <YStack gap={4}>
                <Text fontSize={12} color={COLORS.textMuted} textTransform="uppercase" letterSpacing={0.5}>
                  Requested By
                </Text>
                <Text fontSize={15} fontWeight="600" color={COLORS.textPrimary}>
                  {voucher.requestedBy}
                </Text>
              </YStack>

              {voucher.approvedBy && (
                <>
                  <View style={{ height: 1, backgroundColor: COLORS.borderSubtle }} />
                  <YStack gap={4}>
                    <Text fontSize={12} color={COLORS.textMuted} textTransform="uppercase" letterSpacing={0.5}>
                      Approved By
                    </Text>
                    <Text fontSize={15} fontWeight="600" color={COLORS.midoriJade}>
                      {getUserName(voucher.approvedBy)}
                    </Text>
                  </YStack>
                </>
              )}

              {voucher.approvalDate && (
                <YStack gap={4}>
                  <Text fontSize={12} color={COLORS.textMuted} textTransform="uppercase" letterSpacing={0.5}>
                    Approval Date
                  </Text>
                  <Text fontSize={14} color={COLORS.textPrimary}>
                    {formatDate(voucher.approvalDate)}
                  </Text>
                </YStack>
              )}
            </YStack>
          </View>

          {/* Line Items Section */}
          <View
            style={{
              backgroundColor: COLORS.bgCard,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: COLORS.borderSubtle,
              overflow: 'hidden',
            }}
          >
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingHorizontal: 16,
              paddingVertical: 14,
              backgroundColor: COLORS.bgSection,
              borderBottomWidth: 1,
              borderBottomColor: COLORS.borderSubtle,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
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
                <Text fontSize={13} fontWeight="600" color={COLORS.textPrimary}>
                  Line Items
                </Text>
              </View>
              <Text fontSize={12} color={COLORS.textMuted}>{voucher.items.length} items</Text>
            </View>

            <YStack gap={0}>
              {voucher.items.map((item: LineItem, index: number) => (
                <View
                  key={index}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    borderBottomWidth: index < voucher.items.length - 1 ? 1 : 0,
                    borderBottomColor: COLORS.borderSubtle,
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text fontSize={14} fontWeight="500" color={COLORS.textPrimary} flex={1} paddingRight={12}>
                      {item.description}
                    </Text>
                    <Text fontSize={14} fontWeight="600" color={COLORS.textPrimary}>
                      {formatCurrency(item.amount, voucher.currency)}
                    </Text>
                  </View>
                  <Text fontSize={12} color={COLORS.textMuted}>
                    {item.quantity} × {formatCurrency(item.unitPrice, voucher.currency)}
                  </Text>
                </View>
              ))}

              <View style={{ backgroundColor: COLORS.bgSection, paddingTop: 8 }}>
                <View style={{ paddingHorizontal: 16, paddingVertical: 6, flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text fontSize={13} color={COLORS.textMuted}>Subtotal</Text>
                  <Text fontSize={13} fontWeight="500" color={COLORS.textSecondary}>
                    {formatCurrency(voucher.subtotal, voucher.currency)}
                  </Text>
                </View>

                {taxAmount > 0 && (
                  <View style={{ paddingHorizontal: 16, paddingVertical: 6, flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text fontSize={13} color={COLORS.textMuted}>
                      Tax ({voucher.taxRate}%)
                    </Text>
                    <Text fontSize={13} fontWeight="500" color={COLORS.textSecondary}>
                      {formatCurrency(taxAmount, voucher.currency)}
                    </Text>
                  </View>
                )}

                <View style={{
                  backgroundColor: COLORS.kinGoldSoft,
                  borderTopWidth: 2,
                  borderTopColor: COLORS.kinGold,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <Text fontSize={14} fontWeight="600" color={COLORS.textPrimary}>
                    Total
                  </Text>
                  <Text
                    fontFamily="CormorantGaramond_600SemiBold"
                    fontSize={22}
                    color={COLORS.kinGold}
                  >
                    {formatCurrency(voucher.total, voucher.currency)}
                  </Text>
                </View>
              </View>
            </YStack>
          </View>

          {/* Notes Section */}
          {voucher.notes && (
            <View
              style={{
                backgroundColor: COLORS.bgCard,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: COLORS.borderSubtle,
                overflow: 'hidden',
              }}
            >
              <View style={{
                paddingHorizontal: 16,
                paddingVertical: 14,
                backgroundColor: COLORS.bgSection,
                borderBottomWidth: 1,
                borderBottomColor: COLORS.borderSubtle,
              }}>
                <Text fontSize={13} fontWeight="600" color={COLORS.textPrimary}>
                  Notes
                </Text>
              </View>
              <View style={{ padding: 14, paddingHorizontal: 16 }}>
                <Text fontSize={13} color={COLORS.textSecondary} lineHeight={20}>
                  {voucher.notes}
                </Text>
              </View>
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
          {currentUser && voucher && canDeleteDocument(currentUser, voucher) && (
            <Pressable
              onPress={handleDelete}
              style={{
                width: 48,
                height: 48,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: COLORS.shuVermillionSoft,
                borderRadius: 10,
                borderWidth: 1.5,
                borderColor: COLORS.shuVermillion + '30',
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Trash2 size={18} color={COLORS.shuVermillion} />
            </Pressable>
          )}

          {currentUser && voucher && canEditDocument(currentUser, voucher) && (
            <Pressable
              onPress={handleEdit}
              style={{
                flex: 1,
                backgroundColor: COLORS.bgPrimary,
                borderRadius: 10,
                paddingVertical: 15,
                paddingHorizontal: 16,
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
                  fontSize: 14,
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
                backgroundColor: COLORS.sumiInk,
                borderRadius: 10,
                paddingVertical: 15,
                paddingHorizontal: 16,
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
                      fontSize: 14,
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
    zIndex: 20, // Above header (zIndex: 10)
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
    color: COLORS.shuVermillion,
  },
})
