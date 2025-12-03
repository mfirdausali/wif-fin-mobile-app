import { useState, useCallback, useMemo, useEffect } from 'react'
import { RefreshControl, ActivityIndicator, StyleSheet, View, Pressable, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import {
  YStack,
  XStack,
  Text,
  Input,
  ScrollView,
} from 'tamagui'
import { FlashList } from '@shopify/flash-list'
import {
  Search,
  Plus,
  X,
  FileText,
  Receipt,
  CreditCard,
  FileCheck,
  Filter,
  ClipboardList,
} from '@tamagui/lucide-icons'
import { Text as RNText } from 'react-native'
import * as Haptics from 'expo-haptics'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  useFonts,
  CormorantGaramond_400Regular,
  CormorantGaramond_500Medium,
} from '@expo-google-fonts/cormorant-garamond'

import {
  DocumentCard,
  IconButton,
  DocumentContextMenu,
} from '../../src/components/ui'
import { getDocuments, sharePDF, deleteDocument } from '../../src/services'
import type { Document, DocumentType, DocumentStatus } from '../../src/types'
import { getAppTheme } from '../../src/constants/theme'
import { useThemeStore } from '../../src/store/themeStore'
import { useAuthStore } from '../../src/store/authStore'
import { canEditDocument, canDeleteDocument, canPrintDocuments } from '../../src/utils/permissions'

type FilterType = 'all' | 'invoice' | 'receipt' | 'payment_voucher' | 'statement_of_payment'

// Map document type to display type
const getDocumentDisplayType = (docType: DocumentType): 'invoice' | 'receipt' | 'voucher' | 'statement' => {
  switch (docType) {
    case 'invoice': return 'invoice'
    case 'receipt': return 'receipt'
    case 'payment_voucher': return 'voucher'
    case 'statement_of_payment': return 'statement'
    default: return 'invoice'
  }
}

// Get document title/description from document
const getDocumentTitle = (doc: Document): string => {
  const docAny = doc as any
  if (docAny.customerName) return docAny.customerName
  if (docAny.payerName) return docAny.payerName
  if (docAny.payeeName) return docAny.payeeName
  return doc.documentNumber
}

// Get total amount from document
const getDocumentTotal = (doc: Document): number => {
  const docAny = doc as any
  if (docAny.total) return docAny.total
  return doc.amount
}

// Map status to display status
const getDisplayStatus = (status: DocumentStatus): 'draft' | 'issued' | 'paid' | 'completed' | 'cancelled' => {
  if (status === 'draft' || status === 'issued' || status === 'paid' || status === 'completed' || status === 'cancelled') {
    return status
  }
  return 'issued'
}

// Format date
const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

const filterTabs: { id: FilterType; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'invoice', label: 'Invoices' },
  { id: 'receipt', label: 'Receipts' },
  { id: 'payment_voucher', label: 'Vouchers' },
  { id: 'statement_of_payment', label: 'Statements' },
]

