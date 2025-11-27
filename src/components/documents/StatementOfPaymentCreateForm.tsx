/**
 * Statement of Payment Create Form - WIF Japan Design System
 *
 * Single-page form matching InvoiceCreateForm and ReceiptCreateForm design patterns:
 * - Theme prop for dynamic styling
 * - Tamagui components for layout
 * - Card and Input from UI library
 * - SectionHeader with accent bar (same as Invoice/Receipt)
 *
 * Creates new statements of payment matching web app functionality exactly:
 * - Link to Payment Voucher (REQUIRED) - auto-fills payee, items, amount
 * - Payment Date
 * - Account selector (Pay from)
 * - Payment Method selector
 * - Transaction Reference
 * - Transaction Fees (optional)
 * - Transfer Proof Upload (image picker on mobile)
 * - Confirmed By
 * - Notes
 */

import { useState, memo, useCallback } from 'react'
import { YStack, XStack, Text, ScrollView } from 'tamagui'
import { Upload, AlertCircle, X, Calendar } from '@tamagui/lucide-icons'
import { Pressable, StyleSheet, Image, Alert, View, ScrollView as RNScrollView, Platform, Modal } from 'react-native'
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker'
import * as ImagePicker from 'expo-image-picker'
import * as Haptics from 'expo-haptics'

import { Input, Card } from '../ui'
import type {
  StatementOfPayment,
  PaymentVoucher,
  Account,
  Document,
  UserReference,
} from '../../types'

// ============================================
// TYPES
// ============================================

interface StatementOfPaymentCreateFormProps {
  accounts: Account[]
  vouchers: PaymentVoucher[]
  onSubmit: (
    document: Omit<Document, 'id' | 'createdAt' | 'updatedAt' | 'documentNumber'>
  ) => Promise<void>
  onCancel: () => void
  isSaving: boolean
  user: { id: string; name: string; username: string } | null
  theme: {
    bgPrimary: string
    bgSecondary: string
    bgCard: string
    borderSubtle: string
    borderMedium: string
    textPrimary: string
    textSecondary: string
    textMuted: string
    textFaint: string
    gold: string
    goldSoft: string
    vermillion: string
    vermillionSoft: string
    jade: string
    jadeSoft: string
    indigo: string
    indigoSoft: string
    error: string
  }
}

// ============================================
// CONSTANTS
// ============================================

