import { useState, useCallback, useMemo, useEffect } from 'react'
import { RefreshControl, ActivityIndicator, StyleSheet, View, Pressable } from 'react-native'
import { useRouter } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import {
  YStack,
  XStack,
  Text,
  ScrollView,
} from 'tamagui'
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Building,
  Coins,
  TrendingUp,
  TrendingDown,
  Minus,
  Lock,
} from '@tamagui/lucide-icons'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  useFonts,
  CormorantGaramond_400Regular,
  CormorantGaramond_500Medium,
} from '@expo-google-fonts/cormorant-garamond'

import { getAccounts, getTransactions } from '../../src/services'
import type { Account, Transaction, Currency } from '../../src/types'
import { getAppTheme } from '../../src/constants/theme'
import { useThemeStore } from '../../src/store/themeStore'
import { useAuthStore } from '../../src/store/authStore'

// Check if user can view financial data (Admin or Accountant only)
const canViewFinancials = (role: string | undefined): boolean => {
  return role === 'admin' || role === 'accountant'
}

// Format date
const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

// Format currency
const formatCurrency = (amount: number, currency: Currency): string => {
  if (currency === 'JPY') {
    return `¥${amount.toLocaleString()}`
  }
  return `RM ${amount.toLocaleString('en-MY', { minimumFractionDigits: 2 })}`
}

// UI transaction type for display
interface UITransaction {
  id: string
  accountId: string
  accountName: string
  type: 'credit' | 'debit'
  amount: number
  currency: Currency
  description: string
  documentNumber?: string
  date: string
  balanceAfter: number
}

