import { useState, useEffect, useCallback } from 'react'
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'
import { ActivityIndicator, Alert, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native'
import {
  YStack,
  XStack,
  Text,
} from 'tamagui'
import {
  ChevronLeft,
  FileText,
} from '@tamagui/lucide-icons'
import * as Haptics from 'expo-haptics'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  useFonts,
  CormorantGaramond_400Regular,
  CormorantGaramond_500Medium,
} from '@expo-google-fonts/cormorant-garamond'

import {
  Card,
  Button,
} from '../../../src/components/ui'
import { getDocument, updateDocument } from '../../../src/services'
import type { Document, DocumentType, Invoice, Receipt, PaymentVoucher, StatementOfPayment } from '../../../src/types'
import { getAppTheme } from '../../../src/constants/theme'
import { useThemeStore } from '../../../src/store/themeStore'
import { useAuthStore } from '../../../src/store/authStore'
import { getEditRestrictionMessage } from '../../../src/utils/permissions'
import {
  InvoiceEditForm,
  ReceiptEditForm,
  PaymentVoucherEditForm,
  StatementOfPaymentEditForm,
} from '../../../src/components/documents'

const documentTypeLabels: Record<DocumentType, string> = {
  invoice: 'Invoice',
  receipt: 'Receipt',
  payment_voucher: 'Payment Voucher',
  statement_of_payment: 'Statement of Payment',
}

export default function DocumentEditScreen() {
  const { id, type } = useLocalSearchParams<{ id: string; type?: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const user = useAuthStore((state) => state.user)
  const isDark = useThemeStore((state) => state.isDarkMode)
  const theme = getAppTheme(isDark)

  const [fontsLoaded] = useFonts({
    CormorantGaramond_400Regular,
    CormorantGaramond_500Medium,
  })

  const [document, setDocument] = useState<Document | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchDocument = useCallback(async () => {
    if (!id) return

    setIsLoading(true)
    setError(null)

    try {
      // Try to fetch as the specified type first, or try all types
      let doc: Document | null = null
      const typesToTry = type
        ? [type as DocumentType]
        : ['invoice', 'receipt', 'payment_voucher', 'statement_of_payment'] as DocumentType[]

      for (const docType of typesToTry) {
        doc = await getDocument(id, docType)
        if (doc) break
      }

      if (doc) {
        // Check edit permission
        const restrictionMessage = getEditRestrictionMessage(user, doc)
        if (restrictionMessage) {
          setError(restrictionMessage)
        } else {
          setDocument(doc)
        }
      } else {
        setError('Document not found')
      }
    } catch (err) {
      console.error('Error fetching document:', err)
      setError('Failed to load document')
    } finally {
      setIsLoading(false)
    }
  }, [id, type, user])

  useEffect(() => {
    fetchDocument()
  }, [fetchDocument])

  const handleBack = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    router.back()
  }

  const handleSave = async (updates: Partial<Document>) => {
    if (!document) return

    setIsSaving(true)

    try {
      const updatedDoc = await updateDocument(document.id, updates)

      if (updatedDoc) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        Alert.alert(
          'Success',
          'Document updated successfully.',
          [{ text: 'OK', onPress: () => router.back() }]
        )
      } else {
        throw new Error('Failed to update document')
      }
    } catch (err) {
      console.error('Error saving document:', err)
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Error', 'Failed to save document. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  // Loading state
  if (isLoading || !fontsLoaded) {
    return (
      <YStack flex={1} backgroundColor={theme.bgPrimary} justifyContent="center" alignItems="center">
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={theme.gold} />
        <Text marginTop="$3" color={theme.textMuted}>Loading document...</Text>
      </YStack>
    )
  }

  // Error state
  if (error || !document) {
    return (
      <YStack flex={1} backgroundColor={theme.bgPrimary}>
        <Stack.Screen options={{ headerShown: false }} />
        <XStack
          paddingTop={insets.top + 10}
          paddingHorizontal={20}
          paddingBottom={16}
          alignItems="center"
          gap={14}
        >
          <Pressable onPress={handleBack} style={[styles.backButton, { borderColor: theme.borderSubtle }]}>
            <ChevronLeft size={20} color={theme.textPrimary} />
          </Pressable>
          <Text
            fontFamily="CormorantGaramond_500Medium"
            fontSize={24}
            fontWeight="500"
            color={theme.textPrimary}
          >
            Edit Document
          </Text>
        </XStack>
        <YStack flex={1} justifyContent="center" alignItems="center" padding="$4">
          <FileText size={48} color={theme.textMuted} opacity={0.3} />
          <Text fontSize={15} fontWeight="600" color={theme.textPrimary} marginTop="$3">
            {error || 'Document not found'}
          </Text>
          <Pressable onPress={handleBack} style={[styles.goBackBtn, { backgroundColor: theme.textPrimary }]}>
            <Text color="#FFFFFF" fontWeight="600">Go Back</Text>
          </Pressable>
        </YStack>
      </YStack>
    )
  }

  const handleCancel = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    router.back()
  }

  return (
    <YStack flex={1} backgroundColor={theme.bgPrimary}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header - matches New Invoice design exactly */}
      <XStack
        paddingTop={insets.top + 10}
        paddingHorizontal={20}
        paddingBottom={16}
        alignItems="center"
        gap={14}
      >
        <Pressable onPress={handleBack} style={[styles.backButton, { borderColor: theme.borderSubtle }]}>
          <ChevronLeft size={20} color={theme.textPrimary} />
        </Pressable>
        <Text
          fontFamily="CormorantGaramond_500Medium"
          fontSize={24}
          fontWeight="500"
          color={theme.textPrimary}
        >
          Edit {documentTypeLabels[document.documentType]}
        </Text>
      </XStack>

      {/* Form Content */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Render appropriate form based on document type */}
        {document.documentType === 'invoice' && (
          <InvoiceEditForm
            document={document as Invoice}
            onSave={handleSave}
            onCancel={handleCancel}
            isSaving={isSaving}
            theme={theme}
          />
        )}

        {document.documentType === 'receipt' && (
          <ReceiptEditForm
            document={document as Receipt}
            onSave={handleSave}
            onCancel={handleCancel}
            isSaving={isSaving}
            theme={theme}
          />
        )}

        {document.documentType === 'payment_voucher' && (
          <PaymentVoucherEditForm
            document={document as PaymentVoucher}
            onSave={handleSave}
            onCancel={handleCancel}
            isSaving={isSaving}
            theme={theme}
          />
        )}

        {document.documentType === 'statement_of_payment' && (
          <StatementOfPaymentEditForm
            document={document as StatementOfPayment}
            onSave={handleSave}
            onCancel={handleCancel}
            isSaving={isSaving}
            theme={theme}
          />
        )}
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  goBackBtn: {
    marginTop: 16,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
})
