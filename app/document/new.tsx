/**
 * Document Creation Screen
 *
 * Allows creating new documents (Invoice, Receipt, Payment Voucher, Statement of Payment)
 * Matches web app's document creation functionality exactly.
 */

import { useState, useCallback, useEffect } from 'react'
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, View, Pressable } from 'react-native'
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'
import { YStack, XStack, Text, ScrollView } from 'tamagui'
import { ChevronLeft } from '@tamagui/lucide-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import {
  useFonts,
  CormorantGaramond_400Regular,
  CormorantGaramond_500Medium,
} from '@expo-google-fonts/cormorant-garamond'

import { InvoiceSkeletonLoader, DocumentSkeletonLoader } from '../../src/components/ui'
import {
  InvoiceCreateForm,
  ReceiptCreateForm,
  PaymentVoucherCreateForm,
  StatementOfPaymentCreateForm,
} from '../../src/components/documents'
import { useThemeStore } from '../../src/store/themeStore'
import { useAuthStore } from '../../src/store/authStore'
import { getAppTheme } from '../../src/constants/theme'
import { createDocument, getAccounts, getDocuments } from '../../src/services'
import type {
  DocumentType,
  Invoice,
  Receipt,
  PaymentVoucher,
  StatementOfPayment,
  Account,
  Document,
} from '../../src/types'
import { DOCUMENT_TYPE_LABELS } from '../../src/types/document'

// Document titles matching the design
const DOCUMENT_TITLES: Record<DocumentType, string> = {
  invoice: 'New Invoice',
  receipt: 'New Receipt',
  payment_voucher: 'New Payment Voucher',
  statement_of_payment: 'New Statement',
}

export default function NewDocumentScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ type: string }>()
  const insets = useSafeAreaInsets()
  const user = useAuthStore((state) => state.user)
  const isDark = useThemeStore((state) => state.isDarkMode)
  const theme = getAppTheme(isDark)

  const [fontsLoaded] = useFonts({
    CormorantGaramond_400Regular,
    CormorantGaramond_500Medium,
  })

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [vouchers, setVouchers] = useState<PaymentVoucher[]>([])

  // Determine document type from URL params
  const documentType = (params.type as DocumentType) || 'invoice'
  const documentTitle = DOCUMENT_TITLES[documentType] || 'New Document'

  // Fetch required data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true)

        // Fetch accounts for all document types
        const accountsData = await getAccounts(undefined, { activeOnly: true })
        setAccounts(accountsData)

        // Fetch invoices for Receipt form (linking)
        if (documentType === 'receipt') {
          const invoicesData = await getDocuments(undefined, { type: 'invoice' })
          setInvoices(invoicesData.filter((d): d is Invoice => d.documentType === 'invoice'))
        }

        // Fetch payment vouchers for Statement form (linking)
        if (documentType === 'statement_of_payment') {
          const vouchersData = await getDocuments(undefined, { type: 'payment_voucher' })
          setVouchers(
            vouchersData.filter(
              (d): d is PaymentVoucher =>
                d.documentType === 'payment_voucher' && d.status === 'issued'
            )
          )
        }
      } catch (error) {
        console.error('Error fetching data:', error)
        Alert.alert('Error', 'Failed to load required data')
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [documentType])

  const handleGoBack = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    router.back()
  }

  const handleCreateDocument = useCallback(
    async (document: Omit<Document, 'id' | 'createdAt' | 'updatedAt' | 'documentNumber'>) => {
      try {
        setIsSaving(true)
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

        // Create the document
        const createdDoc = await createDocument(document as any)

        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

        // Navigate to the created document
        router.replace(`/document/${createdDoc.id}`)
      } catch (error) {
        console.error('Error creating document:', error)
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        Alert.alert('Error', 'Failed to create document. Please try again.')
      } finally {
        setIsSaving(false)
      }
    },
    [router]
  )

  const handleCancel = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    router.back()
  }

  // Render form based on document type
  const renderForm = () => {
    switch (documentType) {
      case 'invoice':
        return (
          <InvoiceCreateForm
            accounts={accounts}
            onSubmit={handleCreateDocument}
            onCancel={handleCancel}
            isSaving={isSaving}
            user={user}
            theme={theme}
          />
        )
      case 'receipt':
        return (
          <ReceiptCreateForm
            accounts={accounts}
            invoices={invoices}
            onSubmit={handleCreateDocument}
            onCancel={handleCancel}
            isSaving={isSaving}
            user={user}
            theme={theme}
          />
        )
      case 'payment_voucher':
        return (
          <PaymentVoucherCreateForm
            accounts={accounts}
            onSubmit={handleCreateDocument}
            onCancel={handleCancel}
            isSaving={isSaving}
            user={user}
            theme={theme}
          />
        )
      case 'statement_of_payment':
        return (
          <StatementOfPaymentCreateForm
            accounts={accounts}
            vouchers={vouchers}
            onSubmit={handleCreateDocument}
            onCancel={handleCancel}
            isSaving={isSaving}
            user={user}
            theme={theme}
          />
        )
      default:
        return (
          <YStack padding="$4" alignItems="center">
            <Text color={theme.textMuted}>Unknown document type</Text>
          </YStack>
        )
    }
  }

  // Show skeleton loader while loading
  if (isLoading || !fontsLoaded) {
    return (
      <YStack flex={1} backgroundColor={theme.bgPrimary}>
        <Stack.Screen options={{ headerShown: false }} />

        {/* Header - matches HTML design exactly */}
        <XStack
          paddingTop={insets.top + 10}
          paddingHorizontal={20}
          paddingBottom={16}
          alignItems="center"
          gap={14}
        >
          <Pressable onPress={handleGoBack} style={[styles.backButton, { borderColor: theme.borderSubtle }]}>
            <ChevronLeft size={20} color={theme.textPrimary} />
          </Pressable>
          <Text
            fontFamily="CormorantGaramond_500Medium"
            fontSize={24}
            fontWeight="500"
            color={theme.textPrimary}
          >
            {documentTitle}
          </Text>
        </XStack>

        {/* Skeleton Content */}
        <ScrollView flex={1} showsVerticalScrollIndicator={false}>
          {documentType === 'invoice' ? (
            <InvoiceSkeletonLoader theme={theme} />
          ) : (
            <DocumentSkeletonLoader theme={theme} />
          )}
        </ScrollView>
      </YStack>
    )
  }

  return (
    <YStack flex={1} backgroundColor={theme.bgPrimary}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header - matches HTML design exactly */}
      <XStack
        paddingTop={insets.top + 10}
        paddingHorizontal={20}
        paddingBottom={16}
        alignItems="center"
        gap={14}
      >
        <Pressable onPress={handleGoBack} style={[styles.backButton, { borderColor: theme.borderSubtle }]}>
          <ChevronLeft size={20} color={theme.textPrimary} />
        </Pressable>
        <Text
          fontFamily="CormorantGaramond_500Medium"
          fontSize={24}
          fontWeight="500"
          color={theme.textPrimary}
        >
          {documentTitle}
        </Text>
      </XStack>

      {/* Form Content - All forms now have their own internal layout */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {renderForm()}
      </KeyboardAvoidingView>
    </YStack>
  )
}

const styles = StyleSheet.create({
  backButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    // Shadow matching the HTML design
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
})
