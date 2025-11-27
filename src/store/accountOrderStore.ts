import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

// Default account that should always be first
const DEFAULT_FIRST_ACCOUNT = 'WIF JAPAN SDN BHD'

export interface AccountOrderState {
  // State - ordered list of account IDs
  accountOrder: string[]

  // Actions
  setAccountOrder: (order: string[]) => void
  moveAccount: (fromIndex: number, toIndex: number) => void
  initializeOrder: (accountIds: string[], accountNames: Record<string, string>) => void
}

export const useAccountOrderStore = create<AccountOrderState>()(
  persist(
    (set, get) => ({
      // Initial state - empty, will be populated on first load
      accountOrder: [],

      // Set the entire order
      setAccountOrder: (order) => set({ accountOrder: order }),

      // Move an account from one position to another
      moveAccount: (fromIndex, toIndex) => {
        const { accountOrder } = get()
        const newOrder = [...accountOrder]
        const [movedItem] = newOrder.splice(fromIndex, 1)
        newOrder.splice(toIndex, 0, movedItem)
        set({ accountOrder: newOrder })
      },

      // Initialize order with accounts, ensuring WIF JAPAN SDN BHD is first
      initializeOrder: (accountIds, accountNames) => {
        const { accountOrder } = get()

        // If we already have an order and it contains all the accounts, keep it
        const existingIds = new Set(accountOrder)
        const newIds = new Set(accountIds)

        // Check if existing order is still valid (all IDs match)
        const orderIsValid = accountOrder.length > 0 &&
          accountOrder.every(id => newIds.has(id)) &&
          accountIds.every(id => existingIds.has(id))

        if (orderIsValid) {
          return // Keep existing order
        }

        // Create new order with WIF JAPAN SDN BHD first
        const sortedIds = [...accountIds]

        // Find WIF JAPAN SDN BHD and move to front
        const wifJapanIndex = sortedIds.findIndex(id => {
          const name = accountNames[id]
          return name && name.toUpperCase().includes(DEFAULT_FIRST_ACCOUNT)
        })

        if (wifJapanIndex > 0) {
          const [wifJapan] = sortedIds.splice(wifJapanIndex, 1)
          sortedIds.unshift(wifJapan)
        }

        set({ accountOrder: sortedIds })
      },
    }),
    {
      name: 'wif-account-order-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        accountOrder: state.accountOrder,
      }),
    }
  )
)

// Helper function to sort accounts by stored order
export function sortAccountsByOrder<T extends { account: { id: string; name: string } }>(
  accounts: T[],
  order: string[]
): T[] {
  if (order.length === 0) {
    // Default sort: WIF JAPAN SDN BHD first
    return [...accounts].sort((a, b) => {
      const aIsWifJapan = a.account.name.toUpperCase().includes(DEFAULT_FIRST_ACCOUNT)
      const bIsWifJapan = b.account.name.toUpperCase().includes(DEFAULT_FIRST_ACCOUNT)
      if (aIsWifJapan && !bIsWifJapan) return -1
      if (!aIsWifJapan && bIsWifJapan) return 1
      return 0
    })
  }

  // Sort by stored order
  const orderMap = new Map(order.map((id, index) => [id, index]))

  return [...accounts].sort((a, b) => {
    const aIndex = orderMap.get(a.account.id) ?? 999
    const bIndex = orderMap.get(b.account.id) ?? 999
    return aIndex - bIndex
  })
}

// Selectors
export const useAccountOrder = () => useAccountOrderStore((state) => state.accountOrder)
