import { useCallback, useEffect, useState, useMemo } from 'react'
import { RefreshControl, StyleSheet, View, Pressable, Text as RNText } from 'react-native'
import { useRouter } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import {
  YStack,
  XStack,
  Text,
  ScrollView,
} from 'tamagui'
import {
  FileText,
} from '@tamagui/lucide-icons'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  useFonts,
  CormorantGaramond_400Regular,
  CormorantGaramond_500Medium,
} from '@expo-google-fonts/cormorant-garamond'

import {
  Card,
  DocumentCard,
  DashboardSkeletonLoader,
  DocumentContextMenu,
} from '../../src/components/ui'
import { canEditDocument, canPrintDocuments } from '../../src/utils/permissions'
import { sharePDF, deleteDocument } from '../../src/services'
import { Alert } from 'react-native'
import { AccountCarousel, ActionGrid } from '../../src/components/dashboard'
import { useAuthStore } from '../../src/store/authStore'
import { useThemeStore } from '../../src/store/themeStore'
import { useAccountOrderStore, sortAccountsByOrder } from '../../src/store/accountOrderStore'
import { getAppTheme } from '../../src/constants/theme'
import { getDocuments, getAccounts, getTransactions } from '../../src/services'
import type { Document, DocumentType, Account, Transaction } from '../../src/types'

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
const getDisplayStatus = (status: string): 'draft' | 'issued' | 'paid' | 'completed' | 'cancelled' => {
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

// Check if user can view financial data (Admin or Accountant only)
const canViewFinancials = (role: string | undefined): boolean => {
  return role === 'admin' || role === 'accountant'
}

// Calculate monthly stats for an account
const calculateMonthlyStats = (transactions: Transaction[]) => {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const monthlyTransactions = transactions.filter(
    (t) => new Date(t.transactionDate) >= startOfMonth
  )

  const income = monthlyTransactions
    .filter((t) => t.type === 'increase')
    .reduce((sum, t) => sum + t.amount, 0)

  const expenses = monthlyTransactions
    .filter((t) => t.type === 'decrease')
    .reduce((sum, t) => sum + t.amount, 0)

  return { income, expenses }
}

interface AccountWithStats {
  account: Account
  monthlyIncome: number
  monthlyExpenses: number
  pendingCount: number
  pendingAmount: number
}

export default function DashboardScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const user = useAuthStore((state) => state.user)
  const isDark = useThemeStore((state) => state.isDarkMode)
  const theme = getAppTheme(isDark)

  // Account ordering
  const accountOrder = useAccountOrderStore((state) => state.accountOrder)
  const initializeOrder = useAccountOrderStore((state) => state.initializeOrder)

  const [fontsLoaded] = useFonts({
    CormorantGaramond_400Regular,
    CormorantGaramond_500Medium,
  })

  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [recentDocuments, setRecentDocuments] = useState<Document[]>([])
  const [accountsWithStats, setAccountsWithStats] = useState<AccountWithStats[]>([])

  // Context menu state
  const [contextMenuVisible, setContextMenuVisible] = useState(false)
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null)

  // Check if current user can view financial data
  const showFinancials = useMemo(() => canViewFinancials(user?.role), [user?.role])

  // Sort accounts by stored order (with WIF JAPAN SDN BHD first by default)
  const sortedAccounts = useMemo(() => {
    return sortAccountsByOrder(accountsWithStats, accountOrder)
  }, [accountsWithStats, accountOrder])

  const fetchData = useCallback(async () => {
    try {
      // Fetch recent documents for all users
      const documents = await getDocuments(undefined, { limit: 5 })
      setRecentDocuments(documents)

      // Only fetch account data if user can view financials
      if (showFinancials) {
        const accounts = await getAccounts(undefined, { activeOnly: true })
        const allDocuments = await getDocuments()

        // Initialize account order with WIF JAPAN SDN BHD first
        const accountNames: Record<string, string> = {}
        accounts.forEach(acc => {
          accountNames[acc.id] = acc.name
        })
        initializeOrder(accounts.map(a => a.id), accountNames)

        // Calculate stats for each account
        const statsPromises = accounts.map(async (account) => {
          // Get transactions for this account
          const transactions = await getTransactions(account.id)
          const { income, expenses } = calculateMonthlyStats(transactions)

          // Calculate pending documents for this account
          const pendingDocs = allDocuments.filter(
            (d) =>
              d.accountId === account.id &&
              d.status !== 'completed' &&
              d.status !== 'cancelled'
          )
          const pendingCount = pendingDocs.length
          const pendingAmount = pendingDocs.reduce((sum, d) => sum + getDocumentTotal(d), 0)

          return {
            account,
            monthlyIncome: income,
            monthlyExpenses: expenses,
            pendingCount,
            pendingAmount,
          }
        })

        const accountStats = await Promise.all(statsPromises)
        setAccountsWithStats(accountStats)
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [showFinancials, initializeOrder])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Refresh data when screen comes into focus (handles cross-screen sync)
  useFocusEffect(
    useCallback(() => {
      fetchData()
    }, [fetchData])
  )

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    await fetchData()
    setIsRefreshing(false)
  }, [fetchData])

  const handleQuickAction = async (actionId: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    if (actionId === 'booking') {
      router.push('/booking/new')
    } else {
      router.push(`/document/new?type=${actionId}`)
    }
  }

  const handleDocumentPress = async (id: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    router.push(`/document/${id}`)
  }

  const handleAccountPress = async (account: Account) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    router.push('/(tabs)/ledger')
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
              setRecentDocuments(prev => prev.filter(d => d.id !== documentToDelete.id))

              const success = await deleteDocument(documentToDelete.id)
              if (success) {
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
                // Background refresh to ensure consistency with server
                fetchData()
              } else {
                // Rollback: Restore document if server delete failed
                setRecentDocuments(prev => [...prev, documentToDelete])
                Alert.alert('Error', 'Failed to delete document. Please try again.')
              }
            } catch (err) {
              console.error('Error deleting document:', err)
              // Rollback: Restore document on error
              setRecentDocuments(prev => [...prev, documentToDelete])
              Alert.alert('Error', 'Failed to delete document. Please try again.')
            }
          },
        },
      ]
    )
  }

  if (isLoading || !fontsLoaded) {
    return (
      <YStack flex={1} backgroundColor={theme.bgPrimary} paddingTop={insets.top + 8}>
        <DashboardSkeletonLoader theme={theme} />
      </YStack>
    )
  }

  // Render different dashboards based on role
  if (showFinancials) {
    // Admin/Accountant Dashboard - with account cards
    return (
      <ScrollView
        flex={1}
        backgroundColor={theme.bgPrimary}
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 100,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={theme.gold}
          />
        }
      >
        {/* Header */}
        <XStack
          justifyContent="space-between"
          alignItems="flex-start"
          marginBottom="$5"
          paddingHorizontal="$6"
        >
          <YStack>
            <Text
              fontSize={13}
              color={theme.textMuted}
              letterSpacing={0.3}
              marginBottom="$1"
            >
              Welcome back,
            </Text>
            <Text
              fontFamily="CormorantGaramond_500Medium"
              fontSize={26}
              color={theme.textPrimary}
              letterSpacing={-0.3}
            >
              {user?.name || 'User'}
            </Text>
          </YStack>

          <View style={[styles.avatar, { backgroundColor: theme.indigo }]}>
            <LinearGradient
              colors={[theme.indigo, isDark ? '#4A5A75' : '#3A4A65']}
              style={styles.avatarGradient}
            >
              <Text fontSize={18} fontWeight="600" color="#FFFFFF">
                {user?.name?.charAt(0) || 'U'}
              </Text>
            </LinearGradient>
          </View>
        </XStack>

        {/* Swipeable Account Cards - Long press to reorder */}
        <AccountCarousel
          accounts={sortedAccounts}
          onAccountPress={handleAccountPress}
          theme={theme}
        />

        {/* Quick Actions */}
        <ActionGrid
          onAction={handleQuickAction}
          showBooking={true}
          theme={theme}
        />

        {/* Recent Documents */}
        <YStack paddingHorizontal="$6">
          <XStack justifyContent="space-between" alignItems="center" marginBottom="$4">
            <Text
              fontSize={13}
              fontWeight="600"
              color={theme.textPrimary}
              letterSpacing={0.3}
            >
              Recent Documents
            </Text>
            <Pressable
              onPress={() => router.push('/(tabs)/documents')}
              hitSlop={8}
            >
              <RNText style={[styles.viewAllText, { color: theme.gold }]}>
                View All
              </RNText>
            </Pressable>
          </XStack>

          <YStack gap="$3">
            {recentDocuments.length === 0 ? (
              <Card padding="$5" alignItems="center" backgroundColor={theme.bgCard}>
                <FileText size={40} color={theme.textMuted} opacity={0.3} />
                <Text fontSize={14} color={theme.textMuted} marginTop="$2">
                  No documents yet
                </Text>
              </Card>
            ) : (
              recentDocuments.map((doc) => (
                <DocumentCard
                  key={doc.id}
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
              ))
            )}
          </YStack>
        </YStack>

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
            canDelete={canEditDocument(user, selectedDocument)}
          />
        )}
      </ScrollView>
    )
  }

  // Viewer/Manager Dashboard - actions only
  return (
    <ScrollView
      flex={1}
      backgroundColor={theme.bgPrimary}
      contentContainerStyle={{
        paddingTop: insets.top + 8,
        paddingBottom: insets.bottom + 100,
      }}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor={theme.gold}
        />
      }
    >
      {/* Header */}
      <XStack
        justifyContent="space-between"
        alignItems="flex-start"
        marginBottom="$6"
        paddingHorizontal="$6"
      >
        <YStack>
          <Text
            fontSize={13}
            color={theme.textMuted}
            letterSpacing={0.3}
            marginBottom="$1"
          >
            Welcome back,
          </Text>
          <Text
            fontFamily="CormorantGaramond_500Medium"
            fontSize={26}
            color={theme.textPrimary}
            letterSpacing={-0.3}
          >
            {user?.name || 'User'}
          </Text>
        </YStack>

        <View style={[styles.avatar, { backgroundColor: theme.indigo }]}>
          <LinearGradient
            colors={[theme.indigo, isDark ? '#4A5A75' : '#3A4A65']}
            style={styles.avatarGradient}
          >
            <Text fontSize={18} fontWeight="600" color="#FFFFFF">
              {user?.name?.charAt(0) || 'U'}
            </Text>
          </LinearGradient>
        </View>
      </XStack>

      {/* Hero section for non-financial users */}
      <YStack alignItems="center" marginBottom="$6" paddingHorizontal="$6">
        <View style={[styles.heroIcon, { backgroundColor: theme.goldSoft }]}>
          <FileText size={48} color={theme.gold} />
        </View>
        <Text
          fontFamily="CormorantGaramond_500Medium"
          fontSize={24}
          color={theme.textPrimary}
          textAlign="center"
          marginTop="$4"
        >
          What would you like to do?
        </Text>
        <Text
          fontSize={14}
          color={theme.textMuted}
          textAlign="center"
          marginTop="$2"
        >
          Create documents or manage bookings
        </Text>
      </YStack>

      {/* Compact Action Grid */}
      <ActionGrid
        onAction={handleQuickAction}
        showBooking={true}
        compact={true}
        theme={theme}
      />

      {/* Recent Documents */}
      <YStack paddingHorizontal="$6" marginTop="$6">
        <XStack justifyContent="space-between" alignItems="center" marginBottom="$4">
          <Text
            fontSize={13}
            fontWeight="600"
            color={theme.textPrimary}
            letterSpacing={0.3}
          >
            Your Recent Documents
          </Text>
          <Pressable
            onPress={() => router.push('/(tabs)/documents')}
            hitSlop={8}
          >
            <RNText style={[styles.viewAllText, { color: theme.gold }]}>
              View All
            </RNText>
          </Pressable>
        </XStack>

        <YStack gap="$3">
          {recentDocuments.length === 0 ? (
            <Card padding="$5" alignItems="center" backgroundColor={theme.bgCard}>
              <FileText size={40} color={theme.textMuted} opacity={0.3} />
              <Text fontSize={14} color={theme.textMuted} marginTop="$2">
                No documents yet
              </Text>
            </Card>
          ) : (
            recentDocuments.slice(0, 3).map((doc) => (
              <DocumentCard
                key={doc.id}
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
            ))
          )}
        </YStack>
      </YStack>

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
          canDelete={canEditDocument(user, selectedDocument)}
        />
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    overflow: 'hidden',
  },
  avatarGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: '500',
  },
  heroIcon: {
    width: 96,
    height: 96,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
})
