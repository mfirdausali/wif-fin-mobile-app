/**
 * Document Router
 *
 * Smart router that detects document type and redirects to the appropriate detail page.
 * This replaces the monolithic document detail screen with a lightweight routing layer.
 *
 * IMPORTANT: Shows skeleton loader during routing to prevent blank screen flash.
 */

import { useEffect, useState } from 'react'
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'
import { StyleSheet, View, Pressable, Text as RNText } from 'react-native'
import { YStack, Text } from 'tamagui'
import { ChevronLeft } from '@tamagui/lucide-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { supabase } from '../../src/services/api/supabaseClient'
import { InvoiceDetailSkeletonLoader } from '../../src/components/ui/SkeletonLoader'

// WIF Japan Design System Colors
const COLORS = {
  sumiInk: '#1A1815',
  sumiInkLight: '#2D2A26',
  bgPrimary: '#FAF8F5',
  textPrimary: '#1A1815',
  textInverse: '#FFFFFF',
}

type DocumentType = 'invoice' | 'receipt' | 'payment_voucher' | 'statement_of_payment'

export default function DocumentRouter() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchDocumentType = async () => {
      if (!id || id === 'new') {
        setError('Invalid document ID')
        setIsLoading(false)
        return
      }

      try {
        // Minimal query - only fetch the document type
        const { data, error: fetchError } = await supabase
          .from('documents')
          .select('document_type')
          .eq('id', id)
          .single()

        if (fetchError) {
          console.error('Error fetching document type:', fetchError)
          setError('Document not found')
          setIsLoading(false)
          return
        }

        if (!data) {
          setError('Document not found')
          setIsLoading(false)
          return
        }

        // Redirect to the appropriate type-specific page
        const documentType = data.document_type as DocumentType

        switch (documentType) {
          case 'invoice':
            router.replace(`/document/invoice/${id}`)
            break
          case 'receipt':
            router.replace(`/document/receipt/${id}`)
            break
          case 'payment_voucher':
            router.replace(`/document/voucher/${id}`)
            break
          case 'statement_of_payment':
            router.replace(`/document/statement/${id}`)
            break
          default:
            setError(`Unknown document type: ${documentType}`)
            setIsLoading(false)
        }
      } catch (err) {
        console.error('Error in document router:', err)
        setError('Failed to load document')
        setIsLoading(false)
      }
    }

    fetchDocumentType()
  }, [id, router])

  const handleBack = () => {
    router.back()
  }

  // Loading state - show skeleton for seamless transition
  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bgPrimary }}>
        <Stack.Screen options={{ headerShown: false }} />
        <InvoiceDetailSkeletonLoader paddingTop={insets.top} />
      </View>
    )
  }

  // Error state
  if (error) {
    return (
      <YStack flex={1} backgroundColor={COLORS.bgPrimary}>
        <Stack.Screen options={{ headerShown: false }} />
        <LinearGradient
          colors={[COLORS.sumiInk, COLORS.sumiInkLight]}
          style={[styles.header, { paddingTop: insets.top }]}
        >
          <Pressable onPress={handleBack} style={styles.backButton}>
            <ChevronLeft size={20} color="rgba(255,255,255,0.8)" />
            <RNText style={styles.backText}>Back</RNText>
          </Pressable>
          <RNText style={styles.headerTitle}>Document</RNText>
          <View style={{ width: 36 }} />
        </LinearGradient>

        <YStack flex={1} justifyContent="center" alignItems="center" padding="$6">
          <Text fontSize={18} fontWeight="600" color={COLORS.textPrimary}>
            {error}
          </Text>
          <Pressable onPress={handleBack} style={styles.goBackButton}>
            <RNText style={styles.goBackText}>Go Back</RNText>
          </Pressable>
        </YStack>
      </YStack>
    )
  }

  // Should never reach here as we redirect on success
  return null
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  backText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.8)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: COLORS.textInverse,
    textAlign: 'center',
  },
  goBackButton: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: COLORS.sumiInk,
    borderRadius: 10,
  },
  goBackText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textInverse,
  },
})
