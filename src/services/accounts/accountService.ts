/**
 * Account Service for Mobile
 *
 * Provides CRUD operations for accounts and transactions:
 * - Bank accounts (main_bank)
 * - Petty cash accounts (petty_cash)
 * - Transaction tracking
 * - Balance management
 *
 * Matches web app's supabaseService.ts implementation
 */

import { supabase } from '../api/supabaseClient'
import { Account, Transaction, AccountType, Currency, Country } from '../../types'

// Default company ID (single-tenant mode)
const DEFAULT_COMPANY_ID = 'c0000000-0000-0000-0000-000000000001'

// ============================================================================
// ACCOUNT OPERATIONS
// ============================================================================

/**
 * Get all accounts for a company
 */
export async function getAccounts(
  companyId: string = DEFAULT_COMPANY_ID,
  options?: {
    type?: AccountType
    currency?: Currency
    activeOnly?: boolean
  }
): Promise<Account[]> {
  try {
    let query = supabase
      .from('accounts')
      .select('*')
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (options?.type) {
      query = query.eq('type', options.type)
    }

    if (options?.currency) {
      query = query.eq('currency', options.currency)
    }

    if (options?.activeOnly) {
      query = query.eq('is_active', true)
    }

    const { data, error } = await query

    if (error) throw error
    return (data || []).map(dbAccountToAccount)
  } catch (error) {
    console.error('Error getting accounts:', error)
    throw new Error(`Failed to get accounts: ${error}`)
  }
}

/**
 * Get a single account by ID
 */
export async function getAccount(accountId: string): Promise<Account | null> {
  try {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', accountId)
      .single()

    if (error) throw error
    if (!data) return null

    return dbAccountToAccount(data)
  } catch (error) {
    console.error('Error getting account:', error)
    return null
  }
}

/**
 * Create a new account
 */
export async function createAccount(
  account: Omit<Account, 'id' | 'createdAt' | 'updatedAt'>,
  companyId: string = DEFAULT_COMPANY_ID
): Promise<Account> {
  try {
    const insert = {
      company_id: companyId,
      name: account.name,
      type: account.type,
      currency: account.currency,
      country: account.country,
      bank_name: account.bankName || null,
      account_number: account.accountNumber || null,
      custodian: account.custodian || null,
      initial_balance: account.initialBalance,
      current_balance: account.currentBalance,
      is_active: account.isActive !== undefined ? account.isActive : true,
      notes: account.notes || null,
    }

    const { data, error } = await supabase
      .from('accounts')
      .insert(insert)
      .select()
      .single()

    if (error) throw error
    return dbAccountToAccount(data!)
  } catch (error) {
    console.error('Error creating account:', error)
    throw new Error(`Failed to create account: ${error}`)
  }
}

/**
 * Update an account
 */
export async function updateAccount(
  accountId: string,
  updates: Partial<Account>
): Promise<Account | null> {
  try {
    const { data, error } = await supabase
      .from('accounts')
      .update({
        ...(updates.name && { name: updates.name }),
        ...(updates.currentBalance !== undefined && { current_balance: updates.currentBalance }),
        ...(updates.isActive !== undefined && { is_active: updates.isActive }),
        ...(updates.notes !== undefined && { notes: updates.notes }),
        ...(updates.custodian !== undefined && { custodian: updates.custodian }),
      })
      .eq('id', accountId)
      .select()
      .single()

    if (error) throw error
    return dbAccountToAccount(data!)
  } catch (error) {
    console.error('Error updating account:', error)
    throw new Error(`Failed to update account: ${error}`)
  }
}

/**
 * Soft delete an account
 */
export async function deleteAccount(accountId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('accounts')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', accountId)

    if (error) throw error
    return true
  } catch (error) {
    console.error('Error deleting account:', error)
    return false
  }
}

/**
 * Update account balance
 * Called when receipts (increase) or statements of payment (decrease) are completed
 */
export async function updateAccountBalance(
  accountId: string,
  amount: number,
  type: 'increase' | 'decrease',
  documentId?: string,
  description?: string
): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  try {
    // Get current account
    const { data: account, error: fetchError } = await supabase
      .from('accounts')
      .select('current_balance')
      .eq('id', accountId)
      .single()

    if (fetchError) throw fetchError
    if (!account) throw new Error('Account not found')

    const currentBalance = account.current_balance
    const newBalance = type === 'increase'
      ? currentBalance + amount
      : currentBalance - amount

    // Check if negative balance is allowed
    if (newBalance < 0) {
      const { data: company } = await supabase
        .from('companies')
        .select('allow_negative_balance')
        .single()

      if (!company?.allow_negative_balance) {
        return {
          success: false,
          error: 'Insufficient balance. Negative balance not allowed.',
        }
      }
    }

    // Update account balance
    const { error: updateError } = await supabase
      .from('accounts')
      .update({ current_balance: newBalance })
      .eq('id', accountId)

    if (updateError) throw updateError

    // Create transaction record
    await supabase.from('transactions').insert({
      account_id: accountId,
      document_id: documentId || null,
      type,
      amount,
      balance_before: currentBalance,
      balance_after: newBalance,
      description: description || `${type === 'increase' ? 'Deposit' : 'Withdrawal'}`,
      transaction_date: new Date().toISOString(),
    })

    return { success: true, newBalance }
  } catch (error) {
    console.error('Error updating account balance:', error)
    return { success: false, error: `${error}` }
  }
}

