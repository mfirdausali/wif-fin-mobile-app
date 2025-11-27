/**
 * Invoice Edit Form
 *
 * Matches the WIF Japan design system used in InvoiceCreateForm
 * Pre-populated with existing invoice data for editing
 */

import { useState, memo, useCallback } from 'react'
import { YStack, XStack, Text, ScrollView } from 'tamagui'
import { Plus, X, Calendar } from '@tamagui/lucide-icons'
import { Pressable, StyleSheet, View, Platform, Modal } from 'react-native'
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker'
import * as Haptics from 'expo-haptics'

import { Input, Button, Card } from '../ui'
import type { Invoice, LineItem, Currency } from '../../types'

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

interface InvoiceEditFormProps {
  document: Invoice
  onSave: (updates: Partial<Invoice>) => Promise<void>
  onCancel: () => void
  isSaving: boolean
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

const formatDate = (dateStr: string) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

const formatCurrency = (amount: number, currency: Currency) => {
  const symbol = currency === 'JPY' ? '¥' : 'RM'
  return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: currency === 'JPY' ? 0 : 2 })}`
}

export function InvoiceEditForm({
  document,
  onSave,
  onCancel,
  isSaving,
  theme,
}: InvoiceEditFormProps) {
  const [showDueDatePicker, setShowDueDatePicker] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  const [items, setItems] = useState<LineItem[]>(document.items || [])

  const [formData, setFormData] = useState({
    documentNumber: document.documentNumber,
    customerName: document.customerName,
    customerAddress: document.customerAddress || '',
    customerEmail: document.customerEmail || '',
    dueDate: document.dueDate,
    taxRate: document.taxRate?.toString() || '',
    paymentTerms: document.paymentTerms || '',
    notes: document.notes || '',
  })

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

  const handleDueDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDueDatePicker(false)
    }
    if (selectedDate) {
      setFormData({ ...formData, dueDate: selectedDate.toISOString().split('T')[0] })
    }
  }

  const openDueDatePicker = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setShowDueDatePicker(true)
  }

  const validate = () => {
    if (!formData.documentNumber.trim()) {
      setValidationError('Invoice number is required')
      return false
    }
    if (!formData.customerName.trim()) {
      setValidationError('Customer name is required')
      return false
    }
    if (!formData.dueDate) {
      setValidationError('Due date is required')
      return false
    }
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

  const handleSave = async () => {
    if (!validate()) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      return
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    const { subtotal, taxAmount, total } = calculateTotals()

    const updates: Partial<Invoice> = {
      documentNumber: formData.documentNumber,
      customerName: formData.customerName,
      customerAddress: formData.customerAddress || undefined,
      customerEmail: formData.customerEmail || undefined,
      dueDate: formData.dueDate,
      items,
      subtotal,
      taxRate: parseFloat(formData.taxRate) || undefined,
      taxAmount: taxAmount > 0 ? taxAmount : undefined,
      total,
      amount: total,
      paymentTerms: formData.paymentTerms || undefined,
      notes: formData.notes || undefined,
    }

    await onSave(updates)
  }

  const { subtotal, taxAmount, total } = calculateTotals()

  return (
    <YStack flex={1}>
      {/* Content */}
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

          {/* Invoice Details */}
          <Card backgroundColor={theme.bgCard} padding="$5" borderRadius={16} style={styles.formCard}>
            <SectionHeader title="Invoice Details" theme={theme} />

            <FormField label="Invoice Number" required theme={theme}>
              <Input
                value={formData.documentNumber}
                onChangeText={(value) => setFormData({ ...formData, documentNumber: value })}
                placeholder="INV-001"
              />
            </FormField>

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

            {/* iOS Date Picker - centered modal with DD Month YYYY format */}
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
                      minimumDate={new Date(document.invoiceDate)}
                      locale="en-GB"
                      themeVariant="light"
                      style={{ height: 200 }}
                    />
                  </Pressable>
                </Pressable>
              </Modal>
            )}

            {/* Android Date Picker */}
            {Platform.OS === 'android' && showDueDatePicker && (
              <DateTimePicker
                value={formData.dueDate ? new Date(formData.dueDate) : new Date()}
                mode="date"
                display="default"
                onChange={handleDueDateChange}
                minimumDate={new Date(document.invoiceDate)}
              />
            )}

            <FormField label="Payment Terms" theme={theme}>
              <Input
                value={formData.paymentTerms}
                onChangeText={(value) => setFormData({ ...formData, paymentTerms: value })}
                placeholder="e.g., Net 30"
              />
            </FormField>
          </Card>

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
                    {formatCurrency(item.amount, document.currency)}
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

            <FormField label="Tax Rate (%)" theme={theme}>
              <Input
                value={formData.taxRate}
                onChangeText={(value) => setFormData({ ...formData, taxRate: value })}
                placeholder="0"
                keyboardType="decimal-pad"
              />
            </FormField>

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

          {/* Totals */}
          <Card backgroundColor={theme.bgCard} padding="$5" borderRadius={16} style={styles.totalsCard}>
            <View style={[styles.totalsAccent, { backgroundColor: theme.gold }]} />

            <XStack justifyContent="space-between" paddingVertical="$2.5" borderBottomWidth={1} borderBottomColor={theme.borderSubtle}>
              <Text fontSize={13} color={theme.textSecondary}>Subtotal</Text>
              <Text fontSize={14} fontWeight="500" color={theme.textPrimary}>
                {formatCurrency(subtotal, document.currency)}
              </Text>
            </XStack>

            {taxAmount > 0 && (
              <XStack justifyContent="space-between" paddingVertical="$2.5" borderBottomWidth={1} borderBottomColor={theme.borderSubtle}>
                <Text fontSize={13} color={theme.textSecondary}>Tax ({formData.taxRate}%)</Text>
                <Text fontSize={14} fontWeight="500" color={theme.textPrimary}>
                  {formatCurrency(taxAmount, document.currency)}
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
                {formatCurrency(total, document.currency)}
              </Text>
            </XStack>
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
        <Pressable
          onPress={onCancel}
          style={styles.btnGhost}
        >
          <Text fontSize={14} fontWeight="500" color={theme.textMuted}>
            Cancel
          </Text>
        </Pressable>

        <Pressable
          onPress={handleSave}
          disabled={isSaving}
          style={[styles.btnPrimary, { opacity: isSaving ? 0.7 : 1 }]}
        >
          <Text fontSize={14} fontWeight="600" color="#FFFFFF">
            {isSaving ? 'Saving...' : 'Save Changes'}
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
})