const getTodayISO = () => {
  const now = new Date()
  return now.toISOString().split('T')[0]
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

const PAYMENT_METHODS = ['Bank Transfer', 'Wire Transfer', 'Cheque', 'Online Payment']

const FEE_TYPES = [
  'ATM Withdrawal Fee',
  'Wire Transfer Fee',
  'International Transfer Fee',
  'Currency Conversion Fee',
  'Bank Service Charge',
]

// ============================================
// MEMOIZED HELPER COMPONENTS
// ============================================

// Form Input with Label - Same as InvoiceCreateForm
const FormField = memo(({
  label,
  required,
  children,
  theme,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
  theme: { textSecondary: string; vermillion: string }
}) => (
  <YStack marginBottom="$4">
    <Text fontSize={13} fontWeight="500" color={theme.textSecondary} marginBottom="$2">
      {label}
      {required && <Text color={theme.vermillion}> *</Text>}
    </Text>
    {children}
  </YStack>
))

FormField.displayName = 'FormField'

// Section Header - Same as InvoiceCreateForm (accent bar style)
const SectionHeader = memo(({
  title,
  badge,
  theme,
}: {
  title: string
  badge?: string
  theme: { gold: string; goldSoft: string; textMuted: string }
}) => (
  <XStack alignItems="center" justifyContent="space-between" marginBottom="$4">
    <XStack alignItems="center" gap="$2">
      <View style={[styles.sectionAccent, { backgroundColor: theme.gold }]} />
      <Text
        fontSize={11}
        fontWeight="600"
        letterSpacing={1.2}
        textTransform="uppercase"
        color={theme.textMuted}
      >
        {title}
      </Text>
    </XStack>
    {badge && (
      <View style={[styles.badge, { backgroundColor: theme.goldSoft }]}>
        <Text fontSize={10} fontWeight="600" color={theme.gold}>
          {badge}
        </Text>
      </View>
    )}
  </XStack>
))

SectionHeader.displayName = 'SectionHeader'

// ============================================
// MAIN COMPONENT
// ============================================

export function StatementOfPaymentCreateForm({
  accounts,
  vouchers,
  onSubmit,
  onCancel,
  isSaving,
  user,
  theme,
}: StatementOfPaymentCreateFormProps) {
  const [validationError, setValidationError] = useState<string | null>(null)
  const [selectedVoucher, setSelectedVoucher] = useState<PaymentVoucher | null>(null)
  const [transferProofBase64, setTransferProofBase64] = useState<string>('')
  const [attachmentName, setAttachmentName] = useState<string>('')
  const [showPaymentDatePicker, setShowPaymentDatePicker] = useState(false)

  const [formData, setFormData] = useState({
    linkedVoucherId: '',
    paymentDate: getTodayISO(),
    paymentMethod: '',
    transactionReference: '',
    confirmedBy: '',
    accountId: '',
    transactionFee: '0',
    transactionFeeType: '',
    notes: '',
  })

  // Filter to issued vouchers only
  const issuedVouchers = vouchers.filter((v) => v.status === 'issued')

  // Filter accounts by selected voucher's currency
  const filteredAccounts = selectedVoucher
    ? accounts.filter((acc) => acc.isActive && acc.currency === selectedVoucher.currency)
    : accounts.filter((acc) => acc.isActive)

  const handleVoucherSelect = useCallback((voucher: PaymentVoucher | null) => {
    if (voucher) {
      setSelectedVoucher(voucher)
      setFormData((prev) => ({
        ...prev,
        linkedVoucherId: voucher.id,
        accountId: voucher.accountId || '',
      }))
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } else {
      setSelectedVoucher(null)
      setFormData((prev) => ({
        ...prev,
        linkedVoucherId: '',
      }))
    }
  }, [])

  const handlePaymentDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowPaymentDatePicker(false)
    }
    if (selectedDate) {
      setFormData({ ...formData, paymentDate: selectedDate.toISOString().split('T')[0] })
    }
  }

  const openPaymentDatePicker = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setShowPaymentDatePicker(true)
  }

  const handlePickImage = async () => {
    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant camera roll permissions to upload transfer proof.')
        return
      }

      // Pick image
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
        base64: true,
      })

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0]
        setAttachmentName(asset.fileName || 'transfer_proof.jpg')
        setTransferProofBase64(`data:image/jpeg;base64,${asset.base64}`)
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      }
    } catch (error) {
      console.error('Error picking image:', error)
      Alert.alert('Error', 'Failed to pick image. Please try again.')
    }
  }

  const handleRemoveImage = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setTransferProofBase64('')
    setAttachmentName('')
  }

  const handleSubmit = useCallback(async () => {
    setValidationError(null)

    // Validation
    if (!formData.linkedVoucherId) {
      setValidationError('Payment voucher link is required')
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      return
    }
    if (!selectedVoucher) {
      setValidationError('Invalid payment voucher selected')
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      return
    }
    if (!formData.paymentMethod.trim()) {
      setValidationError('Payment method is required')
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      return
    }
    if (!formData.transactionReference.trim()) {
      setValidationError('Transaction reference is required')
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      return
    }
    if (!formData.confirmedBy.trim()) {
      setValidationError('Confirmed by field is required')
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      return
    }
    if (!formData.accountId) {
      setValidationError('Payment account is required')
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      return
    }

    const selectedAccount = accounts.find((acc) => acc.id === formData.accountId)
    const transactionFee = parseFloat(formData.transactionFee) || 0
    const totalDeducted = selectedVoucher.total + transactionFee

    const userReference: UserReference | undefined = user
      ? {
          id: user.id,
          name: user.name,
          username: user.username,
        }
      : undefined

    const statement: Omit<
      StatementOfPayment,
      'id' | 'createdAt' | 'updatedAt' | 'documentNumber'
    > = {
      documentType: 'statement_of_payment',
      date: formData.paymentDate,
      status: 'completed',
      currency: selectedVoucher.currency,
      country: selectedVoucher.country,
      amount: selectedVoucher.amount,
      accountId: formData.accountId,
      accountName: selectedAccount?.name || undefined,
      linkedVoucherId: formData.linkedVoucherId,
      linkedVoucherNumber: selectedVoucher.documentNumber,
      paymentDate: formData.paymentDate,
      paymentMethod: formData.paymentMethod,
      transactionReference: formData.transactionReference,
      transferProofFilename: attachmentName || undefined,
      transferProofBase64: transferProofBase64 || undefined,
      confirmedBy: formData.confirmedBy,
      payeeName: selectedVoucher.payeeName,
      notes: formData.notes || undefined,
      // Include items from payment voucher
      items: selectedVoucher.items,
      subtotal: selectedVoucher.subtotal,
      taxRate: selectedVoucher.taxRate,
      taxAmount: selectedVoucher.taxAmount,
      total: selectedVoucher.total,
      // Transaction fees
      transactionFee: transactionFee > 0 ? transactionFee : undefined,
      transactionFeeType: formData.transactionFeeType || undefined,
      totalDeducted: totalDeducted,
      createdBy: userReference,
      updatedBy: userReference,
    }

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    await onSubmit(statement)
  }, [formData, accounts, user, selectedVoucher, attachmentName, transferProofBase64, onSubmit])

  return (
    <YStack flex={1}>
      {/* Form Content */}
      <ScrollView flex={1} showsVerticalScrollIndicator={false}>
        <YStack padding="$5" gap="$4">
          {/* Validation Error */}
          {validationError && (
            <Card backgroundColor={theme.vermillionSoft} padding="$3">
              <Text color={theme.vermillion} fontSize={13}>
                {validationError}
              </Text>
            </Card>
          )}

          {/* No Vouchers Warning */}
          {issuedVouchers.length === 0 && (
            <Card backgroundColor={theme.goldSoft} padding="$3">
              <XStack alignItems="center" gap="$2">
                <AlertCircle size={20} color={theme.gold} />
                <Text fontSize={13} color={theme.textPrimary} flex={1}>
                  No issued payment vouchers available. You need to create and approve a
                  payment voucher first.
                </Text>
              </XStack>
            </Card>
          )}

          {/* Basic Info */}
          <Card backgroundColor={theme.bgCard} padding="$5" borderRadius={16} style={styles.formCard}>
            <SectionHeader title="Statement Details" theme={theme} />

            <FormField label="Payment Date" required theme={theme}>
              <Pressable
                onPress={openPaymentDatePicker}
                style={[styles.dateInput, { borderColor: theme.borderSubtle, backgroundColor: theme.bgCard }]}
              >
                <Text fontSize={14} fontWeight="500" color={theme.textPrimary}>
                  {formatDate(formData.paymentDate)}
                </Text>
                <Calendar size={18} color={theme.textMuted} />
              </Pressable>
            </FormField>

            {/* iOS Date Picker */}
            {Platform.OS === 'ios' && showPaymentDatePicker && (
              <Modal
                transparent
                animationType="fade"
                visible={showPaymentDatePicker}
                onRequestClose={() => setShowPaymentDatePicker(false)}
              >
                <Pressable
                  style={styles.datePickerOverlay}
                  onPress={() => setShowPaymentDatePicker(false)}
                >
                  <Pressable style={[styles.datePickerContainer, { backgroundColor: theme.bgCard }]}>
                    <XStack justifyContent="space-between" alignItems="center" paddingHorizontal="$4" paddingVertical="$3" borderBottomWidth={1} borderBottomColor={theme.borderSubtle}>
                      <Text fontSize={17} fontWeight="600" color={theme.textPrimary}>Payment Date</Text>
                      <Pressable onPress={() => setShowPaymentDatePicker(false)} hitSlop={8}>
                        <Text fontSize={17} fontWeight="600" color={theme.gold}>Done</Text>
                      </Pressable>
                    </XStack>
                    <DateTimePicker
                      value={new Date(formData.paymentDate)}
                      mode="date"
                      display="spinner"
                      onChange={handlePaymentDateChange}
                      locale="en-GB"
                      themeVariant="light"
                      style={{ height: 200 }}
                    />
                  </Pressable>
                </Pressable>
              </Modal>
            )}

            {/* Android Date Picker */}
            {Platform.OS === 'android' && showPaymentDatePicker && (
              <DateTimePicker
                value={new Date(formData.paymentDate)}
                mode="date"
                display="default"
                onChange={handlePaymentDateChange}
              />
            )}
          </Card>

          {/* Link to Payment Voucher */}
          <Card backgroundColor={theme.bgCard} padding="$5" borderRadius={16} style={styles.formCard}>
            <SectionHeader title="Link to Payment Voucher" badge="Required" theme={theme} />

            {issuedVouchers.length > 0 ? (
              <>
                <RNScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.horizontalScroll}
                  contentContainerStyle={styles.horizontalScrollContent}
                >
                  {issuedVouchers.map((voucher) => (
                    <Pressable
                      key={voucher.id}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                        handleVoucherSelect(voucher)
                      }}
                      style={[
                        styles.voucherCard,
                        {
                          backgroundColor:
                            formData.linkedVoucherId === voucher.id
                              ? theme.textPrimary
                              : theme.bgPrimary,
                          borderColor:
                            formData.linkedVoucherId === voucher.id
                              ? theme.textPrimary
                              : theme.borderSubtle,
                        },
                      ]}
                    >
                      <Text
                        fontSize={13}
                        fontWeight="600"
                        color={
                          formData.linkedVoucherId === voucher.id
                            ? '#FFFFFF'
                            : theme.textPrimary
                        }
                      >
                        {voucher.documentNumber}
                      </Text>
                      <Text
                        fontSize={11}
                        color={
                          formData.linkedVoucherId === voucher.id
                            ? 'rgba(255,255,255,0.7)'
                            : theme.textMuted
                        }
                        numberOfLines={1}
                      >
                        {voucher.payeeName}
                      </Text>
                      <Text
                        fontSize={12}
                        fontWeight="500"
                        color={
                          formData.linkedVoucherId === voucher.id
                            ? '#FFFFFF'
                            : theme.textSecondary
                        }
                      >
                        {voucher.currency} {voucher.total.toFixed(2)}
                      </Text>
                    </Pressable>
                  ))}
                </RNScrollView>

                {/* Selected Voucher Details */}
                {selectedVoucher && (
                  <View style={[styles.voucherDetails, { backgroundColor: theme.bgSecondary, borderColor: theme.borderSubtle }]}>
                    <XStack justifyContent="space-between" marginBottom="$2">
                      <Text fontSize={13} color={theme.textMuted}>
                        Payee:
                      </Text>
                      <Text fontSize={13} fontWeight="500" color={theme.textPrimary}>
                        {selectedVoucher.payeeName}
                      </Text>
                    </XStack>
                    <XStack justifyContent="space-between" marginBottom="$2">
                      <Text fontSize={13} color={theme.textMuted}>
                        Amount:
                      </Text>
                      <Text fontSize={13} fontWeight="600" color={theme.gold}>
                        {selectedVoucher.currency} {selectedVoucher.total.toFixed(2)}
                      </Text>
                    </XStack>
                    {selectedVoucher.items && selectedVoucher.items.length > 0 && (
                      <YStack marginTop="$2" paddingTop="$2" borderTopWidth={1} borderTopColor={theme.borderSubtle}>
                        <Text fontSize={12} color={theme.textMuted} marginBottom="$1">
                          Items:
                        </Text>
                        {selectedVoucher.items.map((item, index) => (
                          <Text key={item.id} fontSize={12} color={theme.textSecondary}>
                            {index + 1}. {item.description} - {selectedVoucher.currency}{' '}
                            {item.amount.toFixed(2)}
                          </Text>
                        ))}
                      </YStack>
                    )}
                  </View>
                )}
              </>
            ) : (
              <Text fontSize={13} color={theme.textMuted}>
                No issued vouchers available
              </Text>
            )}
          </Card>

          {/* Payment Details */}
          <Card backgroundColor={theme.bgCard} padding="$5" borderRadius={16} style={styles.formCard}>
            <SectionHeader title="Payment Details" theme={theme} />

            {/* Account Selector */}
            <FormField label="Pay from Account" required theme={theme}>
              <XStack gap="$2" flexWrap="wrap">
                {filteredAccounts.map((account) => (
                  <Pressable
                    key={account.id}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                      setFormData({ ...formData, accountId: account.id })
                    }}
                    style={[
                      styles.toggleBtn,
                      formData.accountId === account.id
                        ? { backgroundColor: theme.textPrimary, borderColor: theme.textPrimary }
                        : { backgroundColor: theme.bgPrimary, borderColor: theme.borderSubtle },
                    ]}
                  >
                    <Text
                      fontSize={14}
                      fontWeight="600"
                      color={formData.accountId === account.id ? '#FFFFFF' : theme.textPrimary}
                    >
                      {account.name}
                    </Text>
                    <Text
                      fontSize={11}
                      color={formData.accountId === account.id ? 'rgba(255,255,255,0.7)' : theme.textMuted}
                    >
                      {account.currency} Account
                    </Text>
                  </Pressable>
                ))}
              </XStack>
            </FormField>

            {/* Payment Method */}
            <FormField label="Payment Method" required theme={theme}>
              <XStack flexWrap="wrap" gap="$2">
                {PAYMENT_METHODS.map((method) => (
                  <Pressable
                    key={method}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                      setFormData({ ...formData, paymentMethod: method })
                    }}
                    style={[
                      styles.chip,
                      formData.paymentMethod === method
                        ? { backgroundColor: theme.textPrimary, borderColor: theme.textPrimary }
                        : { backgroundColor: theme.bgPrimary, borderColor: theme.borderSubtle },
                    ]}
                  >
                    <Text
                      fontSize={13}
                      fontWeight="500"
                      color={formData.paymentMethod === method ? '#FFFFFF' : theme.textPrimary}
                    >
                      {method}
                    </Text>
                  </Pressable>
                ))}
              </XStack>
            </FormField>

            <FormField label="Transaction Reference" required theme={theme}>
              <Input
                value={formData.transactionReference}
                onChangeText={(value) =>
                  setFormData({ ...formData, transactionReference: value })
                }
                placeholder="e.g., TXN123456789"
              />
            </FormField>
          </Card>

          {/* Transaction Fees */}
          <Card backgroundColor={theme.bgCard} padding="$5" borderRadius={16} style={styles.formCard}>
            <SectionHeader title="Transaction Fees" badge="Optional" theme={theme} />

            <FormField label="Fee Amount" theme={theme}>
              <Input
                value={formData.transactionFee}
                onChangeText={(value) => setFormData({ ...formData, transactionFee: value })}
                keyboardType="decimal-pad"
                placeholder="0.00"
              />
            </FormField>

            {/* Fee Type Selector */}
            <FormField label="Fee Type" theme={theme}>
              <RNScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.horizontalScroll}
                contentContainerStyle={styles.horizontalScrollContent}
              >
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    setFormData({ ...formData, transactionFeeType: '' })
                  }}
                  style={[
                    styles.chip,
                    !formData.transactionFeeType
                      ? { backgroundColor: theme.textPrimary, borderColor: theme.textPrimary }
                      : { backgroundColor: theme.bgPrimary, borderColor: theme.borderSubtle },
                  ]}
                >
                  <Text
                    fontSize={13}
                    fontWeight="500"
                    color={!formData.transactionFeeType ? '#FFFFFF' : theme.textPrimary}
                  >
                    None
                  </Text>
                </Pressable>
                {FEE_TYPES.map((feeType) => (
                  <Pressable
                    key={feeType}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                      setFormData({ ...formData, transactionFeeType: feeType })
                    }}
                    style={[
                      styles.chip,
                      formData.transactionFeeType === feeType
                        ? { backgroundColor: theme.textPrimary, borderColor: theme.textPrimary }
                        : { backgroundColor: theme.bgPrimary, borderColor: theme.borderSubtle },
                    ]}
                  >
                    <Text
                      fontSize={13}
                      fontWeight="500"
                      color={
                        formData.transactionFeeType === feeType
                          ? '#FFFFFF'
                          : theme.textPrimary
                      }
                    >
                      {feeType}
                    </Text>
                  </Pressable>
                ))}
              </RNScrollView>
            </FormField>

            {/* Payment Breakdown */}
            {selectedVoucher && (
              <View style={[styles.paymentBreakdown, { backgroundColor: theme.bgSecondary, borderColor: theme.borderSubtle }]}>
                <Text fontSize={12} fontWeight="600" color={theme.textMuted} marginBottom="$2" letterSpacing={0.5} textTransform="uppercase">
                  Payment Breakdown
                </Text>
                <XStack justifyContent="space-between" marginBottom="$1">
                  <Text fontSize={13} color={theme.textMuted}>
                    Voucher Amount:
                  </Text>
                  <Text fontSize={13} fontWeight="500" color={theme.textPrimary}>
                    {selectedVoucher.currency} {selectedVoucher.total.toFixed(2)}
                  </Text>
                </XStack>
                <XStack justifyContent="space-between" marginBottom="$1">
                  <Text fontSize={13} color={theme.textMuted}>
                    Transaction Fee:
                  </Text>
                  <Text fontSize={13} fontWeight="500" color={theme.textPrimary}>
                    {selectedVoucher.currency} {(parseFloat(formData.transactionFee) || 0).toFixed(2)}
                  </Text>
                </XStack>
                <XStack
                  justifyContent="space-between"
                  paddingTop="$2"
                  marginTop="$1"
                  borderTopWidth={1}
                  borderTopColor={theme.borderSubtle}
                >
                  <Text fontSize={14} fontWeight="600" color={theme.textPrimary}>
                    Total Deducted:
                  </Text>
                  <Text fontSize={14} fontWeight="600" color={theme.gold}>
                    {selectedVoucher.currency}{' '}
                    {(selectedVoucher.total + (parseFloat(formData.transactionFee) || 0)).toFixed(2)}
                  </Text>
                </XStack>
              </View>
            )}
          </Card>

          {/* Transfer Proof Upload */}
          <Card backgroundColor={theme.bgCard} padding="$5" borderRadius={16} style={styles.formCard}>
            <SectionHeader title="Transfer Proof" badge="Optional" theme={theme} />

            {transferProofBase64 ? (
              <YStack gap="$2">
                <Image
                  source={{ uri: transferProofBase64 }}
                  style={styles.previewImage}
                  resizeMode="contain"
                />
                <XStack alignItems="center" justifyContent="space-between">
                  <Text fontSize={13} color={theme.textSecondary} numberOfLines={1} flex={1}>
                    {attachmentName}
                  </Text>
                  <Pressable onPress={handleRemoveImage} style={[styles.removeBtn, { backgroundColor: theme.vermillionSoft }]}>
                    <X size={18} color={theme.vermillion} />
                  </Pressable>
                </XStack>
              </YStack>
            ) : (
              <Pressable onPress={handlePickImage} style={[styles.uploadBtn, { borderColor: theme.borderMedium, backgroundColor: theme.bgSecondary }]}>
                <Upload size={24} color={theme.textMuted} />
                <Text fontSize={14} fontWeight="500" color={theme.textPrimary} marginTop="$2">
                  Tap to upload transfer proof
                </Text>
                <Text fontSize={12} color={theme.textMuted}>
                  JPG, PNG supported
                </Text>
              </Pressable>
            )}
          </Card>

          {/* Confirmation */}
          <Card backgroundColor={theme.bgCard} padding="$5" borderRadius={16} style={styles.formCard}>
            <SectionHeader title="Confirmation" theme={theme} />

            <FormField label="Confirmed By" required theme={theme}>
              <Input
                value={formData.confirmedBy}
                onChangeText={(value) => setFormData({ ...formData, confirmedBy: value })}
                placeholder="Name of person confirming payment"
              />
            </FormField>
          </Card>

          {/* Notes */}
          <Card backgroundColor={theme.bgCard} padding="$5" borderRadius={16} style={styles.formCard}>
            <SectionHeader title="Notes" badge="Optional" theme={theme} />

            <Input
              value={formData.notes}
              onChangeText={(value) => setFormData({ ...formData, notes: value })}
              multiline
              numberOfLines={3}
              placeholder="Additional notes..."
            />
          </Card>
        </YStack>
      </ScrollView>

      {/* Footer Actions */}
      <XStack
        padding="$4"
        paddingHorizontal="$5"
        gap="$3"
        backgroundColor={theme.bgCard}
        borderTopWidth={1}
        borderTopColor={theme.borderSubtle}
      >
        <Pressable onPress={onCancel} style={styles.btnGhost}>
          <Text fontSize={14} fontWeight="500" color={theme.textMuted}>
            Cancel
          </Text>
        </Pressable>

        <Pressable
          onPress={handleSubmit}
          disabled={isSaving || issuedVouchers.length === 0}
          style={[styles.btnPrimary, { opacity: isSaving || issuedVouchers.length === 0 ? 0.7 : 1 }]}
        >
          <Text fontSize={14} fontWeight="600" color="#FFFFFF">
            {isSaving ? 'Creating...' : 'Create Statement'}
          </Text>
        </Pressable>
      </XStack>
    </YStack>
  )
}

// ============================================
// STYLES - Same as InvoiceCreateForm and ReceiptCreateForm
// ============================================

const styles = StyleSheet.create({
  sectionAccent: {
    width: 3,
    height: 14,
    borderRadius: 2,
  },
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  formCard: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 10,
  },
  datePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  datePickerContainer: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 16,
    paddingBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 8,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    gap: 2,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 8,
  },
  horizontalScroll: {
    marginHorizontal: -20,
  },
  horizontalScrollContent: {
    paddingHorizontal: 20,
    gap: 10,
    flexDirection: 'row',
  },
  voucherCard: {
    minWidth: 140,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: 10,
    gap: 4,
  },
  voucherDetails: {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  paymentBreakdown: {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  uploadBtn: {
    padding: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
  },
  removeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhost: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  btnPrimary: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: '#1A1815',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
})
