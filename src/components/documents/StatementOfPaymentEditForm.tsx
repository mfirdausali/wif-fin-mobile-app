import { useState } from 'react'
import { YStack, XStack, Text } from 'tamagui'
import * as Haptics from 'expo-haptics'

import { Input, Button, Card } from '../ui'
import type { StatementOfPayment } from '../../types'

interface StatementOfPaymentEditFormProps {
  document: StatementOfPayment
  onSave: (updates: Partial<StatementOfPayment>) => Promise<void>
  isSaving: boolean
}

const PAYMENT_METHODS = [
  'Bank Transfer',
  'Wire Transfer',
  'Cheque',
  'Online Payment',
]

const TRANSACTION_FEE_TYPES = [
  'ATM Withdrawal Fee',
  'Wire Transfer Fee',
  'International Transfer Fee',
  'Currency Conversion Fee',
  'Bank Service Charge',
]

export function StatementOfPaymentEditForm({
  document,
  onSave,
  isSaving,
}: StatementOfPaymentEditFormProps) {
  const [formData, setFormData] = useState({
    paymentDate: document.paymentDate,
    paymentMethod: document.paymentMethod,
    transactionReference: document.transactionReference,
    confirmedBy: document.confirmedBy,
    transactionFee: document.transactionFee?.toString() || '0',
    transactionFeeType: document.transactionFeeType || '',
    notes: document.notes || '',
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  const calculateTotalDeducted = () => {
    const transactionFee = parseFloat(formData.transactionFee) || 0
    return document.total + transactionFee
  }

  const validate = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.paymentMethod.trim()) {
      newErrors.paymentMethod = 'Payment method is required'
    }
    if (!formData.transactionReference.trim()) {
      newErrors.transactionReference = 'Transaction reference is required'
    }
    if (!formData.confirmedBy.trim()) {
      newErrors.confirmedBy = 'Confirmed by field is required'
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

    const transactionFee = parseFloat(formData.transactionFee) || 0
    const totalDeducted = document.total + transactionFee

    const updates: Partial<StatementOfPayment> = {
      paymentDate: formData.paymentDate,
      paymentMethod: formData.paymentMethod,
      transactionReference: formData.transactionReference,
      confirmedBy: formData.confirmedBy,
      transactionFee: transactionFee > 0 ? transactionFee : undefined,
      transactionFeeType: formData.transactionFeeType || undefined,
      totalDeducted,
      notes: formData.notes || undefined,
    }

    await onSave(updates)
  }

  return (
    <YStack flex={1} gap="$4">
      {/* Linked Voucher Info */}
      <Card backgroundColor="$blue2" borderColor="$blue7">
        <Text fontSize="$5" fontWeight="600" color="$blue11" marginBottom="$3">
          Linked Payment Voucher
        </Text>

        <XStack justifyContent="space-between" marginBottom="$2">
          <Text fontSize="$4" color="$blue11">
            Voucher Number:
          </Text>
          <Text fontSize="$4" fontWeight="600" color="$blue11">
            {document.linkedVoucherNumber || 'N/A'}
          </Text>
        </XStack>

        <XStack justifyContent="space-between" marginBottom="$2">
          <Text fontSize="$4" color="$blue11">
            Payee:
          </Text>
          <Text fontSize="$4" fontWeight="600" color="$blue11">
            {document.payeeName}
          </Text>
        </XStack>

        <XStack justifyContent="space-between">
          <Text fontSize="$4" color="$blue11">
            Amount:
          </Text>
          <Text fontSize="$4" fontWeight="600" color="$blue11">
            {document.currency} {document.total.toFixed(2)}
          </Text>
        </XStack>
      </Card>

      {/* Payment Details */}
      <Card>
        <Text fontSize="$5" fontWeight="600" color="$color" marginBottom="$3">
          Payment Details
        </Text>

        <Input
          label="Payment Date *"
          value={formData.paymentDate}
          onChangeText={(value) => setFormData({ ...formData, paymentDate: value })}
          placeholder="YYYY-MM-DD"
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
          label="Transaction Reference *"
          value={formData.transactionReference}
          onChangeText={(value) =>
            setFormData({ ...formData, transactionReference: value })
          }
          placeholder="e.g., TXN123456789"
          error={!!errors.transactionReference}
          errorText={errors.transactionReference}
        />
      </Card>

      {/* Transaction Fees */}
      <Card backgroundColor="$yellow2" borderColor="$yellow7">
        <Text fontSize="$5" fontWeight="600" color="$yellow11" marginBottom="$3">
          Transaction Fees (Optional)
        </Text>

        <Input
          label="Transaction Fee Amount"
          value={formData.transactionFee}
          onChangeText={(value) =>
            setFormData({ ...formData, transactionFee: value })
          }
          keyboardType="decimal-pad"
          placeholder="0.00"
        />

        {parseFloat(formData.transactionFee) > 0 && (
          <YStack gap="$2" marginTop="$2">
            <Text fontSize="$4" fontWeight="500" color="$color">
              Fee Type
            </Text>
            <YStack gap="$2">
              {TRANSACTION_FEE_TYPES.map((feeType) => (
                <Button
                  key={feeType}
                  variant={
                    formData.transactionFeeType === feeType ? 'primary' : 'outline'
                  }
                  onPress={async () => {
                    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    setFormData({ ...formData, transactionFeeType: feeType })
                  }}
                  size="sm"
                >
                  <Text
                    fontSize="$3"
                    color={
                      formData.transactionFeeType === feeType
                        ? '#FFFFFF'
                        : '$color'
                    }
                  >
                    {feeType}
                  </Text>
                </Button>
              ))}
            </YStack>
          </YStack>
        )}

        <YStack
          padding="$3"
          backgroundColor="$background"
          borderRadius="$3"
          marginTop="$3"
        >
          <Text fontSize="$4" fontWeight="600" color="$color" marginBottom="$2">
            Payment Breakdown
          </Text>

          <XStack justifyContent="space-between" marginBottom="$1">
            <Text fontSize="$3" color="$colorHover">
              Voucher Amount:
            </Text>
            <Text fontSize="$3" fontWeight="500" color="$color">
              {document.currency} {document.total.toFixed(2)}
            </Text>
          </XStack>

          <XStack justifyContent="space-between" marginBottom="$1">
            <Text fontSize="$3" color="$colorHover">
              Transaction Fee:
            </Text>
            <Text fontSize="$3" fontWeight="500" color="$color">
              {document.currency}{' '}
              {(parseFloat(formData.transactionFee) || 0).toFixed(2)}
            </Text>
          </XStack>

          <XStack
            justifyContent="space-between"
            paddingTop="$2"
            borderTopWidth={1}
            borderTopColor="$borderColor"
          >
            <Text fontSize="$4" fontWeight="700" color="$color">
              Total Deducted:
            </Text>
            <Text fontSize="$4" fontWeight="700" color="$color">
              {document.currency} {calculateTotalDeducted().toFixed(2)}
            </Text>
          </XStack>
        </YStack>
      </Card>

      {/* Line Items Display */}
      {document.items && document.items.length > 0 && (
        <Card>
          <Text fontSize="$5" fontWeight="600" color="$color" marginBottom="$3">
            Payment Items
          </Text>

          {document.items.map((item, index) => (
            <XStack
              key={item.id}
              justifyContent="space-between"
              paddingVertical="$2"
              borderBottomWidth={index < document.items.length - 1 ? 1 : 0}
              borderBottomColor="$borderColor"
            >
              <YStack flex={1}>
                <Text fontSize="$4" color="$color" marginBottom="$1">
                  {item.description}
                </Text>
                <Text fontSize="$3" color="$colorHover">
                  {item.quantity} × {document.currency} {item.unitPrice.toFixed(2)}
                </Text>
              </YStack>
              <Text fontSize="$4" fontWeight="600" color="$color">
                {document.currency} {item.amount.toFixed(2)}
              </Text>
            </XStack>
          ))}
        </Card>
      )}

      {/* Confirmation */}
      <Card>
        <Text fontSize="$5" fontWeight="600" color="$color" marginBottom="$3">
          Confirmation
        </Text>

        <Input
          label="Confirmed By *"
          value={formData.confirmedBy}
          onChangeText={(value) => setFormData({ ...formData, confirmedBy: value })}
          placeholder="Name of person confirming payment"
          error={!!errors.confirmedBy}
          errorText={errors.confirmedBy}
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
