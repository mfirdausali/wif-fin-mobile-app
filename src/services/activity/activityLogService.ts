/**
 * Activity Log Service
 *
 * Handles logging of user activities to Google Sheets.
 * Matches the web app's implementation - sends to Google Apps Script web app.
 */

import AsyncStorage from '@react-native-async-storage/async-storage'
import Constants from 'expo-constants'
import type {
  ActivityType,
  ActivityLog,
  ActivityUser,
  ActivityBookingInfo,
  ActivityDocumentInfo,
  ActivityAccountInfo,
  ActivityLogFilter,
} from '../../types/activity'
import {
  generateBookingDescription,
  generateDocumentDescription,
} from '../../types/activity'

// Storage key for pending logs (offline support)
const PENDING_LOGS_KEY = 'wif_activity_logs_pending'

// Google Sheets Web App URL (same as web app)
const GOOGLE_SHEETS_URL =
  Constants.expoConfig?.extra?.activityLogUrl ||
  process.env.EXPO_PUBLIC_ACTIVITY_LOG_URL ||
  'https://script.google.com/macros/s/AKfycby_R5Ct_gT-ThSJfV6AousKqagZy14eKYicrEs4iVZkQlMUIM-D04TBK7NWnTdQWgjF/exec'

/**
 * Check if Google Sheets is configured
 */
function isGoogleSheetsConfigured(): boolean {
  return !!GOOGLE_SHEETS_URL && GOOGLE_SHEETS_URL.includes('script.google.com')
}

/**
 * Create a base activity log entry
 */
function createActivityLog(
  type: ActivityType,
  user: ActivityUser,
  description: string,
  options?: {
    resourceId?: string
    resourceType?: 'document' | 'booking' | 'account' | 'transaction' | 'user'
    metadata?: Record<string, any>
  }
): ActivityLog {
  return {
    id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type,
    userId: user.id,
    username: user.username,
    description,
    resourceId: options?.resourceId,
    resourceType: options?.resourceType,
    metadata: {
      ...options?.metadata,
      platform: 'mobile', // Distinguish from web app logs
    },
    timestamp: new Date().toISOString(),
  }
}

/**
 * Send activity log to Google Sheets
 */
async function sendToGoogleSheets(log: ActivityLog): Promise<boolean> {
  if (!isGoogleSheetsConfigured()) {
    console.log('Google Sheets not configured, skipping activity log')
    return false
  }

  try {
    // Use no-cors mode for Google Apps Script (same as web app)
    await fetch(GOOGLE_SHEETS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'log',
        log: log,
      }),
      mode: 'no-cors', // Required for Google Apps Script
    })

    // With no-cors, we can't read the response, but if fetch didn't throw, assume success
    return true
  } catch (error) {
    console.error('Failed to send activity log to Google Sheets:', error)
    return false
  }
}

/**
 * Add log to pending queue for later sync
 */
async function addToPendingQueue(log: ActivityLog): Promise<void> {
  try {
    const existingData = await AsyncStorage.getItem(PENDING_LOGS_KEY)
    const pendingLogs: ActivityLog[] = existingData ? JSON.parse(existingData) : []

    // Keep max 100 pending logs
    if (pendingLogs.length >= 100) {
      pendingLogs.shift() // Remove oldest
    }

    pendingLogs.push(log)
    await AsyncStorage.setItem(PENDING_LOGS_KEY, JSON.stringify(pendingLogs))
  } catch (error) {
    console.error('Failed to add to pending queue:', error)
  }
}

/**
 * Sync pending logs to Google Sheets
 */
