/**
 * Payment Voucher Create Form - WIF Japan Design System
 *
 * Creates new payment vouchers matching web app functionality exactly:
 * - Voucher Date and Payment Due Date
 * - Payee Details (name*, address, bank info)
 * - Line items with add/remove
 * - Currency selector (MYR/JPY)
 * - Account selector (Pay from, filtered by currency)
 * - Tax rate and auto-calculated totals
 * - Requested By and Approval
 * - Notes
 *
 * Design system matches InvoiceCreateForm and ReceiptCreateForm:
 * - SectionHeader with accent bar (same as Invoice/Receipt)
 * - FormField component (memoized)
 * - Card styling with padding and shadow
 * - Toggle buttons with dark selected state
 */

import { useState, memo } from 'react'
import { YStack, XStack, Text, ScrollView } from 'tamagui'
import { Plus, X, CheckSquare, Square, Calendar } from '@tamagui/lucide-icons'
import { Pressable, StyleSheet, View, Platform, Modal } from 'react-native'
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker'
import * as Haptics from 'expo-haptics'

import { Input, Button, Card } from '../ui'
import type {
  PaymentVoucher,
  LineItem,
  Currency,
  Country,
  Account,
  Document,
  UserReference,
} from '../../types'

// ============================================
// MEMOIZED HELPER COMPONENTS
// ============================================

