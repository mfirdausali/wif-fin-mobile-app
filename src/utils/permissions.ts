/**
 * Permission utilities for document operations
 * Matches the web app permission logic
 */

import type { Document, DocumentStatus } from '../types'
import type { User, UserRole, Permission } from '../store/authStore'

// Role permissions matrix (must match authStore)
const rolePermissions: Record<UserRole, Permission[]> = {
  viewer: [
    'view_documents',
    'print_documents',
    'view_bookings',
    'print_bookings',
  ],
  accountant: [
    'view_documents',
    'create_documents',
    'edit_documents',
    'print_documents',
    'manage_accounts',
    'view_bookings',
    'create_bookings',
    'edit_bookings',
    'print_bookings',
  ],
  manager: [
    'view_documents',
    'create_documents',
    'edit_documents',
    'delete_documents',
    'approve_documents',
    'print_documents',
    'manage_accounts',
    'view_bookings',
    'create_bookings',
    'edit_bookings',
    'delete_bookings',
    'print_bookings',
  ],
  admin: [
    'view_documents',
    'create_documents',
    'edit_documents',
    'delete_documents',
    'approve_documents',
    'print_documents',
    'manage_accounts',
    'manage_users',
    'view_audit_logs',
    'manage_settings',
    'view_bookings',
    'create_bookings',
    'edit_bookings',
    'delete_bookings',
    'print_bookings',
  ],
  // Operations: Limited to Payment Vouchers and Bookings only
  operations: [
    'view_documents',     // Limited to PV only (enforced in UI)
    'create_documents',   // Limited to PV only (enforced in UI)
    'edit_documents',     // Limited to PV only (enforced in UI)
    'print_documents',
    'view_bookings',
    'create_bookings',
    'edit_bookings',
    'print_bookings',
  ],
}

/**
 * Check if user has a specific permission
 */
export function hasPermission(user: User | null, permission: Permission): boolean {
  if (!user) return false
  const permissions = rolePermissions[user.role] || []
  return permissions.includes(permission)
}

/**
 * Check if user can edit a specific document
 * Matches web app logic from utils/permissions.ts
 */
export function canEditDocument(user: User | null, document: Document): boolean {
  // Must have edit permission
  if (!hasPermission(user, 'edit_documents')) {
    return false
  }

  if (!user) return false

  // Operations users can only edit payment vouchers
  if (user.role === 'operations' && document.documentType !== 'payment_voucher') {
    return false
  }

  // Admins can edit any document including completed/cancelled
  if (user.role === 'admin') {
    return true
  }

  // Non-admins cannot edit completed or cancelled documents
  if (document.status === 'completed' || document.status === 'cancelled') {
    return false
  }

  // Accountants can only edit their own draft documents
  if (user.role === 'accountant') {
    return document.status === 'draft'
  }

  // Managers can edit any non-completed document
  return true
}

/**
 * Check if user can delete a specific document
 */
export function canDeleteDocument(user: User | null, document: Document): boolean {
  // Must have delete permission
  if (!hasPermission(user, 'delete_documents')) {
    return false
  }

  if (!user) return false

  // Operations users cannot delete any documents (no delete permission)
  if (user.role === 'operations') {
    return false
  }

  // Admins can delete any document
  if (user.role === 'admin') {
    return true
  }

  // Non-admins cannot delete completed documents
  if (document.status === 'completed') {
    return false
  }

  return true
}

/**
 * Check if user can print/share documents
 */
export function canPrintDocuments(user: User | null): boolean {
  return hasPermission(user, 'print_documents')
}

/**
 * Check if user can create documents
 */
export function canCreateDocuments(user: User | null): boolean {
  return hasPermission(user, 'create_documents')
}

/**
 * Check if user can create a specific document type
 * Operations users can only create payment_voucher
 */
export function canCreateDocumentType(user: User | null, documentType: string): boolean {
  if (!hasPermission(user, 'create_documents')) {
    return false
  }

  if (!user) return false

  // Operations users can only create payment vouchers
  if (user.role === 'operations') {
    return documentType === 'payment_voucher'
  }

  return true
}

/**
 * Check if user can approve documents (payment vouchers)
 */
export function canApproveDocuments(user: User | null): boolean {
  return hasPermission(user, 'approve_documents')
}

/**
 * Get edit restriction message for UI
 */
export function getEditRestrictionMessage(user: User | null, document: Document): string | null {
  if (!user) {
    return 'You must be logged in to edit documents'
  }

  if (!hasPermission(user, 'edit_documents')) {
    return 'You do not have permission to edit documents'
  }

  if (user.role !== 'admin') {
    if (document.status === 'completed') {
      return 'Completed documents cannot be edited'
    }
    if (document.status === 'cancelled') {
      return 'Cancelled documents cannot be edited'
    }
  }

  if (user.role === 'accountant' && document.status !== 'draft') {
    return 'Accountants can only edit draft documents'
  }

  return null
}

/**
 * Check if user is an operations role user
 */
export function isOperationsUser(user: User | null): boolean {
  return user?.role === 'operations'
}

/**
 * Check if user can access bookings
 */
export function canAccessBookings(user: User | null): boolean {
  return hasPermission(user, 'view_bookings')
}

/**
 * Check if user can access accounts/ledger
 */
export function canAccessAccounts(user: User | null): boolean {
  if (!user) return false
  // Operations users cannot access accounts/ledger
  if (user.role === 'operations') return false
  return true
}

/**
 * Get document types accessible by the user
 * Operations users can only access payment_voucher
 */
export function getAccessibleDocumentTypes(user: User | null): string[] {
  if (!user) return []
  if (user.role === 'operations') {
    return ['payment_voucher']
  }
  return ['invoice', 'receipt', 'payment_voucher', 'statement_of_payment']
}