export async function syncPendingLogs(): Promise<number> {
  if (!isGoogleSheetsConfigured()) {
    return 0
  }

  try {
    const existingData = await AsyncStorage.getItem(PENDING_LOGS_KEY)
    if (!existingData) return 0

    const pendingLogs: ActivityLog[] = JSON.parse(existingData)
    if (pendingLogs.length === 0) return 0

    // Try batch send first
    try {
      await fetch(GOOGLE_SHEETS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'batch',
          logs: pendingLogs,
        }),
        mode: 'no-cors',
      })

      // Clear pending queue on success
      await AsyncStorage.removeItem(PENDING_LOGS_KEY)
      return pendingLogs.length
    } catch (batchError) {
      // Fallback to individual sends
      let successCount = 0
      const failedLogs: ActivityLog[] = []

      for (const log of pendingLogs) {
        const success = await sendToGoogleSheets(log)
        if (success) {
          successCount++
        } else {
          failedLogs.push(log)
        }
      }

      // Update pending queue with failed logs
      if (failedLogs.length > 0) {
        await AsyncStorage.setItem(PENDING_LOGS_KEY, JSON.stringify(failedLogs))
      } else {
        await AsyncStorage.removeItem(PENDING_LOGS_KEY)
      }

      return successCount
    }
  } catch (error) {
    console.error('Failed to sync pending logs:', error)
    return 0
  }
}

/**
 * Get sync status
 */
export async function getSyncStatus(): Promise<{ pending: number; configured: boolean }> {
  try {
    const existingData = await AsyncStorage.getItem(PENDING_LOGS_KEY)
    const pendingLogs: ActivityLog[] = existingData ? JSON.parse(existingData) : []
    return {
      pending: pendingLogs.length,
      configured: isGoogleSheetsConfigured(),
    }
  } catch {
    return { pending: 0, configured: isGoogleSheetsConfigured() }
  }
}

/**
 * Log an activity (fire-and-forget with offline support)
 */
export function logActivity(
  type: ActivityType,
  user: ActivityUser,
  description: string,
  options?: {
    resourceId?: string
    resourceType?: 'document' | 'booking' | 'account' | 'transaction' | 'user'
    metadata?: Record<string, any>
  }
): ActivityLog {
  const log = createActivityLog(type, user, description, options)

  // Fire and forget - save to Google Sheets async
  sendToGoogleSheets(log).then((success) => {
    if (!success) {
      addToPendingQueue(log)
    }
  })

  return log
}

/**
 * Log booking event
 */
export function logBookingEvent(
  type: 'booking:created' | 'booking:updated' | 'booking:deleted' | 'booking:status_changed' | 'booking:card_printed',
  user: ActivityUser,
  booking: ActivityBookingInfo,
  metadata?: Record<string, any>
): ActivityLog {
  const description = generateBookingDescription(type, user, booking, metadata)

  return logActivity(type, user, description, {
    resourceId: booking.id,
    resourceType: 'booking',
    metadata: {
      bookingNumber: booking.bookingNumber,
      guestName: booking.guestName,
      status: booking.status,
      ...metadata,
    },
  })
}

/**
 * Log document event
 */
export function logDocumentEvent(
  type:
    | 'document:created'
    | 'document:updated'
    | 'document:deleted'
    | 'document:status_changed'
    | 'document:approved'
    | 'document:printed'
    | 'document:linked_to_booking'
    | 'document:unlinked_from_booking',
  user: ActivityUser,
  document: ActivityDocumentInfo,
  metadata?: Record<string, any>
): ActivityLog {
  const description = generateDocumentDescription(type, user, document, metadata)

  return logActivity(type, user, description, {
    resourceId: document.id,
    resourceType: 'document',
    metadata: {
      documentNumber: document.documentNumber,
      documentType: document.documentType,
      status: document.status,
      ...metadata,
    },
  })
}

/**
 * Log account event
 */
export function logAccountEvent(
  type: 'account:created' | 'account:updated' | 'account:deleted' | 'account:balance_changed',
  user: ActivityUser,
  account: ActivityAccountInfo,
  metadata?: Record<string, any>
): ActivityLog {
  let description: string

  switch (type) {
    case 'account:created':
      description = `${user.name} created account ${account.name}`
      break
    case 'account:updated':
      description = `${user.name} updated account ${account.name}`
      break
    case 'account:deleted':
      description = `${user.name} deleted account ${account.name}`
      break
    case 'account:balance_changed':
      description = `${user.name} changed balance of ${account.name}`
      break
    default:
      description = `${user.name} performed ${type} on ${account.name}`
  }

  return logActivity(type, user, description, {
    resourceId: account.id,
    resourceType: 'account',
    metadata: {
      accountName: account.name,
      accountType: account.type,
      currency: account.currency,
      ...metadata,
    },
  })
}