export default function LedgerScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const user = useAuthStore((state) => state.user)
  const isDark = useThemeStore((state) => state.isDarkMode)
  const theme = getAppTheme(isDark)

  const [fontsLoaded] = useFonts({
    CormorantGaramond_400Regular,
    CormorantGaramond_500Medium,
  })

  // Check if current user can view financial data
  const showFinancials = useMemo(() => canViewFinancials(user?.role), [user?.role])

  const [selectedAccount, setSelectedAccount] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [transactions, setTransactions] = useState<UITransaction[]>([])

  const fetchData = useCallback(async () => {
    // Only fetch data if user has permission
    if (!showFinancials) {
      setIsLoading(false)
      return
    }

    try {
      const accountsData = await getAccounts(undefined, { activeOnly: true })
      setAccounts(accountsData)

      const allTransactions: UITransaction[] = []
      for (const account of accountsData) {
        const txns = await getTransactions(account.id, { limit: 20 })
        allTransactions.push(
          ...txns.map((t) => ({
            id: t.id,
            accountId: t.accountId,
            accountName: account.name,
            type: t.type === 'increase' ? 'credit' as const : 'debit' as const,
            amount: t.amount,
            currency: account.currency,
            description: t.description || '',
            documentNumber: undefined,
            date: t.transactionDate,
            balanceAfter: t.balanceAfter,
          }))
        )
      }

      allTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      setTransactions(allTransactions)
    } catch (error) {
      console.error('Error fetching ledger data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [showFinancials])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Refresh data when screen comes into focus (handles cross-screen sync)
  useFocusEffect(
    useCallback(() => {
      if (showFinancials) {
        fetchData()
      }
    }, [fetchData, showFinancials])
  )

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    const income = transactions
      .filter(t => t.type === 'credit')
      .reduce((sum, t) => sum + t.amount, 0)

    const expenses = transactions
      .filter(t => t.type === 'debit')
      .reduce((sum, t) => sum + t.amount, 0)

    return {
      income: income || 847200,
      expenses: expenses || 284500,
      net: (income || 847200) - (expenses || 284500),
    }
  }, [transactions])

  const totalBalanceJPY = useMemo(() => {
    return accounts
      .filter((a) => a.currency === 'JPY')
      .reduce((sum, a) => sum + a.currentBalance, 0)
  }, [accounts])

  const totalBalanceMYR = useMemo(() => {
    return accounts
      .filter((a) => a.currency === 'MYR')
      .reduce((sum, a) => sum + a.currentBalance, 0)
  }, [accounts])

  const filteredTransactions = useMemo(() => {
    if (!selectedAccount) return transactions
    return transactions.filter((t) => t.accountId === selectedAccount)
  }, [selectedAccount, transactions])

  // Group transactions by date
  const groupedTransactions = useMemo(() => {
    const groups: { [key: string]: UITransaction[] } = {}
    filteredTransactions.forEach(txn => {
      const date = new Date(txn.date)
      const key = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
      if (!groups[key]) groups[key] = []
      groups[key].push(txn)
    })
    return groups
  }, [filteredTransactions])

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    await fetchData()
    setIsRefreshing(false)
  }, [fetchData])

  const handleAccountPress = async (id: string | null) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setSelectedAccount(id === selectedAccount ? null : id)
  }

  if (!fontsLoaded) {
    return (
      <YStack flex={1} backgroundColor={theme.bgPrimary} justifyContent="center" alignItems="center">
        <ActivityIndicator size="large" color={theme.gold} />
      </YStack>
    )
  }

  // Restricted access view for non-financial users
  if (!showFinancials) {
    return (
      <YStack flex={1} backgroundColor={theme.bgPrimary}>
        <YStack paddingTop={insets.top + 8} paddingHorizontal={24}>
          <Text
            fontFamily="CormorantGaramond_500Medium"
            fontSize={24}
            color={theme.textPrimary}
            marginBottom={20}
          >
            Ledger
          </Text>
        </YStack>

        <YStack flex={1} justifyContent="center" alignItems="center" paddingHorizontal={40}>
          <View style={[styles.restrictedIcon, { backgroundColor: theme.goldSoft }]}>
            <Lock size={48} color={theme.gold} />
          </View>
          <Text
            fontFamily="CormorantGaramond_500Medium"
            fontSize={24}
            color={theme.textPrimary}
            textAlign="center"
            marginTop={24}
          >
            Access Restricted
          </Text>
          <Text
            fontSize={14}
            color={theme.textMuted}
            textAlign="center"
            marginTop={12}
            lineHeight={22}
          >
            The ledger contains sensitive financial data and is only accessible to users with Admin or Accountant roles.
          </Text>
          <Text
            fontSize={13}
            color={theme.textSecondary}
            textAlign="center"
            marginTop={24}
          >
            Contact your administrator if you need access.
          </Text>
        </YStack>
      </YStack>
    )
  }

  return (
    <YStack flex={1} backgroundColor={theme.bgPrimary}>
      {/* Header */}
      <YStack paddingTop={insets.top + 8} paddingHorizontal={24}>
        <Text
          fontFamily="CormorantGaramond_500Medium"
          fontSize={24}
          color={theme.textPrimary}
          marginBottom={20}
        >
          Ledger
        </Text>

        {/* Account Pills */}
        {accounts.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10, paddingVertical: 16 }}
          >
            <Pressable
              onPress={() => handleAccountPress(null)}
              style={[
                styles.accountPill,
                {
                  backgroundColor: selectedAccount === null
                    ? (isDark ? theme.gold : theme.textPrimary)
                    : theme.bgCard,
                  borderColor: selectedAccount === null
                    ? (isDark ? theme.gold : theme.textPrimary)
                    : theme.borderSubtle,
                }
              ]}
            >
              <Text
                fontSize={12}
                fontWeight="500"
                color={selectedAccount === null
                  ? (isDark ? theme.bgPrimary : theme.bgPrimary)
                  : theme.textSecondary
                }
              >
                All Accounts
              </Text>
            </Pressable>
            {accounts.map((account) => (
              <Pressable
                key={account.id}
                onPress={() => handleAccountPress(account.id)}
                style={[
                  styles.accountPill,
                  {
                    backgroundColor: selectedAccount === account.id
                      ? (isDark ? theme.gold : theme.textPrimary)
                      : theme.bgCard,
                    borderColor: selectedAccount === account.id
                      ? (isDark ? theme.gold : theme.textPrimary)
                      : theme.borderSubtle,
                  }
                ]}
              >
                {account.type === 'main_bank' ? (
                  <Building size={14} color={selectedAccount === account.id
                    ? (isDark ? theme.bgPrimary : theme.bgPrimary)
                    : theme.indigo
                  } />
                ) : (
                  <Coins size={14} color={selectedAccount === account.id
                    ? (isDark ? theme.bgPrimary : theme.bgPrimary)
                    : theme.gold
                  } />
                )}
                <Text
                  fontSize={12}
                  fontWeight="500"
                  color={selectedAccount === account.id
                    ? (isDark ? theme.bgPrimary : theme.bgPrimary)
                    : theme.textSecondary
                  }
                >
                  {account.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </YStack>

      {/* Transactions List */}
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
              Loading transactions...
            </Text>
          </YStack>
        ) : filteredTransactions.length === 0 ? (
          <YStack
            alignItems="center"
            paddingVertical={40}
            backgroundColor={theme.bgCard}
            borderRadius={14}
            borderWidth={1}
            borderColor={theme.borderSubtle}
          >
            <Wallet size={48} color={theme.textMuted} opacity={0.3} />
            <Text fontSize={15} fontWeight="600" color={theme.textPrimary} marginTop={12}>
              No transactions yet
            </Text>
            <Text fontSize={14} color={theme.textMuted} textAlign="center" marginTop={4}>
              Transactions will appear here when documents are linked to accounts
            </Text>
          </YStack>
        ) : (
          Object.entries(groupedTransactions).map(([date, txns]) => (
            <YStack key={date}>
              {/* Date Divider */}
              <XStack alignItems="center" gap={12} marginTop={16} marginBottom={12}>
                <Text
                  fontSize={11}
                  fontWeight="700"
                  color={theme.textMuted}
                  textTransform="uppercase"
                  letterSpacing={1}
                >
                  {date}
                </Text>
                <View style={[styles.dividerLine, { backgroundColor: theme.borderMedium }]} />
              </XStack>

              {/* Transactions */}
              {txns.map((txn) => (
                <View
                  key={txn.id}
                  style={[styles.txnCard, {
                    backgroundColor: theme.bgCard,
                    borderColor: theme.borderSubtle,
                  }]}
                >
                  <XStack alignItems="center" gap={12}>
                    {/* Icon */}
                    <View style={[
                      styles.txnIcon,
                      { backgroundColor: txn.type === 'credit' ? theme.jadeSoft : theme.vermillionSoft }
                    ]}>
                      {txn.type === 'credit' ? (
                        <ArrowDownLeft size={18} color={theme.positive} />
                      ) : (
                        <ArrowUpRight size={18} color={theme.negative} />
                      )}
                    </View>

                    {/* Details */}
                    <YStack flex={1}>
                      <Text fontSize={14} fontWeight="500" color={theme.textPrimary} numberOfLines={1}>
                        {txn.description || (txn.type === 'credit' ? 'Deposit' : 'Withdrawal')}
                      </Text>
                      <Text fontSize={12} color={theme.textMuted}>
                        {txn.accountName}
                      </Text>
                    </YStack>

                    {/* Amount */}
                    <YStack alignItems="flex-end">
                      <Text
                        fontSize={14}
                        fontWeight="600"
                        color={txn.type === 'credit' ? theme.positive : theme.negative}
                      >
                        {txn.type === 'credit' ? '+' : '-'}
                        {formatCurrency(txn.amount, txn.currency)}
                      </Text>
                      <Text fontSize={11} color={theme.textMuted}>
                        Bal: {formatCurrency(txn.balanceAfter, txn.currency)}
                      </Text>
                    </YStack>
                  </XStack>
                </View>
              ))}
            </YStack>
          ))
        )}
      </ScrollView>
    </YStack>
  )
}

const styles = StyleSheet.create({
  summaryCard: {
    borderRadius: 18,
    padding: 24,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  summaryGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  miniIcon: {
    width: 20,
    height: 20,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  divider: {
    width: 1,
    height: 40,
    marginHorizontal: 8,
  },
  accountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
  },
  txnCard: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
  },
  txnIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  restrictedIcon: {
    width: 96,
    height: 96,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
})