export default function DocumentsScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const isDark = useThemeStore((state) => state.isDarkMode)
  const theme = getAppTheme(isDark)
  const user = useAuthStore((state) => state.user)

  const [fontsLoaded] = useFonts({
    CormorantGaramond_400Regular,
    CormorantGaramond_500Medium,
  })

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState<FilterType>('all')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [documents, setDocuments] = useState<Document[]>([])

  // Context menu state
  const [contextMenuVisible, setContextMenuVisible] = useState(false)
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null)

  // FAB menu state
  const [fabMenuOpen, setFabMenuOpen] = useState(false)

  const toggleFabMenu = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setFabMenuOpen(!fabMenuOpen)
  }

  const handleFabAction = async (type: 'invoice' | 'receipt' | 'payment_voucher' | 'statement_of_payment') => {
    setFabMenuOpen(false)
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    router.push(`/document/new?type=${type}`)
  }

  const fetchDocuments = useCallback(async () => {
    try {
      const data = await getDocuments(undefined, {
        type: selectedType === 'all' ? undefined : selectedType,
      })
      setDocuments(data)
    } catch (error) {
      console.error('Error fetching documents:', error)
    } finally {
      setIsLoading(false)
    }
  }, [selectedType])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  // Refresh data when screen comes into focus (handles cross-screen sync)
  useFocusEffect(
    useCallback(() => {
      fetchDocuments()
    }, [fetchDocuments])
  )

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    const pendingDocs = documents.filter(d => d.status !== 'completed' && d.status !== 'cancelled')
    const completedDocs = documents.filter(d => d.status === 'completed')

    const pendingAmount = pendingDocs.reduce((sum, d) => {
      if (d.currency === 'JPY') return sum + getDocumentTotal(d)
      return sum
    }, 0)

    const receivedAmount = completedDocs.reduce((sum, d) => {
      if (d.currency === 'JPY') return sum + getDocumentTotal(d)
      return sum
    }, 0)

    return {
      pending: pendingAmount || 284500,
      received: receivedAmount || 847200,
    }
  }, [documents])

  // Filter documents based on search
  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      const title = getDocumentTitle(doc)
      const matchesSearch =
        searchQuery === '' ||
        title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.documentNumber.toLowerCase().includes(searchQuery.toLowerCase())

      return matchesSearch
    })
  }, [searchQuery, documents])

  // Group documents by month
  const groupedDocuments = useMemo(() => {
    const groups: { [key: string]: Document[] } = {}
    filteredDocuments.forEach(doc => {
      const date = new Date(doc.date)
      const key = `${date.toLocaleString('en-US', { month: 'long' })} ${date.getFullYear()}`
      if (!groups[key]) groups[key] = []
      groups[key].push(doc)
    })
    return groups
  }, [filteredDocuments])

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    await fetchDocuments()
    setIsRefreshing(false)
  }, [fetchDocuments])

  const handleDocumentPress = async (id: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    router.push(`/document/${id}`)
  }

  const handleFilterChange = async (type: FilterType) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setSelectedType(type)
    setIsLoading(true)
  }

  // Context menu handlers
  const handleDocumentLongPress = async (doc: Document) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
    setSelectedDocument(doc)
    setContextMenuVisible(true)
  }

  const handleContextMenuClose = () => {
    setContextMenuVisible(false)
    setSelectedDocument(null)
  }

  const handleViewDetails = () => {
    if (selectedDocument) {
      router.push(`/document/${selectedDocument.id}`)
    }
  }

  const handleEditDocument = () => {
    if (selectedDocument) {
      router.push(`/document/edit/${selectedDocument.id}?type=${selectedDocument.documentType}`)
    }
  }

  const handleShareDocument = async () => {
    if (!selectedDocument) return

    try {
      const printerInfo = {
        userName: user?.name || 'Unknown User',
        printDate: new Date().toISOString(),
      }
      await sharePDF(selectedDocument, undefined, printerInfo)
    } catch (err) {
      console.error('Error sharing PDF:', err)
      Alert.alert('Error', 'Failed to generate PDF. Please try again.')
    }
  }

  const handleDeleteDocument = async () => {
    if (!selectedDocument) return

    const documentToDelete = selectedDocument

    Alert.alert(
      'Delete Document',
      `Delete ${documentToDelete.documentNumber}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Optimistic UI: Immediately remove from local state
              setDocuments(prev => prev.filter(d => d.id !== documentToDelete.id))

              const success = await deleteDocument(documentToDelete.id)
              if (success) {
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
                // Background refresh to ensure consistency with server
                fetchDocuments()
              } else {
                // Rollback: Restore document if server delete failed
                setDocuments(prev => [...prev, documentToDelete])
                Alert.alert('Error', 'Failed to delete document. Please try again.')
              }
            } catch (err) {
              console.error('Error deleting document:', err)
              // Rollback: Restore document on error
              setDocuments(prev => [...prev, documentToDelete])
              Alert.alert('Error', 'Failed to delete document. Please try again.')
            }
          },
        },
      ]
    )
  }

  if (!fontsLoaded) {
    return (
      <YStack flex={1} backgroundColor={theme.bgPrimary} justifyContent="center" alignItems="center">
        <ActivityIndicator size="large" color={theme.gold} />
      </YStack>
    )
  }

  return (
    <YStack flex={1} backgroundColor={theme.bgPrimary}>
      {/* Header */}
      <YStack
        paddingTop={insets.top + 8}
        paddingHorizontal={24}
        paddingBottom={20}
      >
        <Text
          fontFamily="CormorantGaramond_500Medium"
          fontSize={24}
          color={theme.textPrimary}
          marginBottom={20}
        >
          Documents
        </Text>

        {/* Filter Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
          marginBottom={20}
        >
          {filterTabs.map((tab) => (
            <Pressable
              key={tab.id}
              onPress={() => handleFilterChange(tab.id)}
              style={[
                styles.filterPill,
                {
                  backgroundColor: selectedType === tab.id
                    ? (isDark ? theme.gold : theme.textPrimary)
                    : theme.bgCard,
                  borderColor: selectedType === tab.id
                    ? (isDark ? theme.gold : theme.textPrimary)
                    : theme.borderSubtle,
                }
              ]}
            >
              <Text
                fontSize={12}
                fontWeight="500"
                color={selectedType === tab.id
                  ? (isDark ? theme.bgPrimary : theme.bgPrimary)
                  : theme.textSecondary
                }
              >
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </YStack>

      {/* Document List */}
      <ScrollView
        flex={1}
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingBottom: insets.bottom + 100,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={theme.gold}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <YStack alignItems="center" paddingVertical={40}>
            <ActivityIndicator size="large" color={theme.gold} />
            <Text fontSize={14} color={theme.textMuted} marginTop={12}>
              Loading documents...
            </Text>
          </YStack>
        ) : filteredDocuments.length === 0 ? (
          <YStack
            alignItems="center"
            paddingVertical={40}
            backgroundColor={theme.bgCard}
            borderRadius={14}
            borderWidth={1}
            borderColor={theme.borderSubtle}
          >
            <FileText size={48} color={theme.textMuted} opacity={0.3} />
            <Text fontSize={15} fontWeight="600" color={theme.textPrimary} marginTop={12}>
              No documents found
            </Text>
            <Text fontSize={14} color={theme.textMuted} textAlign="center" marginTop={4}>
              {searchQuery
                ? 'Try adjusting your search or filters'
                : 'Create your first document to get started'}
            </Text>
          </YStack>
        ) : (
          Object.entries(groupedDocuments).map(([month, docs]) => (
            <YStack key={month}>
              {/* Month Divider */}
              <XStack alignItems="center" gap={12} marginTop={20} marginBottom={16}>
                <Text
                  fontSize={11}
                  fontWeight="700"
                  color={theme.textMuted}
                  textTransform="uppercase"
                  letterSpacing={1.2}
                >
                  {month}
                </Text>
                <View style={[styles.dividerLine, { backgroundColor: theme.borderMedium }]} />
              </XStack>

              {/* Documents */}
              {docs.map((doc) => (
                <View key={doc.id} style={{ marginBottom: 10 }}>
                  <DocumentCard
                    title={getDocumentTitle(doc)}
                    documentNumber={doc.documentNumber}
                    date={formatDate(doc.date)}
                    amount={getDocumentTotal(doc).toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                    currency={doc.currency}
                    status={getDisplayStatus(doc.status)}
                    type={getDocumentDisplayType(doc.documentType)}
                    onPress={() => handleDocumentPress(doc.id)}
                    onLongPress={() => handleDocumentLongPress(doc)}
                  />
                </View>
              ))}
            </YStack>
          ))
        )}
      </ScrollView>

      {/* Document Context Menu */}
      {selectedDocument && (
        <DocumentContextMenu
          visible={contextMenuVisible}
          onClose={handleContextMenuClose}
          document={{
            id: selectedDocument.id,
            title: getDocumentTitle(selectedDocument),
            documentNumber: selectedDocument.documentNumber,
            type: getDocumentDisplayType(selectedDocument.documentType),
            status: getDisplayStatus(selectedDocument.status),
            amount: getDocumentTotal(selectedDocument).toLocaleString('en-MY', { minimumFractionDigits: 2 }),
            currency: selectedDocument.currency,
          }}
          onViewDetails={handleViewDetails}
          onEdit={handleEditDocument}
          onShare={handleShareDocument}
          onDelete={handleDeleteDocument}
          canEdit={canEditDocument(user, selectedDocument)}
          canShare={canPrintDocuments(user)}
          canDelete={canDeleteDocument(user, selectedDocument)}
        />
      )}

      {/* Floating Action Button */}
      <View style={[styles.fabContainer, { bottom: insets.bottom + 24 }]}>
        {/* FAB Menu Items - shown when expanded */}
        {fabMenuOpen && (
          <>
            {/* Backdrop to close FAB */}
            <Pressable
              style={styles.fabBackdrop}
              onPress={() => setFabMenuOpen(false)}
            />

            {/* Statement Action */}
            <Pressable
              style={[styles.fabAction, { backgroundColor: theme.textPrimary }]}
              onPress={() => handleFabAction('statement_of_payment')}
            >
              <ClipboardList size={18} color="#FFFFFF" />
              <RNText style={styles.fabActionLabel}>Statement</RNText>
            </Pressable>

            {/* Voucher Action */}
            <Pressable
              style={[styles.fabAction, { backgroundColor: theme.textPrimary }]}
              onPress={() => handleFabAction('payment_voucher')}
            >
              <CreditCard size={18} color="#FFFFFF" />
              <RNText style={styles.fabActionLabel}>Voucher</RNText>
            </Pressable>

            {/* Receipt Action */}
            <Pressable
              style={[styles.fabAction, { backgroundColor: theme.textPrimary }]}
              onPress={() => handleFabAction('receipt')}
            >
              <Receipt size={18} color="#FFFFFF" />
              <RNText style={styles.fabActionLabel}>Receipt</RNText>
            </Pressable>

            {/* Invoice Action */}
            <Pressable
              style={[styles.fabAction, { backgroundColor: theme.textPrimary }]}
              onPress={() => handleFabAction('invoice')}
            >
              <FileText size={18} color="#FFFFFF" />
              <RNText style={styles.fabActionLabel}>Invoice</RNText>
            </Pressable>
          </>
        )}

        {/* Main FAB Button */}
        <Pressable
          style={[styles.fabMain, { backgroundColor: theme.textPrimary }]}
          onPress={toggleFabMenu}
        >
          {fabMenuOpen ? (
            <X size={24} color="#FFFFFF" />
          ) : (
            <Plus size={24} color="#FFFFFF" />
          )}
        </Pressable>
      </View>
    </YStack>
  )
}

const styles = StyleSheet.create({
  filterBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  filterBtnInner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterPill: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
  },
  summaryItem: {
    flex: 1,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  // FAB Styles
  fabContainer: {
    position: 'absolute',
    right: 24,
    alignItems: 'flex-end',
    zIndex: 100,
  },
  fabBackdrop: {
    position: 'absolute',
    top: -1000,
    left: -1000,
    right: -100,
    bottom: -100,
    width: 2000,
    height: 2000,
  },
  fabMain: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  fabAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    paddingRight: 20,
    borderRadius: 24,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  fabActionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
})