/**
 * Log transaction event
 */
export function logTransactionEvent(
  type: 'transaction:applied' | 'transaction:reversed',
  user: ActivityUser,
  transactionData: {
    accountId: string
    accountName: string
    amount: number
    documentId?: string
    documentNumber?: string
    transactionType: 'increase' | 'decrease'
    currency: string
    balanceBefore?: number
    balanceAfter?: number
  }
): ActivityLog {
  const description =
    type === 'transaction:applied'
      ? `${user.name} ${transactionData.transactionType === 'increase' ? 'deposited' : 'withdrew'} ${transactionData.currency} ${transactionData.amount.toLocaleString()} ${transactionData.transactionType === 'increase' ? 'to' : 'from'} ${transactionData.accountName}`
      : `${user.name} reversed transaction on ${transactionData.accountName}`

  return logActivity(type, user, description, {
    resourceId: transactionData.accountId,
    resourceType: 'transaction',
    metadata: transactionData,
  })
}

/**
 * Log authentication event
 */
export function logAuthEvent(
  type:
    | 'auth:login'
    | 'auth:logout'
    | 'auth:login_failed'
    | 'auth:password_changed'
    | 'auth:biometric_enabled'
    | 'auth:biometric_disabled',
  user: ActivityUser | { username: string },
  metadata?: Record<string, any>
): ActivityLog {
  const name = 'name' in user ? user.name : user.username
  const userId = 'id' in user ? user.id : 'unknown'

  let description: string
  switch (type) {
    case 'auth:login':
      description = `${name} logged in`
      break
    case 'auth:logout':
      description = `${name} logged out`
      break
    case 'auth:login_failed':
      description = `Failed login attempt for ${user.username}`
      break
    case 'auth:password_changed':
      description = `${name} changed password`
      break
    case 'auth:biometric_enabled':
      description = `${name} enabled biometric authentication`
      break
    case 'auth:biometric_disabled':
      description = `${name} disabled biometric authentication`
      break
    default:
      description = `${name} performed ${type}`
  }

  return logActivity(
    type,
    { id: userId, username: user.username, name },
    description,
    {
      resourceType: 'user',
      resourceId: userId,
      metadata,
    }
  )
}

/**
 * Fetch activity logs from Google Sheets
 */
export async function getActivityLogs(
  filter?: ActivityLogFilter
): Promise<ActivityLog[]> {
  if (!isGoogleSheetsConfigured()) {
    return []
  }

  try {
    // Build query params
    const params = new URLSearchParams({ action: 'fetch' })
    if (filter?.type) params.append('type', filter.type)
    if (filter?.userId) params.append('userId', filter.userId)
    if (filter?.resourceType) params.append('resourceType', filter.resourceType)
    if (filter?.startDate) params.append('startDate', filter.startDate)
    if (filter?.endDate) params.append('endDate', filter.endDate)
    if (filter?.limit) params.append('limit', filter.limit.toString())

    const response = await fetch(`${GOOGLE_SHEETS_URL}?${params.toString()}`)
    const data = await response.json()

    if (data.success && data.logs) {
      return data.logs
    }

    return []
  } catch (error) {
    console.error('Error fetching activity logs:', error)
    return []
  }
}

/**
 * Get recent activity logs
 */
export async function getRecentActivity(limit: number = 20): Promise<ActivityLog[]> {
  return getActivityLogs({ limit })
}

/**
 * Get activity logs for a specific resource
 */
export async function getResourceActivity(
  resourceType: 'document' | 'booking' | 'account',
  resourceId: string,
  limit: number = 50
): Promise<ActivityLog[]> {
  return getActivityLogs({
    resourceType,
    resourceId,
    limit,
  })
}

/**
 * Initialize activity log service
 * Call this on app startup to sync any pending logs
 */
export async function initActivityLogService(): Promise<void> {
  if (isGoogleSheetsConfigured()) {
    try {
      const synced = await syncPendingLogs()
      if (synced > 0) {
        console.log(`Synced ${synced} pending activity logs to Google Sheets`)
      }
    } catch (error) {
      console.error('Failed to initialize activity log service:', error)
    }
  } else {
    console.log('Activity logging: Google Sheets not configured')
  }
}