// ============================================================================
// TRANSACTION OPERATIONS
// ============================================================================

/**
 * Get transactions for an account
 * Filters out transactions linked to deleted documents
 */
export async function getTransactions(
  accountId: string,
  options?: {
    limit?: number
    offset?: number
    startDate?: string
    endDate?: string
  }
): Promise<Transaction[]> {
  try {
    // Fetch transactions with linked document info to filter deleted ones
    let query = supabase
      .from('transactions')
      .select(`
        *,
        documents:document_id (
          id,
          deleted_at
        )
      `)
      .eq('account_id', accountId)
      .order('transaction_date', { ascending: false })

    if (options?.startDate) {
      query = query.gte('transaction_date', options.startDate)
    }

    if (options?.endDate) {
      query = query.lte('transaction_date', options.endDate)
    }

    // Fetch more than needed to account for filtered items
    const fetchLimit = (options?.limit || 50) * 2

    if (options?.offset) {
      query = query.range(options.offset, options.offset + fetchLimit - 1)
    } else {
      query = query.limit(fetchLimit)
    }

    const { data, error } = await query

    if (error) throw error

    // Filter out transactions linked to deleted documents
    const filteredData = (data || []).filter((txn: any) => {
      // Keep transactions without document link (manual entries)
      if (!txn.document_id) return true
      // Keep transactions where document is not deleted
      if (!txn.documents) return true // Document might not exist
      return txn.documents.deleted_at === null
    })

    // Apply the requested limit after filtering
    const limitedData = options?.limit
      ? filteredData.slice(0, options.limit)
      : filteredData

    return limitedData.map((txn: any) => {
      // Remove the joined documents data before mapping
      const { documents, ...transactionData } = txn
      return dbTransactionToTransaction(transactionData)
    })
  } catch (error) {
    console.error('Error getting transactions:', error)
    throw new Error(`Failed to get transactions: ${error}`)
  }
}

/**
 * Get account summary with balance
 */
export async function getAccountSummary(
  companyId: string = DEFAULT_COMPANY_ID
): Promise<{
  totalMYR: number
  totalJPY: number
  accounts: Account[]
}> {
  try {
    const accounts = await getAccounts(companyId, { activeOnly: true })

    const totalMYR = accounts
      .filter((a) => a.currency === 'MYR')
      .reduce((sum, a) => sum + a.currentBalance, 0)

    const totalJPY = accounts
      .filter((a) => a.currency === 'JPY')
      .reduce((sum, a) => sum + a.currentBalance, 0)

    return { totalMYR, totalJPY, accounts }
  } catch (error) {
    console.error('Error getting account summary:', error)
    throw new Error(`Failed to get account summary: ${error}`)
  }
}

// ============================================================================
// DATA CONVERTERS
// ============================================================================

function dbAccountToAccount(dbAccount: any): Account {
  return {
    id: dbAccount.id,
    name: dbAccount.name,
    type: dbAccount.type as AccountType,
    currency: dbAccount.currency as Currency,
    country: dbAccount.country as Country,
    bankName: dbAccount.bank_name || undefined,
    accountNumber: dbAccount.account_number || undefined,
    custodian: dbAccount.custodian || undefined,
    initialBalance: dbAccount.initial_balance,
    currentBalance: dbAccount.current_balance,
    isActive: dbAccount.is_active,
    notes: dbAccount.notes || undefined,
    createdAt: dbAccount.created_at,
    updatedAt: dbAccount.updated_at,
    deletedAt: dbAccount.deleted_at || undefined,
  }
}

function dbTransactionToTransaction(dbTransaction: any): Transaction {
  return {
    id: dbTransaction.id,
    accountId: dbTransaction.account_id,
    documentId: dbTransaction.document_id || undefined,
    type: dbTransaction.type as 'increase' | 'decrease',
    amount: dbTransaction.amount,
    balanceBefore: dbTransaction.balance_before,
    balanceAfter: dbTransaction.balance_after,
    description: dbTransaction.description || undefined,
    transactionDate: dbTransaction.transaction_date,
    createdAt: dbTransaction.created_at,
  }
}
