/**
 * Receipt Create Form - WIF Japan Design System
 *
 * Single-page form matching InvoiceCreateForm design patterns:
 * - Theme prop for dynamic styling
 * - Tamagui components for layout
 * - Card and Input from UI library
 * - SectionHeader with accent bar (same as Invoice)
 */

import { useState, memo, useCallback } from 'react'
import { Pressable, StyleSheet, View, ScrollView as RNScrollView } from 'react-native'
import { YStack, XStack, Text, ScrollView } from 'tamagui'
import * as Haptics from 'expo-haptics'

import { Input, Card } from '../ui'
import type {
  Receipt,
  Invoice,
  Currency,
  Country,
  Account,
  Document,
  UserReference,
} from '../../types'

// ============================================
// TYPES
// ============================================

interface ReceiptCreateFormProps {
  accounts: Account[]
  invoices: Invoice[]
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

const PAYMENT_METHODS = [
  'Bank Transfer',
  'Cash',
  'Cheque',
  'Credit Card',
  'Online Payment',
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

export function ReceiptCreateForm({
  accounts,
  invoices,
  onSubmit,
  onCancel,
  isSaving,
  user,
  theme,
}: ReceiptCreateFormProps) {
  const [validationError, setValidationError] = useState<string | null>(null)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)

  const [formData, setFormData] = useState({
    payerName: '',
    payerContact: '',
    receiptDate: getTodayISO(),
    paymentMethod: '',
    linkedInvoiceId: '',
    receivedBy: '',
    amount: '',
    currency: 'MYR' as Currency,
    country: 'Malaysia' as Country,
    accountId: '',
    notes: '',
  })

  // Filter accounts by selected currency
  const filteredAccounts = accounts.filter(
    (acc) => acc.isActive && acc.currency === formData.currency
  )

  // Filter to unpaid invoices
  const unpaidInvoices = invoices.filter((inv) => inv.status !== 'paid')

  // Check if fields are auto-filled from invoice
  const isAutoFilled = !!selectedInvoice

  const handleInvoiceSelect = useCallback((invoice: Invoice | null) => {
    if (invoice) {
      setSelectedInvoice(invoice)
      setFormData((prev) => ({
        ...prev,
        linkedInvoiceId: invoice.id,
        payerName: invoice.customerName,
        amount: invoice.total.toString(),
        currency: invoice.currency,
        country: invoice.country,
        accountId: invoice.accountId || '',
      }))
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } else {
      setSelectedInvoice(null)
      setFormData((prev) => ({
        ...prev,
        linkedInvoiceId: '',
      }))
    }
  }, [])

  const handleCurrencyChange = useCallback(async (currency: Currency) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const country: Country = currency === 'JPY' ? 'Japan' : 'Malaysia'
    setFormData((prev) => ({ ...prev, currency, country, accountId: '' }))
  }, [])

