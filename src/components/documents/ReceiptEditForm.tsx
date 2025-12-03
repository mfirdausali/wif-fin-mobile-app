import { useState, memo } from 'react'
import { YStack, XStack, Text, ScrollView } from 'tamagui'
import { Pressable, StyleSheet, Platform, Modal, View } from 'react-native'
import { Calendar } from '@tamagui/lucide-icons'
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker'
import * as Haptics from 'expo-haptics'

import { Input, Button, Card } from '../ui'
import type { Receipt } from '../../types'

// Section Header Component
const SectionHeader = memo(({
  title,
  theme
}: {
  title: string;
  theme: { gold: string; textMuted: string };
}) => (
  <XStack alignItems="center" gap="$2" marginBottom="$4">
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
))

SectionHeader.displayName = 'SectionHeader'

// Form Field Component
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

interface ReceiptEditFormProps {
  document: Receipt
  onSave: (updates: Partial<Receipt>) => Promise<void>
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

const PAYMENT_METHODS = [
  'Bank Transfer',
  'Cash',
  'Cheque',
  'Credit Card',
  'Online Payment',
]

const formatDate = (dateStr: string) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function ReceiptEditForm({ document, onSave, onCancel, isSaving, theme }: ReceiptEditFormProps) {
  const [showReceiptDatePicker, setShowReceiptDatePicker] = useState(false)
  const [formData, setFormData] = useState({
    documentNumber: document.documentNumber,
    payerName: document.payerName,
    payerContact: document.payerContact || '',
    receiptDate: document.receiptDate,
    paymentMethod: document.paymentMethod,
    receivedBy: document.receivedBy,
    amount: document.amount.toString(),
    notes: document.notes || '',
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleReceiptDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowReceiptDatePicker(false)
    }
    if (selectedDate) {
      setFormData({ ...formData, receiptDate: selectedDate.toISOString().split('T')[0] })
    }
  }

  const openReceiptDatePicker = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setShowReceiptDatePicker(true)
  }

