/**
 * Invoice Create Form - Multi-step Wizard
 *
 * 3-Step wizard matching the WIF Japan design system:
 * Step 1: Invoice & Customer Details
 * Step 2: Line Items & Tax
 * Step 3: Review & Create
 */

import { useState, memo, useCallback } from 'react'
import { YStack, XStack, Text, ScrollView } from 'tamagui'
import { Plus, X, Calendar, ChevronLeft } from '@tamagui/lucide-icons'
import { Pressable, StyleSheet, View, Platform, Modal } from 'react-native'
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker'
import * as Haptics from 'expo-haptics'

import { Input, Button, Card } from '../ui'
import type { Invoice, LineItem, Currency, Country, Account, Document, UserReference } from '../../types'

// Form Input with Label - Moved OUTSIDE component to prevent re-creation
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

// Section Header Component - Moved OUTSIDE
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

interface InvoiceCreateFormProps {
  accounts: Account[]
  onSubmit: (document: Omit<Document, 'id' | 'createdAt' | 'updatedAt' | 'documentNumber'>) => Promise<void>
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

const formatCurrency = (amount: number, currency: Currency) => {
  const symbol = currency === 'JPY' ? '¥' : 'RM'
  return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: currency === 'JPY' ? 0 : 2 })}`
}

export function InvoiceCreateForm({
  accounts,
  onSubmit,
  onCancel,
  isSaving,
  user,
  theme,
}: InvoiceCreateFormProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [showInvoiceDatePicker, setShowInvoiceDatePicker] = useState(false)
  const [showDueDatePicker, setShowDueDatePicker] = useState(false)

  const [items, setItems] = useState<LineItem[]>([
    { id: '1', description: '', quantity: 1, unitPrice: 0, amount: 0 },
  ])

  const [formData, setFormData] = useState({
    customerName: '',
    customerAddress: '',
    customerEmail: '',
    invoiceDate: getTodayISO(),
    dueDate: '',
    currency: 'MYR' as Currency,
    country: 'Malaysia' as Country,
    accountId: '',
    taxRate: '',
    paymentTerms: '',
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

  const handleInvoiceDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowInvoiceDatePicker(false)
    }
    if (selectedDate) {
      setFormData({ ...formData, invoiceDate: selectedDate.toISOString().split('T')[0] })
    }
  }

  const handleDueDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDueDatePicker(false)
    }
    if (selectedDate) {
      setFormData({ ...formData, dueDate: selectedDate.toISOString().split('T')[0] })
    }
  }

  const openInvoiceDatePicker = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setShowInvoiceDatePicker(true)
  }

  const openDueDatePicker = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setShowDueDatePicker(true)
  }

  const validateStep1 = () => {
    if (!formData.customerName.trim()) {
      setValidationError('Customer name is required')
      return false
    }
    if (!formData.dueDate) {
      setValidationError('Due date is required')
      return false
    }
    setValidationError(null)
    return true
  }

  const validateStep2 = () => {
    if (items.some((item) => !item.description.trim())) {
      setValidationError('All line items must have a description')
      return false
    }
    if (items.every((item) => item.amount === 0)) {
      setValidationError('At least one item must have a value')
      return false
    }
    setValidationError(null)
    return true
  }

  const handleNext = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    if (currentStep === 1 && validateStep1()) {
      setCurrentStep(2)
    } else if (currentStep === 2 && validateStep2()) {
      setCurrentStep(3)
    }
  }

  const handleBack = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
      setValidationError(null)
    } else {
      onCancel()
    }
  }

  const handleSubmit = async () => {
    const { subtotal, taxAmount, total } = calculateTotals()
    const selectedAccount = accounts.find((acc) => acc.id === formData.accountId)

    const userReference: UserReference | undefined = user
      ? { id: user.id, name: user.name, username: user.username }
      : undefined

    const invoice: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt' | 'documentNumber'> = {
      documentType: 'invoice',
      date: formData.invoiceDate,
      status: 'issued',
      currency: formData.currency,
      country: formData.country,
      amount: total,
      accountId: formData.accountId || undefined,
      accountName: selectedAccount?.name || undefined,
      customerName: formData.customerName,
      customerAddress: formData.customerAddress || undefined,
      customerEmail: formData.customerEmail || undefined,
      invoiceDate: formData.invoiceDate,
      dueDate: formData.dueDate,
      items: items,
      subtotal: subtotal,
      taxRate: parseFloat(formData.taxRate) || undefined,
      taxAmount: taxAmount > 0 ? taxAmount : undefined,
      total: total,
      paymentTerms: formData.paymentTerms || undefined,
      notes: formData.notes || undefined,
      createdBy: userReference,
      updatedBy: userReference,
    }

    await onSubmit(invoice)
  }

  const { subtotal, taxAmount, total } = calculateTotals()

  // Progress Indicator - Refined: larger dots, better visibility
  const ProgressIndicator = () => (
    <XStack justifyContent="center" gap="$2" paddingVertical="$3">
      {[1, 2, 3].map((step) => (
        <View
          key={step}
          style={[
            styles.progressDot,
            step < currentStep && { backgroundColor: theme.textPrimary },
            step === currentStep && {
              backgroundColor: theme.gold,
              width: 28,
              borderRadius: 3,
            },
            step > currentStep && { backgroundColor: 'rgba(26, 24, 21, 0.15)' },
          ]}
        />
      ))}
    </XStack>
  )

  // Step 1: Invoice & Customer Details
  const renderStep1 = () => (
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

        {/* Invoice Details */}
        <Card backgroundColor={theme.bgCard} padding="$5" borderRadius={16} style={styles.formCard}>
          <SectionHeader title="Invoice Details" theme={theme} />

          <XStack gap="$3">
            <YStack flex={1}>
              <FormField label="Invoice Date" required theme={theme}>
                <Pressable
                  onPress={openInvoiceDatePicker}
                  style={[styles.dateInput, { borderColor: theme.borderSubtle, backgroundColor: theme.bgCard }]}
                >
                  <Text fontSize={14} fontWeight="500" color={theme.textPrimary}>
                    {formatDate(formData.invoiceDate)}
                  </Text>
                  <Calendar size={18} color={theme.textMuted} />
                </Pressable>
              </FormField>
            </YStack>
            <YStack flex={1}>
              <FormField label="Due Date" required theme={theme}>
                <Pressable
                  onPress={openDueDatePicker}
                  style={[styles.dateInput, { borderColor: theme.borderSubtle, backgroundColor: theme.bgCard }]}
                >
                  <Text
                    fontSize={14}
                    fontWeight="500"
                    color={formData.dueDate ? theme.textPrimary : theme.textFaint}
                  >
                    {formData.dueDate ? formatDate(formData.dueDate) : 'Select date'}
                  </Text>
                  <Calendar size={18} color={theme.textMuted} />
                </Pressable>
              </FormField>
            </YStack>
          </XStack>

          {/* iOS Date Pickers - centered modal with DD Month YYYY format */}
          {Platform.OS === 'ios' && showInvoiceDatePicker && (
            <Modal
              transparent
              animationType="fade"
              visible={showInvoiceDatePicker}
              onRequestClose={() => setShowInvoiceDatePicker(false)}
            >
              <Pressable
                style={styles.datePickerOverlay}
                onPress={() => setShowInvoiceDatePicker(false)}
              >
                <Pressable style={[styles.datePickerContainer, { backgroundColor: theme.bgCard }]}>
                  <XStack justifyContent="space-between" alignItems="center" paddingHorizontal="$4" paddingVertical="$3" borderBottomWidth={1} borderBottomColor={theme.borderSubtle}>
                    <Text fontSize={17} fontWeight="600" color={theme.textPrimary}>Invoice Date</Text>
                    <Pressable onPress={() => setShowInvoiceDatePicker(false)} hitSlop={8}>
                      <Text fontSize={17} fontWeight="600" color={theme.gold}>Done</Text>
                    </Pressable>
                  </XStack>
                  <DateTimePicker
                    value={new Date(formData.invoiceDate)}
                    mode="date"
                    display="spinner"
                    onChange={handleInvoiceDateChange}
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
                    <Text fontSize={17} fontWeight="600" color={theme.textPrimary}>Due Date</Text>
                    <Pressable onPress={() => setShowDueDatePicker(false)} hitSlop={8}>
                      <Text fontSize={17} fontWeight="600" color={theme.gold}>Done</Text>
                    </Pressable>
                  </XStack>
                  <DateTimePicker
                    value={formData.dueDate ? new Date(formData.dueDate) : new Date()}
                    mode="date"
                    display="spinner"
                    onChange={handleDueDateChange}
                    minimumDate={new Date(formData.invoiceDate)}
                    locale="en-GB"
                    themeVariant="light"
                    style={{ height: 200 }}
                  />
                </Pressable>
              </Pressable>
            </Modal>
          )}

          {/* Android Date Pickers */}
          {Platform.OS === 'android' && showInvoiceDatePicker && (
            <DateTimePicker
              value={new Date(formData.invoiceDate)}
              mode="date"
              display="default"
              onChange={handleInvoiceDateChange}
            />
          )}

          {Platform.OS === 'android' && showDueDatePicker && (
            <DateTimePicker
              value={formData.dueDate ? new Date(formData.dueDate) : new Date()}
              mode="date"
              display="default"
              onChange={handleDueDateChange}
              minimumDate={new Date(formData.invoiceDate)}
            />
          )}
        </Card>

        {/* Customer Details */}
        <Card backgroundColor={theme.bgCard} padding="$5" borderRadius={16} style={styles.formCard}>
          <SectionHeader title="Customer" theme={theme} />

          <FormField label="Customer Name" required theme={theme}>
            <Input
              value={formData.customerName}
              onChangeText={(value) => setFormData({ ...formData, customerName: value })}
              placeholder="Company or individual name"
            />
          </FormField>

          <FormField label="Email Address" theme={theme}>
            <Input
              value={formData.customerEmail}
              onChangeText={(value) => setFormData({ ...formData, customerEmail: value })}
              placeholder="billing@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </FormField>

          <FormField label="Billing Address" theme={theme}>
            <Input
              value={formData.customerAddress}
              onChangeText={(value) => setFormData({ ...formData, customerAddress: value })}
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
      </YStack>
    </ScrollView>
  )

  // Step 2: Line Items & Tax
  const renderStep2 = () => (
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

        {/* Line Items */}
        <Card backgroundColor={theme.bgCard} padding="$5" borderRadius={16} style={styles.formCard}>
          <SectionHeader title="Line Items" badge={`${items.length} Item${items.length > 1 ? 's' : ''}`} theme={theme} />

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
                      onChangeText={(value) => updateItem(item.id, 'quantity', parseFloat(value) || 0)}
                      keyboardType="numeric"
                    />
                  </FormField>
                </YStack>
                <YStack flex={1}>
                  <FormField label="Unit Price" theme={theme}>
                    <Input
                      value={item.unitPrice.toString()}
                      onChangeText={(value) => updateItem(item.id, 'unitPrice', parseFloat(value) || 0)}
                      keyboardType="decimal-pad"
                    />
                  </FormField>
                </YStack>
              </XStack>

              <View style={[styles.lineItemTotal, { borderTopColor: theme.borderSubtle }]}>
                <Text fontSize={12} color={theme.textMuted}>Subtotal</Text>
                <Text fontSize={14} fontWeight="600" color={theme.textPrimary}>
                  {formatCurrency(item.amount, formData.currency)}
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

        {/* Additional */}
        <Card backgroundColor={theme.bgCard} padding="$5" borderRadius={16} style={styles.formCard}>
          <SectionHeader title="Additional" theme={theme} />

          <XStack gap="$3">
            <YStack flex={1}>
              <FormField label="Tax Rate (%)" theme={theme}>
                <Input
                  value={formData.taxRate}
                  onChangeText={(value) => setFormData({ ...formData, taxRate: value })}
                  placeholder="0"
                  keyboardType="decimal-pad"
                />
              </FormField>
            </YStack>
            <YStack flex={1}>
              <FormField label="Payment Terms" theme={theme}>
                <Input
                  value={formData.paymentTerms}
                  onChangeText={(value) => setFormData({ ...formData, paymentTerms: value })}
                  placeholder="e.g., Net 30"
                />
              </FormField>
            </YStack>
          </XStack>

          <FormField label="Notes" theme={theme}>
            <Input
              value={formData.notes}
              onChangeText={(value) => setFormData({ ...formData, notes: value })}
              placeholder="Additional notes for the customer..."
              multiline
              numberOfLines={3}
            />
          </FormField>
        </Card>
      </YStack>
    </ScrollView>
  )

  // Step 3: Review & Create
  const renderStep3 = () => (
    <ScrollView flex={1} showsVerticalScrollIndicator={false}>
      <YStack padding="$5" gap="$4">
        {/* Summary Card (Dark) */}
        <View style={styles.summaryCard}>
          <Text fontSize={10} letterSpacing={1} textTransform="uppercase" color="rgba(255,255,255,0.6)" marginBottom="$1">
            Invoice For
          </Text>
          <Text
            fontFamily="CormorantGaramond_500Medium"
            fontSize={20}
            fontWeight="500"
            color="#FFFFFF"
            marginBottom="$4"
          >
            {formData.customerName}
          </Text>

          <XStack gap="$6">
            <YStack>
              <Text fontSize={10} letterSpacing={0.8} textTransform="uppercase" color="rgba(255,255,255,0.5)" marginBottom="$0.5">
                Invoice Date
              </Text>
              <Text fontSize={13} fontWeight="500" color="#FFFFFF">
                {formatDate(formData.invoiceDate)}
              </Text>
            </YStack>
            <YStack>
              <Text fontSize={10} letterSpacing={0.8} textTransform="uppercase" color="rgba(255,255,255,0.5)" marginBottom="$0.5">
                Due Date
              </Text>
              <Text fontSize={13} fontWeight="500" color="#FFFFFF">
                {formatDate(formData.dueDate)}
              </Text>
            </YStack>
            <YStack>
              <Text fontSize={10} letterSpacing={0.8} textTransform="uppercase" color="rgba(255,255,255,0.5)" marginBottom="$0.5">
                Currency
              </Text>
              <Text fontSize={13} fontWeight="500" color="#FFFFFF">
                {formData.currency}
              </Text>
            </YStack>
          </XStack>
        </View>

        {/* Items Summary */}
        <Card backgroundColor={theme.bgCard} padding="$5" borderRadius={16} style={styles.formCard}>
          <SectionHeader title="Items" badge={`${items.length} Item${items.length > 1 ? 's' : ''}`} theme={theme} />

          {items.map((item) => (
            <XStack
              key={item.id}
              justifyContent="space-between"
              alignItems="flex-start"
              paddingVertical="$3"
              borderBottomWidth={1}
              borderBottomColor={theme.borderSubtle}
            >
              <YStack flex={1} marginRight="$3">
                <Text fontSize={14} fontWeight="500" color={theme.textPrimary} marginBottom="$0.5">
                  {item.description || 'Untitled Item'}
                </Text>
                <Text fontSize={12} color={theme.textMuted}>
                  {item.quantity} × {formatCurrency(item.unitPrice, formData.currency)}
                </Text>
              </YStack>
              <Text fontSize={14} fontWeight="600" color={theme.textPrimary}>
                {formatCurrency(item.amount, formData.currency)}
              </Text>
            </XStack>
          ))}
        </Card>

        {/* Totals */}
        <Card backgroundColor={theme.bgCard} padding="$5" borderRadius={16} style={styles.totalsCard}>
          <View style={[styles.totalsAccent, { backgroundColor: theme.gold }]} />

          <XStack justifyContent="space-between" paddingVertical="$2.5" borderBottomWidth={1} borderBottomColor={theme.borderSubtle}>
            <Text fontSize={13} color={theme.textSecondary}>Subtotal</Text>
            <Text fontSize={14} fontWeight="500" color={theme.textPrimary}>
              {formatCurrency(subtotal, formData.currency)}
            </Text>
          </XStack>

          {taxAmount > 0 && (
            <XStack justifyContent="space-between" paddingVertical="$2.5" borderBottomWidth={1} borderBottomColor={theme.borderSubtle}>
              <Text fontSize={13} color={theme.textSecondary}>Tax ({formData.taxRate}%)</Text>
              <Text fontSize={14} fontWeight="500" color={theme.textPrimary}>
                {formatCurrency(taxAmount, formData.currency)}
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
              {formatCurrency(total, formData.currency)}
            </Text>
          </XStack>
        </Card>

        {/* Receiving Account */}
        <Card backgroundColor={theme.bgCard} padding="$5" borderRadius={16} style={styles.formCard}>
          <SectionHeader title="Receiving Account" theme={theme} />

          <XStack gap="$2" flexWrap="wrap">
            <Pressable
              onPress={() => setFormData({ ...formData, accountId: '' })}
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
                onPress={() => setFormData({ ...formData, accountId: account.id })}
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
      </YStack>
    </ScrollView>
  )

  return (
    <YStack flex={1}>
      {/* Progress Indicator */}
      <ProgressIndicator />

      {/* Step Content */}
      {currentStep === 1 && renderStep1()}
      {currentStep === 2 && renderStep2()}
      {currentStep === 3 && renderStep3()}

      {/* Footer Actions - Refined: ghost Cancel button */}
      <XStack
        padding="$4"
        paddingHorizontal="$5"
        gap="$3"
        backgroundColor={theme.bgCard}
        borderTopWidth={1}
        borderTopColor={theme.borderSubtle}
      >
        <Pressable
          onPress={handleBack}
          style={styles.btnGhost}
        >
          <Text fontSize={14} fontWeight="500" color={theme.textMuted}>
            {currentStep === 1 ? 'Cancel' : 'Back'}
          </Text>
        </Pressable>

        <Pressable
          onPress={currentStep === 3 ? handleSubmit : handleNext}
          disabled={isSaving}
          style={[styles.btnPrimary, { opacity: isSaving ? 0.7 : 1 }]}
        >
          <Text fontSize={14} fontWeight="600" color="#FFFFFF">
            {isSaving ? 'Creating...' : currentStep === 3 ? 'Create Invoice' : 'Continue'}
          </Text>
        </Pressable>
      </XStack>
    </YStack>
  )
}

const styles = StyleSheet.create({
  progressDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
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
  summaryCard: {
    backgroundColor: '#1A1815',
    borderRadius: 16,
    padding: 20,
  },
  totalsCard: {
    position: 'relative',
    overflow: 'hidden',
  },
  totalsAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
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
  formCard: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
})