  const handleSubmit = useCallback(async () => {
    setValidationError(null)

    // Validation
    if (!formData.payerName.trim()) {
      setValidationError('Payer name is required')
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      return
    }
    if (!formData.paymentMethod.trim()) {
      setValidationError('Payment method is required')
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      return
    }
    if (!formData.receivedBy.trim()) {
      setValidationError('Received by field is required')
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      return
    }
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      setValidationError('Valid amount is required')
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      return
    }

    const selectedAccount = accounts.find((acc) => acc.id === formData.accountId)

    const userReference: UserReference | undefined = user
      ? {
          id: user.id,
          name: user.name,
          username: user.username,
        }
      : undefined

    const receipt: Omit<Receipt, 'id' | 'createdAt' | 'updatedAt' | 'documentNumber'> = {
      documentType: 'receipt',
      date: formData.receiptDate,
      status: 'completed',
      currency: formData.currency,
      country: formData.country,
      amount: parseFloat(formData.amount),
      accountId: formData.accountId || undefined,
      accountName: selectedAccount?.name || undefined,
      payerName: formData.payerName,
      payerContact: formData.payerContact || undefined,
      receiptDate: formData.receiptDate,
      paymentMethod: formData.paymentMethod,
      linkedInvoiceId: formData.linkedInvoiceId || undefined,
      linkedInvoiceNumber: selectedInvoice?.documentNumber || undefined,
      receivedBy: formData.receivedBy,
      notes: formData.notes || undefined,
      createdBy: userReference,
      updatedBy: userReference,
    }

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    await onSubmit(receipt)
  }, [formData, accounts, user, selectedInvoice, onSubmit])

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

          {/* Receipt Details */}
          <Card backgroundColor={theme.bgCard} padding="$5" borderRadius={16} style={styles.formCard}>
            <SectionHeader title="Receipt Details" theme={theme} />

            <FormField label="Receipt Date" required theme={theme}>
              <Input
                value={formData.receiptDate}
                onChangeText={(value) => setFormData({ ...formData, receiptDate: value })}
                placeholder="YYYY-MM-DD"
              />
            </FormField>
          </Card>

          {/* Link to Invoice */}
          {unpaidInvoices.length > 0 && (
            <Card backgroundColor={theme.bgCard} padding="$5" borderRadius={16} style={styles.formCard}>
              <SectionHeader title="Link to Invoice" badge="Optional" theme={theme} />

              <Text fontSize={12} color={theme.textMuted} marginBottom="$3">
                Selecting an invoice will auto-fill payer details and amount
              </Text>

              <RNScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.horizontalScroll}
                contentContainerStyle={styles.horizontalScrollContent}
              >
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    handleInvoiceSelect(null)
                  }}
                  style={[
                    styles.toggleBtn,
                    !formData.linkedInvoiceId
                      ? { backgroundColor: theme.textPrimary, borderColor: theme.textPrimary }
                      : { backgroundColor: theme.bgPrimary, borderColor: theme.borderSubtle },
                  ]}
                >
                  <Text
                    fontSize={14}
                    fontWeight="600"
                    color={!formData.linkedInvoiceId ? '#FFFFFF' : theme.textPrimary}
                  >
                    No Link
                  </Text>
                </Pressable>
                {unpaidInvoices.map((invoice) => (
                  <Pressable
                    key={invoice.id}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                      handleInvoiceSelect(invoice)
                    }}
                    style={[
                      styles.invoiceLinkCard,
                      {
                        backgroundColor: formData.linkedInvoiceId === invoice.id ? theme.textPrimary : theme.bgPrimary,
                        borderColor: formData.linkedInvoiceId === invoice.id ? theme.textPrimary : theme.borderSubtle,
                      },
                    ]}
                  >
                    <Text
                      fontSize={13}
                      fontWeight="600"
                      color={formData.linkedInvoiceId === invoice.id ? '#FFFFFF' : theme.textPrimary}
                    >
                      {invoice.documentNumber}
                    </Text>
                    <Text
                      fontSize={11}
                      color={formData.linkedInvoiceId === invoice.id ? 'rgba(255,255,255,0.7)' : theme.textMuted}
                      numberOfLines={1}
                    >
                      {invoice.customerName}
                    </Text>
                    <Text
                      fontSize={12}
                      fontWeight="500"
                      color={formData.linkedInvoiceId === invoice.id ? '#FFFFFF' : theme.textSecondary}
                    >
                      {invoice.currency} {invoice.total.toFixed(2)}
                    </Text>
                  </Pressable>
                ))}
              </RNScrollView>
            </Card>
          )}

          {/* Payer Details */}
          <Card backgroundColor={theme.bgCard} padding="$5" borderRadius={16} style={styles.formCard}>
            <SectionHeader title="Payer Details" theme={theme} />

            <FormField label="Payer Name" required theme={theme}>
              <Input
                value={formData.payerName}
                onChangeText={(value) => setFormData({ ...formData, payerName: value })}
                placeholder="Company or individual name"
                style={isAutoFilled && formData.payerName ? { borderColor: theme.gold, backgroundColor: theme.goldSoft } : undefined}
              />
            </FormField>

            <FormField label="Payer Contact" theme={theme}>
              <Input
                value={formData.payerContact}
                onChangeText={(value) => setFormData({ ...formData, payerContact: value })}
                placeholder="Phone or email"
                keyboardType="phone-pad"
              />
            </FormField>
          </Card>

          {/* Payment Method */}
          <Card backgroundColor={theme.bgCard} padding="$5" borderRadius={16} style={styles.formCard}>
            <SectionHeader title="Payment Method" theme={theme} />

            <XStack gap="$2" flexWrap="wrap">
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
          </Card>

          {/* Amount & Currency */}
          <Card backgroundColor={theme.bgCard} padding="$5" borderRadius={16} style={styles.formCard}>
            <SectionHeader title="Amount" theme={theme} />

            <FormField label="Amount" required theme={theme}>
              <Input
                value={formData.amount}
                onChangeText={(value) => setFormData({ ...formData, amount: value })}
                placeholder="0.00"
                keyboardType="decimal-pad"
                style={isAutoFilled && formData.amount ? { borderColor: theme.gold, backgroundColor: theme.goldSoft } : undefined}
              />
            </FormField>

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

          {/* Deposit Account */}
          <Card backgroundColor={theme.bgCard} padding="$5" borderRadius={16} style={styles.formCard}>
            <SectionHeader title="Deposit Account" theme={theme} />

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

          {/* Received By */}
          <Card backgroundColor={theme.bgCard} padding="$5" borderRadius={16} style={styles.formCard}>
            <SectionHeader title="Received By" theme={theme} />

            <FormField label="Name" required theme={theme}>
              <Input
                value={formData.receivedBy}
                onChangeText={(value) => setFormData({ ...formData, receivedBy: value })}
                placeholder="Person who received payment"
              />
            </FormField>
          </Card>

          {/* Notes */}
          <Card backgroundColor={theme.bgCard} padding="$5" borderRadius={16} style={styles.formCard}>
            <SectionHeader title="Notes" badge="Optional" theme={theme} />

            <Input
              value={formData.notes}
              onChangeText={(value) => setFormData({ ...formData, notes: value })}
              placeholder="Additional notes for the receipt..."
              multiline
              numberOfLines={3}
            />
          </Card>
        </YStack>
      </ScrollView>

      {/* Footer Actions - Same as InvoiceCreateForm */}
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
            {isSaving ? 'Creating...' : 'Create Receipt'}
          </Text>
        </Pressable>
      </XStack>
    </YStack>
  )
}

// ============================================
// STYLES - Same as InvoiceCreateForm
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
  invoiceLinkCard: {
    minWidth: 140,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: 10,
    gap: 4,
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
