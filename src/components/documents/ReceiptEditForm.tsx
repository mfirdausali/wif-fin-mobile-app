import { useState } from 'react'
import { YStack, Text } from 'tamagui'
import * as Haptics from 'expo-haptics'

import { Input, Button, Card } from '../ui'
import type { Receipt } from '../../types'

interface ReceiptEditFormProps {
  document: Receipt
  onSave: (updates: Partial<Receipt>) => Promise<void>
  isSaving: boolean
}

const PAYMENT_METHODS = [
  'Bank Transfer',
  'Cash',
  'Cheque',
  'Credit Card',
  'Online Payment',
]

export function ReceiptEditForm({ document, onSave, isSaving }: ReceiptEditFormProps) {
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
    <YStack flex={1} gap="$4">
      {/* Receipt Details */}
      <Card>
        <Text fontSize="$5" fontWeight="600" color="$color" marginBottom="$3">
          Receipt Details
        </Text>

        <Input
          label="Receipt Number *"
          value={formData.documentNumber}
          onChangeText={(value) => setFormData({ ...formData, documentNumber: value })}
          placeholder="REC-001"
          error={!!errors.documentNumber}
          errorText={errors.documentNumber}
        />

        <Input
          label="Receipt Date *"
          value={formData.receiptDate}
          onChangeText={(value) => setFormData({ ...formData, receiptDate: value })}
          placeholder="YYYY-MM-DD"
        />
      </Card>

      {/* Payer Details */}
      <Card>
        <Text fontSize="$5" fontWeight="600" color="$color" marginBottom="$3">
          Payer Details
        </Text>

        <Input
          label="Payer Name *"
          value={formData.payerName}
          onChangeText={(value) => setFormData({ ...formData, payerName: value })}
          error={!!errors.payerName}
          errorText={errors.payerName}
        />

        <Input
          label="Payer Contact"
          value={formData.payerContact}
          onChangeText={(value) => setFormData({ ...formData, payerContact: value })}
          placeholder="Phone or email"
        />
      </Card>

      {/* Payment Details */}
      <Card>
        <Text fontSize="$5" fontWeight="600" color="$color" marginBottom="$3">
          Payment Details
        </Text>

        <Input
          label="Amount *"
          value={formData.amount}
          onChangeText={(value) => setFormData({ ...formData, amount: value })}
          keyboardType="decimal-pad"
          placeholder="0.00"
          error={!!errors.amount}
          errorText={errors.amount}
        />

        <YStack gap="$2">
          <Text fontSize="$4" fontWeight="500" color="$color">
            Payment Method *
          </Text>
          {errors.paymentMethod && (
            <Text fontSize="$3" color="$red10">
              {errors.paymentMethod}
            </Text>
          )}
          <YStack gap="$2">
            {PAYMENT_METHODS.map((method) => (
              <Button
                key={method}
                variant={formData.paymentMethod === method ? 'primary' : 'outline'}
                onPress={async () => {
                  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  setFormData({ ...formData, paymentMethod: method })
                }}
              >
                <Text
                  color={
                    formData.paymentMethod === method ? '#FFFFFF' : '$color'
                  }
                  fontWeight={formData.paymentMethod === method ? '600' : '400'}
                >
                  {method}
                </Text>
              </Button>
            ))}
          </YStack>
        </YStack>

        <Input
          label="Received By *"
          value={formData.receivedBy}
          onChangeText={(value) => setFormData({ ...formData, receivedBy: value })}
          placeholder="Name of person who received payment"
          error={!!errors.receivedBy}
          errorText={errors.receivedBy}
        />
      </Card>

      {/* Notes */}
      <Card>
        <Input
          label="Notes"
          value={formData.notes}
          onChangeText={(value) => setFormData({ ...formData, notes: value })}
          multiline
          numberOfLines={3}
          placeholder="Additional notes..."
        />
      </Card>

      {/* Save Button */}
      <Button
        variant="primary"
        size="lg"
        onPress={handleSave}
        disabled={isSaving}
      >
        <Text color="#FFFFFF" fontWeight="600">
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Text>
      </Button>
    </YStack>
  )
}