// Form Input with Label - Same as InvoiceCreateForm
const FormField = memo(({
  label,
  required,
  children,
  theme
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  theme: { textSecondary: string; vermillion: string };
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
  theme
}: {
  title: string;
  badge?: string;
  theme: { gold: string; goldSoft: string; textMuted: string };
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

interface PaymentVoucherCreateFormProps {
  accounts: Account[]
  onSubmit: (
    document: Omit<Document, 'id' | 'createdAt' | 'updatedAt' | 'documentNumber'>
  ) => Promise<void>
  onCancel: () => void
  isSaving: boolean
  user: { id: string; name: string; username: string; role?: string } | null
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
    error: string
  }
}

const getTodayISO = () => {
  const now = new Date()
  return now.toISOString().split('T')[0]
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Check if user can approve vouchers (admin or accountant)
const canApproveVouchers = (role: string | undefined): boolean => {
  return role === 'admin' || role === 'accountant'
}

export function PaymentVoucherCreateForm({
  accounts,
  onSubmit,
  onCancel,
  isSaving,
  user,
  theme,
}: PaymentVoucherCreateFormProps) {
  const canApprove = user && canApproveVouchers(user.role)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [showVoucherDatePicker, setShowVoucherDatePicker] = useState(false)
  const [showDueDatePicker, setShowDueDatePicker] = useState(false)
  const [items, setItems] = useState<LineItem[]>([
    { id: '1', description: '', quantity: 1, unitPrice: 0, amount: 0 },
  ])
  const [isApproved, setIsApproved] = useState(false)

  const [formData, setFormData] = useState({
    voucherDate: getTodayISO(),
    paymentDueDate: '',
    payeeName: '',
    payeeAddress: '',
    payeeBankAccount: '',
    payeeBankName: '',
    requestedBy: '',
    currency: 'MYR' as Currency,
    country: 'Malaysia' as Country,
    accountId: '',
    taxRate: '',
    notes: '',
  })

  // Filter accounts by selected currency
  const filteredAccounts = accounts.filter(
    (acc) => acc.isActive && acc.currency === formData.currency
  )

  const addItem = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setItems([
      ...items,
      {
        id: Date.now().toString(),
        description: '',
        quantity: 1,
        unitPrice: 0,
        amount: 0,
      },
    ])
  }

  const removeItem = async (id: string) => {
    if (items.length > 1) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      setItems(items.filter((item) => item.id !== id))
    }
  }

  const updateItem = (id: string, field: keyof LineItem, value: any) => {
    setItems(
      items.map((item) => {
        if (item.id === id) {
          const updated = { ...item, [field]: value }
          if (field === 'quantity' || field === 'unitPrice') {
            updated.amount = updated.quantity * updated.unitPrice
          }
          return updated
        }
        return item
      })
    )
  }

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + item.amount, 0)
    const taxRate = parseFloat(formData.taxRate) || 0
    const taxAmount = subtotal * (taxRate / 100)
    const total = subtotal + taxAmount
    return { subtotal, taxAmount, total }
  }

  const handleCurrencyChange = async (currency: Currency) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const country: Country = currency === 'JPY' ? 'Japan' : 'Malaysia'
    setFormData({ ...formData, currency, country, accountId: '' })
  }

  const handleVoucherDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowVoucherDatePicker(false)
    }
    if (selectedDate) {
      setFormData({ ...formData, voucherDate: selectedDate.toISOString().split('T')[0] })
    }
  }

  const handleDueDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDueDatePicker(false)
    }
    if (selectedDate) {
      setFormData({ ...formData, paymentDueDate: selectedDate.toISOString().split('T')[0] })
    }
  }

  const openVoucherDatePicker = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setShowVoucherDatePicker(true)
  }

  const openDueDatePicker = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setShowDueDatePicker(true)
  }

  const handleApprovalToggle = async () => {
    if (canApprove) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      setIsApproved(!isApproved)
    }
  }

  const handleSubmit = async () => {
    setValidationError(null)

    // Validation
    if (!formData.payeeName.trim()) {
      setValidationError('Payee name is required')
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      return
    }
    if (!formData.requestedBy.trim()) {
      setValidationError('Requested by field is required')
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      return
    }
    if (items.some((item) => !item.description.trim())) {
      setValidationError('All line items must have a description')
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      return
    }

    const { subtotal, taxAmount, total } = calculateTotals()
    const selectedAccount = accounts.find((acc) => acc.id === formData.accountId)

    const userReference: UserReference | undefined = user
      ? {
          id: user.id,
          name: user.name,
          username: user.username,
        }
      : undefined

    // Handle approval
    let approvalInfo: UserReference | undefined = undefined
    let approvalDateValue: string | undefined = undefined
    const now = new Date().toISOString()

    if (isApproved && canApprove && userReference) {
      approvalInfo = userReference
      approvalDateValue = now
    }

    const voucher: Omit<
      PaymentVoucher,
      'id' | 'createdAt' | 'updatedAt' | 'documentNumber'
    > = {
      documentType: 'payment_voucher',
      date: formData.voucherDate,
      status: approvalInfo ? 'issued' : 'draft',
      currency: formData.currency,
      country: formData.country,
      amount: total,
      accountId: formData.accountId || undefined,
      accountName: selectedAccount?.name || undefined,
      payeeName: formData.payeeName,
      payeeAddress: formData.payeeAddress || undefined,
      payeeBankAccount: formData.payeeBankAccount || undefined,
      payeeBankName: formData.payeeBankName || undefined,
      voucherDate: formData.voucherDate,
      items: items,
      subtotal: subtotal,
      taxRate: parseFloat(formData.taxRate) || undefined,
      taxAmount: taxAmount > 0 ? taxAmount : undefined,
      total: total,
      requestedBy: formData.requestedBy,
      approvedBy: approvalInfo,
      approvalDate: approvalDateValue,
      paymentDueDate: formData.paymentDueDate || undefined,
      notes: formData.notes || undefined,
      createdBy: userReference,
      updatedBy: userReference,
    }

    await onSubmit(voucher)
  }

  const { subtotal, taxAmount, total } = calculateTotals()

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

          {/* Voucher Details */}
          <Card backgroundColor={theme.bgCard} padding="$5" borderRadius={16} style={styles.formCard}>
            <SectionHeader title="Voucher Details" theme={theme} />

            <XStack gap="$3">
              <YStack flex={1}>
                <FormField label="Voucher Date" required theme={theme}>
                  <Pressable
                    onPress={openVoucherDatePicker}
                    style={[styles.dateInput, { borderColor: theme.borderSubtle, backgroundColor: theme.bgCard }]}
                  >
                    <Text fontSize={14} fontWeight="500" color={theme.textPrimary}>
                      {formatDate(formData.voucherDate)}
                    </Text>
                    <Calendar size={18} color={theme.textMuted} />
                  </Pressable>
                </FormField>
              </YStack>
              <YStack flex={1}>
                <FormField label="Payment Due Date" theme={theme}>
                  <Pressable
                    onPress={openDueDatePicker}
                    style={[styles.dateInput, { borderColor: theme.borderSubtle, backgroundColor: theme.bgCard }]}
                  >
                    <Text
                      fontSize={14}
                      fontWeight="500"
                      color={formData.paymentDueDate ? theme.textPrimary : theme.textFaint}
                    >
                      {formData.paymentDueDate ? formatDate(formData.paymentDueDate) : 'Select date'}
                    </Text>
                    <Calendar size={18} color={theme.textMuted} />
                  </Pressable>
                </FormField>
              </YStack>
            </XStack>

            {/* iOS Date Pickers */}
            {Platform.OS === 'ios' && showVoucherDatePicker && (
              <Modal
                transparent
                animationType="fade"
                visible={showVoucherDatePicker}
                onRequestClose={() => setShowVoucherDatePicker(false)}
              >
                <Pressable
                  style={styles.datePickerOverlay}
                  onPress={() => setShowVoucherDatePicker(false)}
                >
                  <Pressable style={[styles.datePickerContainer, { backgroundColor: theme.bgCard }]}>
                    <XStack justifyContent="space-between" alignItems="center" paddingHorizontal="$4" paddingVertical="$3" borderBottomWidth={1} borderBottomColor={theme.borderSubtle}>
                      <Text fontSize={17} fontWeight="600" color={theme.textPrimary}>Voucher Date</Text>
                      <Pressable onPress={() => setShowVoucherDatePicker(false)} hitSlop={8}>
                        <Text fontSize={17} fontWeight="600" color={theme.gold}>Done</Text>
                      </Pressable>
                    </XStack>
                    <DateTimePicker
                      value={new Date(formData.voucherDate)}
                      mode="date"
                      display="spinner"
                      onChange={handleVoucherDateChange}
                      locale="en-GB"
                      themeVariant="light"
                      style={{ height: 200 }}
                    />
                  </Pressable>
                </Pressable>
              </Modal>
            )}

            {Platform.OS === 'ios' && showDueDatePicker && (
              <Modal
                transparent
                animationType="fade"
                visible={showDueDatePicker}
                onRequestClose={() => setShowDueDatePicker(false)}
              >
                <Pressable
                  style={styles.datePickerOverlay}
                  onPress={() => setShowDueDatePicker(false)}
                >
                  <Pressable style={[styles.datePickerContainer, { backgroundColor: theme.bgCard }]}>
                    <XStack justifyContent="space-between" alignItems="center" paddingHorizontal="$4" paddingVertical="$3" borderBottomWidth={1} borderBottomColor={theme.borderSubtle}>
                      <Text fontSize={17} fontWeight="600" color={theme.textPrimary}>Payment Due Date</Text>
                      <Pressable onPress={() => setShowDueDatePicker(false)} hitSlop={8}>
                        <Text fontSize={17} fontWeight="600" color={theme.gold}>Done</Text>
                      </Pressable>
                    </XStack>
                    <DateTimePicker
                      value={formData.paymentDueDate ? new Date(formData.paymentDueDate) : new Date()}
                      mode="date"
                      display="spinner"
                      onChange={handleDueDateChange}
                      minimumDate={new Date(formData.voucherDate)}
                      locale="en-GB"
                      themeVariant="light"
                      style={{ height: 200 }}
                    />
                  </Pressable>
                </Pressable>
              </Modal>
            )}

            {/* Android Date Pickers */}
            {Platform.OS === 'android' && showVoucherDatePicker && (
              <DateTimePicker
                value={new Date(formData.voucherDate)}
                mode="date"
                display="default"
                onChange={handleVoucherDateChange}
              />
            )}

            {Platform.OS === 'android' && showDueDatePicker && (
              <DateTimePicker
                value={formData.paymentDueDate ? new Date(formData.paymentDueDate) : new Date()}
                mode="date"
                display="default"
                onChange={handleDueDateChange}
                minimumDate={new Date(formData.voucherDate)}
              />
            )}
          </Card>

          {/* Payee Details */}
          <Card backgroundColor={theme.bgCard} padding="$5" borderRadius={16} style={styles.formCard}>
            <SectionHeader title="Payee Details" theme={theme} />

            <FormField label="Payee Name" required theme={theme}>
              <Input
                value={formData.payeeName}
                onChangeText={(value) => setFormData({ ...formData, payeeName: value })}
                placeholder="Company or individual name"
              />
            </FormField>

            <XStack gap="$3">
              <YStack flex={1}>
                <FormField label="Bank Name" theme={theme}>
                  <Input
                    value={formData.payeeBankName}
                    onChangeText={(value) => setFormData({ ...formData, payeeBankName: value })}
                    placeholder="Bank name"
                  />
                </FormField>
              </YStack>
              <YStack flex={1}>
                <FormField label="Bank Account" theme={theme}>
                  <Input
                    value={formData.payeeBankAccount}
                    onChangeText={(value) =>
                      setFormData({ ...formData, payeeBankAccount: value })
                    }
                    placeholder="Account number"
                    keyboardType="default"
                  />
                </FormField>
              </YStack>
            </XStack>

            <FormField label="Payee Address" theme={theme}>
              <Input
                value={formData.payeeAddress}
                onChangeText={(value) => setFormData({ ...formData, payeeAddress: value })}
                placeholder="Street address, city, postal code"
                multiline
                numberOfLines={3}
              />
            </FormField>
          </Card>

          {/* Currency */}
          <Card backgroundColor={theme.bgCard} padding="$5" borderRadius={16} style={styles.formCard}>
            <SectionHeader title="Currency" theme={theme} />

            <XStack gap="$2">
              {(['MYR', 'JPY'] as Currency[]).map((curr) => (
                <Pressable
                  key={curr}
                  onPress={() => handleCurrencyChange(curr)}
                  style={[
                    styles.toggleBtn,
                    formData.currency === curr
                      ? { backgroundColor: theme.textPrimary, borderColor: theme.textPrimary }
                      : { backgroundColor: theme.bgPrimary, borderColor: theme.borderSubtle },
                  ]}
                >
                  <Text
                    fontSize={14}
                    fontWeight="600"
                    color={formData.currency === curr ? '#FFFFFF' : theme.textPrimary}
                  >
                    {curr}
                  </Text>
                  <Text
                    fontSize={11}
                    color={formData.currency === curr ? 'rgba(255,255,255,0.7)' : theme.textMuted}
                  >
                    {curr === 'MYR' ? 'Malaysian Ringgit' : 'Japanese Yen'}
                  </Text>
                </Pressable>
              ))}
            </XStack>
          </Card>

          {/* Pay from Account */}
          <Card backgroundColor={theme.bgCard} padding="$5" borderRadius={16} style={styles.formCard}>
            <SectionHeader title="Pay from Account" theme={theme} />

            <XStack gap="$2" flexWrap="wrap">
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  setFormData({ ...formData, accountId: '' })
                }}
                style={[
                  styles.toggleBtn,
                  !formData.accountId
                    ? { backgroundColor: theme.textPrimary, borderColor: theme.textPrimary }
                    : { backgroundColor: theme.bgPrimary, borderColor: theme.borderSubtle },
                ]}
              >
                <Text
                  fontSize={14}
                  fontWeight="600"
                  color={!formData.accountId ? '#FFFFFF' : theme.textPrimary}
                >
                  None
                </Text>
                <Text
                  fontSize={11}
                  color={!formData.accountId ? 'rgba(255,255,255,0.7)' : theme.textMuted}
                >
                  Manual Entry
                </Text>
              </Pressable>
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
          </Card>

          {/* Line Items */}
          <Card backgroundColor={theme.bgCard} padding="$5" borderRadius={16} style={styles.formCard}>
            <SectionHeader
              title="Payment Items"
              badge={`${items.length} Item${items.length > 1 ? 's' : ''}`}
              theme={theme}
            />

            {items.map((item, index) => (
              <View
                key={item.id}
                style={[styles.lineItem, { backgroundColor: theme.bgSecondary }]}
              >
                <XStack justifyContent="space-between" alignItems="center" marginBottom="$3">
                  <Text
                    fontSize={11}
                    fontWeight="600"
                    letterSpacing={0.5}
                    color={theme.textMuted}
                  >
                    Item {String(index + 1).padStart(2, '0')}
                  </Text>
                  {items.length > 1 && (
                    <Pressable
                      onPress={() => removeItem(item.id)}
                      style={[styles.deleteBtn, { backgroundColor: theme.vermillionSoft }]}
                    >
                      <X size={14} color={theme.vermillion} />
                    </Pressable>
                  )}
                </XStack>

                <FormField label="Description" theme={theme}>
                  <Input
                    value={item.description}
                    onChangeText={(value) => updateItem(item.id, 'description', value)}
                    placeholder="Item description"
                  />
                </FormField>

                <XStack gap="$3">
                  <YStack flex={1}>
                    <FormField label="Quantity" theme={theme}>
                      <Input
                        value={item.quantity.toString()}
                        onChangeText={(value) =>
                          updateItem(item.id, 'quantity', parseFloat(value) || 0)
                        }
                        keyboardType="numeric"
                      />
                    </FormField>
                  </YStack>
                  <YStack flex={1}>
                    <FormField label="Unit Price" theme={theme}>
                      <Input
                        value={item.unitPrice.toString()}
                        onChangeText={(value) =>
                          updateItem(item.id, 'unitPrice', parseFloat(value) || 0)
                        }
                        keyboardType="decimal-pad"
                      />
                    </FormField>
                  </YStack>
                </XStack>

                <View style={[styles.lineItemTotal, { borderTopColor: theme.borderSubtle }]}>
                  <Text fontSize={12} color={theme.textMuted}>Subtotal</Text>
                  <Text fontSize={14} fontWeight="600" color={theme.textPrimary}>
                    {formData.currency} {item.amount.toFixed(2)}
                  </Text>
                </View>
              </View>
            ))}

            <Pressable onPress={addItem} style={[styles.addItemBtn, { borderColor: theme.borderMedium }]}>
              <Plus size={16} color={theme.textMuted} />
              <Text fontSize={13} fontWeight="500" color={theme.textMuted}>
                Add Another Item
              </Text>
            </Pressable>
          </Card>

          {/* Tax & Totals */}
          <Card backgroundColor={theme.bgCard} padding="$5" borderRadius={16} style={styles.formCard}>
            <SectionHeader title="Tax & Totals" theme={theme} />

            <XStack justifyContent="space-between" paddingVertical="$2.5" borderBottomWidth={1} borderBottomColor={theme.borderSubtle}>
              <Text fontSize={13} color={theme.textSecondary}>Subtotal</Text>
              <Text fontSize={14} fontWeight="500" color={theme.textPrimary}>
                {formData.currency} {subtotal.toFixed(2)}
              </Text>
            </XStack>

            <YStack marginTop="$3">
              <FormField label="Tax Rate (%)" theme={theme}>
                <Input
                  value={formData.taxRate}
                  onChangeText={(value) => setFormData({ ...formData, taxRate: value })}
                  keyboardType="decimal-pad"
                  placeholder="0"
                />
              </FormField>
            </YStack>

            {taxAmount > 0 && (
              <XStack justifyContent="space-between" paddingVertical="$2.5" borderBottomWidth={1} borderBottomColor={theme.borderSubtle}>
                <Text fontSize={13} color={theme.textSecondary}>Tax ({formData.taxRate}%)</Text>
                <Text fontSize={14} fontWeight="500" color={theme.textPrimary}>
                  {formData.currency} {taxAmount.toFixed(2)}
                </Text>
              </XStack>
            )}

            <XStack justifyContent="space-between" paddingTop="$3.5" marginTop="$1">
              <Text fontSize={14} fontWeight="600" color={theme.textPrimary}>Total Due</Text>
              <Text
                fontFamily="CormorantGaramond_500Medium"
                fontSize={28}
                fontWeight="500"
                color={theme.gold}
              >
                {formData.currency} {total.toFixed(2)}
              </Text>
            </XStack>
          </Card>

          {/* Approval Details */}
          <Card backgroundColor={theme.bgCard} padding="$5" borderRadius={16} style={styles.formCard}>
            <SectionHeader title="Approval Details" theme={theme} />

            <FormField label="Requested By" required theme={theme}>
              <Input
                value={formData.requestedBy}
                onChangeText={(value) => setFormData({ ...formData, requestedBy: value })}
                placeholder="Name of person requesting"
              />
            </FormField>

            {/* Approval Checkbox - only show if user can approve */}
            {canApprove && (
              <Pressable
                onPress={handleApprovalToggle}
                style={[
                  styles.approvalBtn,
                  {
                    backgroundColor: isApproved ? theme.jadeSoft : theme.bgSecondary,
                    borderColor: isApproved ? theme.jade : theme.borderSubtle,
                  },
                ]}
              >
                <XStack alignItems="center" gap="$3">
                  {isApproved ? (
                    <CheckSquare size={24} color={theme.jade} />
                  ) : (
                    <Square size={24} color={theme.textMuted} />
                  )}
                  <YStack flex={1}>
                    <Text
                      fontSize={14}
                      fontWeight="600"
                      color={isApproved ? theme.jade : theme.textPrimary}
                    >
                      I approve this voucher
                    </Text>
                    {isApproved && user && (
                      <Text fontSize={12} color={theme.textMuted}>
                        Will be approved by: {user.name}
                      </Text>
                    )}
                  </YStack>
                </XStack>
              </Pressable>
            )}

            {!canApprove && (
              <Text fontSize={13} color={theme.textMuted} marginTop="$2">
                This voucher will be created as a draft and will require approval from an Admin or Accountant.
              </Text>
            )}
          </Card>

          {/* Notes */}
          <Card backgroundColor={theme.bgCard} padding="$5" borderRadius={16} style={styles.formCard}>
            <SectionHeader title="Notes" badge="Optional" theme={theme} />

            <Input
              value={formData.notes}
              onChangeText={(value) => setFormData({ ...formData, notes: value })}
              placeholder="Additional notes for the payment voucher..."
              multiline
              numberOfLines={3}
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
          disabled={isSaving}
          style={[styles.btnPrimary, { opacity: isSaving ? 0.7 : 1 }]}
        >
          <Text fontSize={14} fontWeight="600" color="#FFFFFF">
            {isSaving ? 'Creating...' : isApproved ? 'Create & Approve' : 'Create Draft'}
          </Text>
        </Pressable>
      </XStack>
    </YStack>
  )
}

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
  lineItem: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  deleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lineItemTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderStyle: 'dashed',
  },
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  approvalBtn: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
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
