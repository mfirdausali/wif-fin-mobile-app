/**
 * Activity Log Types
 *
 * Defines types for activity logging throughout the app.
 * Matches web app's activity logging implementation.
 */

// Activity types - all possible activities that can be logged
export type ActivityType =
  // Authentication activities
  | 'auth:login'
  | 'auth:logout'
  | 'auth:login_failed'
  | 'auth:password_changed'
  | 'auth:biometric_enabled'
  | 'auth:biometric_disabled'

  // Document activities
  | 'document:created'
  | 'document:updated'
  | 'document:deleted'
  | 'document:status_changed'
  | 'document:approved'
  | 'document:printed'
  | 'document:linked_to_booking'
  | 'document:unlinked_from_booking'

  // Booking activities
  | 'booking:created'
  | 'booking:updated'
  | 'booking:deleted'
  | 'booking:status_changed'
  | 'booking:card_printed'

  // Account activities
  | 'account:created'
  | 'account:updated'
  | 'account:deleted'
  | 'account:balance_changed'

  // Transaction activities
  | 'transaction:applied'
  | 'transaction:reversed'

  // System activities
  | 'system:settings_changed'
  | 'system:data_exported'

/**
 * Activity log entry
 */
export interface ActivityLog {
  id: string
  type: ActivityType
  userId: string
  username: string
  description: string
  resourceId?: string
  resourceType?: 'document' | 'booking' | 'account' | 'transaction' | 'user'
  metadata?: Record<string, any>
  timestamp: string
}

/**
 * User info for logging (minimal info needed)
 */
export interface ActivityUser {
  id: string
  username: string
  name: string
}

/**
 * Booking info for logging
 */
export interface ActivityBookingInfo {
  id: string
  bookingNumber: string
  guestName: string
  status?: string
}

/**
 * Document info for logging
 */
export interface ActivityDocumentInfo {
  id: string
  documentNumber: string
  documentType: string
  status?: string
}

/**
 * Account info for logging
 */
export interface ActivityAccountInfo {
  id: string
  name: string
  type: string
  currency: string
}

/**
 * Filter options for querying activity logs
 */
export interface ActivityLogFilter {
  userId?: string
  type?: ActivityType
  resourceType?: string
  resourceId?: string
  startDate?: string
  endDate?: string
  limit?: number
  offset?: number
}

/**
 * Human-readable labels for activity types
 */
export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  'auth:login': 'User Login',
  'auth:logout': 'User Logout',
  'auth:login_failed': 'Login Failed',
  'auth:password_changed': 'Password Changed',
  'auth:biometric_enabled': 'Biometric Enabled',
  'auth:biometric_disabled': 'Biometric Disabled',

  'document:created': 'Document Created',
  'document:updated': 'Document Updated',
  'document:deleted': 'Document Deleted',
  'document:status_changed': 'Document Status Changed',
  'document:approved': 'Document Approved',
  'document:printed': 'Document Printed',
  'document:linked_to_booking': 'Document Linked to Booking',
  'document:unlinked_from_booking': 'Document Unlinked from Booking',

  'booking:created': 'Booking Created',
  'booking:updated': 'Booking Updated',
  'booking:deleted': 'Booking Deleted',
  'booking:status_changed': 'Booking Status Changed',
  'booking:card_printed': 'Booking Card Printed',

  'account:created': 'Account Created',
  'account:updated': 'Account Updated',
  'account:deleted': 'Account Deleted',
  'account:balance_changed': 'Account Balance Changed',

  'transaction:applied': 'Transaction Applied',
  'transaction:reversed': 'Transaction Reversed',

  'system:settings_changed': 'Settings Changed',
  'system:data_exported': 'Data Exported',
}

/**
 * Generate description for booking activities
 */
export function generateBookingDescription(
  type: ActivityType,
  user: ActivityUser,
  booking: ActivityBookingInfo,
  metadata?: Record<string, any>
): string {
  switch (type) {
    case 'booking:created':
      return `${user.name} created booking ${booking.bookingNumber} for ${booking.guestName}`
    case 'booking:updated':
      return `${user.name} updated booking ${booking.bookingNumber}`
    case 'booking:deleted':
      return `${user.name} deleted booking ${booking.bookingNumber}`
    case 'booking:status_changed':
      return `${user.name} changed booking ${booking.bookingNumber} status from ${metadata?.previousStatus || 'unknown'} to ${metadata?.newStatus || booking.status}`
    case 'booking:card_printed':
      return `${user.name} printed booking card for ${booking.bookingNumber}`
    default:
      return `${user.name} performed ${type} on booking ${booking.bookingNumber}`
  }
}

/**
 * Generate description for document activities
 */
export function generateDocumentDescription(
  type: ActivityType,
  user: ActivityUser,
  document: ActivityDocumentInfo,
  metadata?: Record<string, any>
): string {
  switch (type) {
    case 'document:created':
      return `${user.name} created ${document.documentType} ${document.documentNumber}`
    case 'document:updated':
      return `${user.name} updated ${document.documentType} ${document.documentNumber}`
    case 'document:deleted':
      return `${user.name} deleted ${document.documentType} ${document.documentNumber}`
    case 'document:status_changed':
      return `${user.name} changed ${document.documentNumber} status to ${metadata?.newStatus || document.status}`
    case 'document:approved':
      return `${user.name} approved ${document.documentType} ${document.documentNumber}`
    case 'document:printed':
      return `${user.name} printed ${document.documentType} ${document.documentNumber}`
    case 'document:linked_to_booking':
      return `${user.name} linked ${document.documentNumber} to booking ${metadata?.bookingNumber || ''}`
    case 'document:unlinked_from_booking':
      return `${user.name} unlinked ${document.documentNumber} from booking`
    default:
      return `${user.name} performed ${type} on ${document.documentNumber}`
  }
}
