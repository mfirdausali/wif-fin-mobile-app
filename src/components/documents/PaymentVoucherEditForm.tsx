import { useState } from 'react'
import { YStack, XStack, Text } from 'tamagui'
import { Plus, Trash2 } from '@tamagui/lucide-icons'
import * as Haptics from 'expo-haptics'

import { Input, Button, Card } from '../ui'
import type { PaymentVoucher, LineItem } from '../../types'

interface PaymentVoucherEditFormProps {
  document: PaymentVoucher
  onSave: (updates: Partial<PaymentVoucher>) => Promise<void>
  isSaving: boolean
}

export function PaymentVoucherEditForm({
  document,
  onSave,
  isSaving,
}: PaymentVoucherEditFormProps) {
  const [formData, setFormData] = useState({
    payeeName: document.payeeName,
    payeeAddress: document.payeeAddress || '',
    payeeBankAccount: document.payeeBankAccount || '',
    payeeBankName: document.payeeBankName || '',
    voucherDate: document.voucherDate,
    paymentDueDate: document.paymentDueDate || '',
    requestedBy: document.requestedBy,
    taxRate: document.taxRate?.toString() || '',
    notes: document.notes || '',
  })

  const [items, setItems] = useState<LineItem[]>(document.items || [])
  const [errors, setErrors] = useState<Record<string, string>>({})

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

  const validate = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.payeeName.trim()) {
      newErrors.payeeName = 'Payee name is required'
    }
    if (!formData.requestedBy.trim()) {
      newErrors.requestedBy = 'Requested by field is required'
    }
    if (items.some((item) => !item.description.trim())) {
      newErrors.items = 'All line items must have a description'
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
    const { subtotal, taxAmount, total } = calculateTotals()

    const updates: Partial<PaymentVoucher> = {
      payeeName: formData.payeeName,
      payeeAddress: formData.payeeAddress || undefined,
      payeeBankAccount: formData.payeeBankAccount || undefined,
      payeeBankName: formData.payeeBankName || undefined,
      voucherDate: formData.voucherDate,
      paymentDueDate: formData.paymentDueDate || undefined,
      requestedBy: formData.requestedBy,
      items,
      subtotal,
      taxRate: parseFloat(formData.taxRate) || undefined,
      taxAmount: taxAmount > 0 ? taxAmount : undefined,
      total,
      amount: total,
      notes: formData.notes || undefined,
    }

    await onSave(updates)
  }

  const { subtotal, taxAmount, total } = calculateTotals()

  return (
    <YStack flex={1} gap="$4">
      {/* Voucher Details */}
      <Card>
        <Text fontSize="$5" fontWeight="600" color="$color" marginBottom="$3">
          Voucher Details
        </Text>

        <Input
          label="Voucher Date *"
          value={formData.voucherDate}
          onChangeText={(value) => setFormData({ ...formData, voucherDate: value })}
          placeholder="YYYY-MM-DD"
        />

        <Input
          label="Payment Due Date"
          value={formData.paymentDueDate}
          onChangeText={(value) =>
            setFormData({ ...formData, paymentDueDate: value })
          }
          placeholder="YYYY-MM-DD"
        />
      </Card>

      {/* Payee Details */}
      <Card>
        <Text fontSize="$5" fontWeight="600" color="$color" marginBottom="$3">
          Payee Details
        </Text>

        <Input
          label="Payee Name *"
          value={formData.payeeName}
          onChangeText={(value) => setFormData({ ...formData, payeeName: value })}
          error={!!errors.payeeName}
          errorText={errors.payeeName}
        />

        <Input
          label="Payee Address"
          value={formData.payeeAddress}
          onChangeText={(value) => setFormData({ ...formData, payeeAddress: value })}
          multiline
          numberOfLines={2}
        />

        <Input
          label="Bank Name"
          value={formData.payeeBankName}
          onChangeText={(value) =>
            setFormData({ ...formData, payeeBankName: value })
          }
          placeholder="Bank name"
        />

        <Input
          label="Bank Account Number"
          value={formData.payeeBankAccount}
          onChangeText={(value) =>
            setFormData({ ...formData, payeeBankAccount: value })
          }
          placeholder="Account number"
        />
      </Card>

      {/* Payment Items */}
      <Card>
        <XStack justifyContent="space-between" alignItems="center" marginBottom="$3">
          <Text fontSize="$5" fontWeight="600" color="$color">
            Payment Items
          </Text>
          <Button variant="outline" size="sm" onPress={addItem}>
            <XStack alignItems="center" gap="$2">
              <Plus size={16} />
              <Text>Add</Text>
            </XStack>
          </Button>
        </XStack>

        {errors.items && (
          <Text fontSize="$3" color="$red10" marginBottom="$2">
            {errors.items}
          </Text>
        )}

        {items.map((item, index) => (
          <Card key={item.id} backgroundColor="$backgroundHover" marginBottom="$2">
            <Input
              label="Description"
              value={item.description}
              onChangeText={(value) => updateItem(item.id, 'description', value)}
              placeholder="Item description"
            />

            <XStack gap="$2">
              <YStack flex={1}>
                <Input
                  label="Qty"
                  value={item.quantity.toString()}
                  onChangeText={(value) =>
                    updateItem(item.id, 'quantity', parseFloat(value) || 0)
                  }
                  keyboardType="numeric"
                />
              </YStack>

              <YStack flex={1}>
                <Input
                  label="Unit Price"
                  value={item.unitPrice.toString()}
                  onChangeText={(value) =>
                    updateItem(item.id, 'unitPrice', parseFloat(value) || 0)
                  }
                  keyboardType="decimal-pad"
                />
              </YStack>
            </XStack>

            <XStack justifyContent="space-between" alignItems="center">
              <Text fontSize="$4" color="$colorHover">
                Amount: {document.currency} {item.amount.toFixed(2)}
              </Text>
              {items.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onPress={() => removeItem(item.id)}
                >
                  <Trash2 size={18} color="$red10" />
                </Button>
              )}
            </XStack>
          </Card>
        ))}
      </Card>

      {/* Totals */}
      <Card backgroundColor="$backgroundFocus">
        <Text fontSize="$5" fontWeight="600" color="$color" marginBottom="$3">
          Totals
        </Text>

        <XStack justifyContent="space-between" marginBottom="$2">
          <Text fontSize="$4" color="$colorHover">
            Subtotal:
          </Text>
          <Text fontSize="$4" fontWeight="600" color="$color">
            {document.currency} {subtotal.toFixed(2)}
          </Text>
        </XStack>

        <Input
          label="Tax Rate (%)"
          value={formData.taxRate}
          onChangeText={(value) => setFormData({ ...formData, taxRate: value })}
          keyboardType="decimal-pad"
          placeholder="0"
        />

        {taxAmount > 0 && (
          <XStack justifyContent="space-between" marginBottom="$2">
            <Text fontSize="$4" color="$colorHover">
              Tax Amount:
            </Text>
            <Text fontSize="$4" fontWeight="600" color="$color">
              {document.currency} {taxAmount.toFixed(2)}
            </Text>
          </XStack>
        )}

        <XStack
          justifyContent="space-between"
          paddingTop="$2"
          borderTopWidth={1}
          borderTopColor="$borderColor"
        >
          <Text fontSize="$5" fontWeight="700" color="$color">
            Total:
          </Text>
          <Text fontSize="$5" fontWeight="700" color="$color">
            {document.currency} {total.toFixed(2)}
          </Text>
        </XStack>
      </Card>

      {/* Request Details */}
      <Card>
        <Text fontSize="$5" fontWeight="600" color="$color" marginBottom="$3">
          Request Details
        </Text>

        <Input
          label="Requested By *"
          value={formData.requestedBy}
          onChangeText={(value) => setFormData({ ...formData, requestedBy: value })}
          placeholder="Name of person requesting"
          error={!!errors.requestedBy}
          errorText={errors.requestedBy}
        />

        {document.approvedBy && (
          <YStack
            padding="$3"
            backgroundColor="$green2"
            borderRadius="$3"
            borderWidth={1}
            borderColor="$green7"
          >
            <Text fontSize="$3" color="$green11" marginBottom="$1">
              Approved By
            </Text>
            <Text fontSize="$4" fontWeight="600" color="$green11">
              {typeof document.approvedBy === 'string'
                ? document.approvedBy
                : document.approvedBy?.name}
            </Text>
            {document.approvalDate && (
              <Text fontSize="$3" color="$green10" marginTop="$1">
                on {new Date(document.approvalDate).toLocaleDateString()}
              </Text>
            )}
          </YStack>
        )}
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