  const validate = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.documentNumber.trim()) {
      newErrors.documentNumber = 'Receipt number is required'
    }
    if (!formData.payerName.trim()) {
      newErrors.payerName = 'Payer name is required'
    }
    if (!formData.paymentMethod.trim()) {
      newErrors.paymentMethod = 'Payment method is required'
    }
    if (!formData.receivedBy.trim()) {
      newErrors.receivedBy = 'Received by field is required'
    }
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      newErrors.amount = 'Valid amount is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async () => {
    if (!validate()) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      return
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    const updates: Partial<Receipt> = {
      documentNumber: formData.documentNumber,
      payerName: formData.payerName,
      payerContact: formData.payerContact || undefined,
      receiptDate: formData.receiptDate,
      paymentMethod: formData.paymentMethod,
      receivedBy: formData.receivedBy,
      amount: parseFloat(formData.amount),
      notes: formData.notes || undefined,
    }

    await onSave(updates)
  }

  return (
    <YStack flex={1}>
      <ScrollView flex={1} showsVerticalScrollIndicator={false}>
        <YStack padding="$5" gap="$4">
          {/* Receipt Details */}
          <Card backgroundColor={theme.bgCard} padding="$5" borderRadius={16} style={styles.formCard}>
            <SectionHeader title="Receipt Details" theme={theme} />

            <FormField label="Receipt Number" required theme={theme}>
              <Input
                value={formData.documentNumber}
                onChangeText={(value) => setFormData({ ...formData, documentNumber: value })}
                placeholder="REC-001"
                error={!!errors.documentNumber}
                errorText={errors.documentNumber}
              />
            </FormField>

            <FormField label="Receipt Date" required theme={theme}>
              <Pressable
                onPress={openReceiptDatePicker}
                style={[styles.dateInput, { borderColor: theme.borderSubtle, backgroundColor: theme.bgCard }]}
              >
                <Text
                  fontSize={14}
                  fontWeight="500"
                  color={formData.receiptDate ? theme.textPrimary : theme.textFaint}
                >
                  {formatDate(formData.receiptDate)}
                </Text>
                <Calendar size={18} color={theme.textMuted} />
              </Pressable>
            </FormField>

            {/* iOS Date Picker */}
            {Platform.OS === 'ios' && showReceiptDatePicker && (
              <Modal
                transparent
                animationType="fade"
                visible={showReceiptDatePicker}
                onRequestClose={() => setShowReceiptDatePicker(false)}
              >
                <Pressable
                  style={styles.datePickerOverlay}
                  onPress={() => setShowReceiptDatePicker(false)}
                >
                  <Pressable style={[styles.datePickerContainer, { backgroundColor: theme.bgCard }]}>
                    <XStack justifyContent="space-between" alignItems="center" paddingHorizontal="$4" paddingVertical="$3" borderBottomWidth={1} borderBottomColor={theme.borderSubtle}>
                      <Text fontSize={17} fontWeight="600" color={theme.textPrimary}>Receipt Date</Text>
                      <Pressable onPress={() => setShowReceiptDatePicker(false)} hitSlop={8}>
                        <Text fontSize={17} fontWeight="600" color={theme.gold}>Done</Text>
                      </Pressable>
                    </XStack>
                    <DateTimePicker
                      value={new Date(formData.receiptDate)}
                      mode="date"
                      display="spinner"
                      onChange={handleReceiptDateChange}
                      locale="en-GB"
                      themeVariant="light"
                      style={{ height: 200 }}
                    />
                  </Pressable>
                </Pressable>
              </Modal>
            )}

            {/* Android Date Picker */}
            {Platform.OS === 'android' && showReceiptDatePicker && (
              <DateTimePicker
                value={new Date(formData.receiptDate)}
                mode="date"
                display="default"
                onChange={handleReceiptDateChange}
              />
            )}
          </Card>

          {/* Payer Details */}
          <Card backgroundColor={theme.bgCard} padding="$5" borderRadius={16} style={styles.formCard}>
            <SectionHeader title="Payer Details" theme={theme} />

            <FormField label="Payer Name" required theme={theme}>
              <Input
                value={formData.payerName}
                onChangeText={(value) => setFormData({ ...formData, payerName: value })}
                placeholder="Company or individual name"
                error={!!errors.payerName}
                errorText={errors.payerName}
              />
            </FormField>

            <FormField label="Payer Contact" theme={theme}>
              <Input
                value={formData.payerContact}
                onChangeText={(value) => setFormData({ ...formData, payerContact: value })}
                placeholder="Phone or email"
              />
            </FormField>
          </Card>

          {/* Payment Details */}
          <Card backgroundColor={theme.bgCard} padding="$5" borderRadius={16} style={styles.formCard}>
            <SectionHeader title="Payment Details" theme={theme} />

            <FormField label="Amount" required theme={theme}>
              <Input
                value={formData.amount}
                onChangeText={(value) => setFormData({ ...formData, amount: value })}
                keyboardType="decimal-pad"
                placeholder="0.00"
                error={!!errors.amount}
                errorText={errors.amount}
              />
            </FormField>

            <FormField label="Payment Method" required theme={theme}>
              {errors.paymentMethod && (
                <Text fontSize={12} color={theme.vermillion} marginBottom="$2">
                  {errors.paymentMethod}
                </Text>
              )}
              <YStack gap="$2">
                {PAYMENT_METHODS.map((method) => (
                  <Pressable
                    key={method}
                    onPress={async () => {
                      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                      setFormData({ ...formData, paymentMethod: method })
                    }}
                    style={[
                      styles.methodButton,
                      { borderColor: formData.paymentMethod === method ? theme.gold : theme.borderSubtle },
                      formData.paymentMethod === method && { backgroundColor: theme.goldSoft }
                    ]}
                  >
                    <Text
                      color={formData.paymentMethod === method ? theme.gold : theme.textSecondary}
                      fontWeight={formData.paymentMethod === method ? '600' : '400'}
                      fontSize={14}
                    >
                      {method}
                    </Text>
                  </Pressable>
                ))}
              </YStack>
            </FormField>

            <FormField label="Received By" required theme={theme}>
              <Input
                value={formData.receivedBy}
                onChangeText={(value) => setFormData({ ...formData, receivedBy: value })}
                placeholder="Name of person who received payment"
                error={!!errors.receivedBy}
                errorText={errors.receivedBy}
              />
            </FormField>
          </Card>

          {/* Notes */}
          <Card backgroundColor={theme.bgCard} padding="$5" borderRadius={16} style={styles.formCard}>
            <SectionHeader title="Notes" theme={theme} />
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

      {/* Action Buttons */}
      <View style={[styles.actionBar, { backgroundColor: theme.bgCard, borderTopColor: theme.borderSubtle }]}>
        <Pressable
          onPress={onCancel}
          style={[styles.cancelButton, { borderColor: theme.borderMedium }]}
        >
          <Text color={theme.textSecondary} fontWeight="600" fontSize={14}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={handleSave}
          disabled={isSaving}
          style={[styles.saveButton, { backgroundColor: theme.gold, opacity: isSaving ? 0.6 : 1 }]}
        >
          <Text color="#FFFFFF" fontWeight="600" fontSize={14}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Text>
        </Pressable>
      </View>
    </YStack>
  )
}

const styles = StyleSheet.create({
  formCard: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionAccent: {
    width: 3,
    height: 14,
    borderRadius: 2,
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
  methodButton: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 10,
  },
  actionBar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1.5,
  },
  saveButton: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
})
