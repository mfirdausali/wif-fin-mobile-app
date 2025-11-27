/**
 * Account Types - Matches web app exactly
 *
 * Account types for WIF Finance:
 * - main_bank: Bank accounts for main operations
 * - petty_cash: Petty cash accounts with custodian
 */

import { Currency, Country } from './document'

export type AccountType = 'main_bank' | 'petty_cash'

export interface Account {
  id: string
  name: string
  type: AccountType
  currency: Currency
  country: Country
  bankName?: string
  accountNumber?: string
  custodian?: string
  initialBalance: number
  currentBalance: number
  isActive: boolean
  notes?: string
  createdAt: string
  updatedAt: string
  deletedAt?: string
}

export interface Transaction {
  id: string
  accountId: string
  documentId?: string
  type: 'increase' | 'decrease'
  amount: number
  balanceBefore: number
  balanceAfter: number
  description?: string
  transactionDate: string
  createdAt: string
}

/**
 * Account type display names
 */
export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  main_bank: 'Bank Account',
  petty_cash: 'Petty Cash',
}

/**
 * Currency display configuration
 */
export const CURRENCY_CONFIG: Record<Currency, { symbol: string; name: string; locale: string }> = {
  MYR: { symbol: 'RM', name: 'Malaysian Ringgit', locale: 'ms-MY' },
  JPY: { symbol: '¥', name: 'Japanese Yen', locale: 'ja-JP' },
}

/**
 * Format currency amount
 */
export function formatCurrency(amount: number, currency: Currency): string {
  const config = CURRENCY_CONFIG[currency]
  const formatted = new Intl.NumberFormat(config.locale, {
    minimumFractionDigits: currency === 'JPY' ? 0 : 2,
    maximumFractionDigits: currency === 'JPY' ? 0 : 2,
  }).format(amount)
  return `${config.symbol} ${formatted}`
}

/**
 * Parse currency string to number
 */
export function parseCurrency(value: string): number {
  const cleaned = value.replace(/[^0-9.-]/g, '')
  return parseFloat(cleaned) || 0
}
