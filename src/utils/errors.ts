/**
 * Custom error types for WIF Finance
 * Provides structured error handling with codes, messages, and details
 */

// ============================================================================
// BASE ERROR CLASS
// ============================================================================

/**
 * Base error class for all WIF Finance errors
 * Extends native Error with error codes and optional details
 */
export class WIFError extends Error {
  code: string
  details?: Record<string, any>

  constructor(code: string, message: string, details?: Record<string, any>) {
    super(message)
    this.name = 'WIFError'
    this.code = code
    this.details = details

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

// ============================================================================
// SPECIFIC ERROR TYPES
// ============================================================================

/**
 * Validation error - thrown when input data is invalid
 * Example: Missing required fields, invalid format, out of range values
 */
export class ValidationError extends WIFError {
  constructor(message: string, details?: Record<string, any>) {
    super(ErrorCodes.VALIDATION_FAILED, message, details)
    this.name = 'ValidationError'
  }
}

/**
 * Network error - thrown when network operations fail
 * Example: Connection timeout, no internet, server unreachable
 */
export class NetworkError extends WIFError {
  constructor(message: string, details?: Record<string, any>) {
    super(ErrorCodes.NETWORK_ERROR, message, details)
    this.name = 'NetworkError'
  }
}

/**
 * Conflict error - thrown when optimistic locking fails
 * Example: Document was modified by another user, version mismatch
 */
export class ConflictError extends WIFError {
  constructor(message: string, details?: Record<string, any>) {
    super(ErrorCodes.CONFLICT, message, details)
    this.name = 'ConflictError'
  }
}

/**
 * Not found error - thrown when a resource doesn't exist
 * Example: Document not found, Booking not found
 */
export class NotFoundError extends WIFError {
  constructor(message: string, details?: Record<string, any>) {
    super(ErrorCodes.NOT_FOUND, message, details)
    this.name = 'NotFoundError'
  }
}

/**
 * Permission error - thrown when user lacks required permissions
 * Example: Trying to delete without delete permission, editing completed document
 */
export class PermissionError extends WIFError {
  constructor(message: string, details?: Record<string, any>) {
    super(ErrorCodes.PERMISSION_DENIED, message, details)
    this.name = 'PermissionError'
  }
}

/**
 * Insufficient balance error - thrown when account balance is too low
 * Example: Cannot create payment when account balance is insufficient
 */
export class InsufficientBalanceError extends WIFError {
  constructor(message: string, details?: Record<string, any>) {
    super(ErrorCodes.INSUFFICIENT_BALANCE, message, details)
    this.name = 'InsufficientBalanceError'
  }
}

/**
 * Invalid status transition error - thrown when status change is not allowed
 * Example: Trying to change from 'completed' to 'draft'
 */
export class InvalidStatusTransitionError extends WIFError {
  constructor(message: string, details?: Record<string, any>) {
    super(ErrorCodes.INVALID_STATUS_TRANSITION, message, details)
    this.name = 'InvalidStatusTransitionError'
  }
}

// ============================================================================
// ERROR CODES
// ============================================================================

/**
 * Standardized error codes for the application
 * Use these codes for error tracking, logging, and analytics
 */
export const ErrorCodes = {
  // Validation errors
  VALIDATION_FAILED: 'VALIDATION_FAILED',

  // Network errors
  NETWORK_ERROR: 'NETWORK_ERROR',

  // Conflict errors
  CONFLICT: 'CONFLICT',

  // Resource errors
  NOT_FOUND: 'NOT_FOUND',

  // Permission errors
  PERMISSION_DENIED: 'PERMISSION_DENIED',

  // Business logic errors
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  INVALID_STATUS_TRANSITION: 'INVALID_STATUS_TRANSITION',

  // Database errors
  DATABASE_ERROR: 'DATABASE_ERROR',
  CONSTRAINT_VIOLATION: 'CONSTRAINT_VIOLATION',

  // Unknown errors
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const

// ============================================================================
// SUPABASE ERROR CONVERTER
// ============================================================================

/**
 * Convert Supabase/PostgreSQL errors to WIFError
 * Provides better error messages and typed errors for common database issues
 */
export function fromSupabaseError(error: any): WIFError {
  // Handle null/undefined
  if (!error) {
    return new WIFError(ErrorCodes.UNKNOWN_ERROR, 'An unknown error occurred')
  }

  const errorMessage = error.message || 'Database operation failed'
  const errorCode = error.code || ''
  const errorDetails = error.details || ''

  // PostgreSQL error codes
  // See: https://www.postgresql.org/docs/current/errcodes-appendix.html

  // Not found errors (PGRST116 is PostgREST code for no rows returned)
  if (errorCode === 'PGRST116') {
    return new NotFoundError('Resource not found', { originalError: error })
  }

  // Unique constraint violation (23505)
  if (errorCode === '23505') {
    return new ConflictError('A record with this information already exists', {
      constraint: errorDetails,
      originalError: error,
    })
  }

  // Foreign key constraint violation (23503)
  if (errorCode === '23503') {
    return new ValidationError('Referenced record does not exist', {
      constraint: errorDetails,
      originalError: error,
    })
  }

  // Not null constraint violation (23502)
  if (errorCode === '23502') {
    return new ValidationError('Required field is missing', {
      constraint: errorDetails,
      originalError: error,
    })
  }

  // Check constraint violation (23514)
  if (errorCode === '23514') {
    return new ValidationError('Data validation failed', {
      constraint: errorDetails,
      originalError: error,
    })
  }

  // Permission denied (42501)
  if (errorCode === '42501') {
    return new PermissionError('You do not have permission to perform this action', {
      originalError: error,
    })
  }

  // Network/connection errors
  if (errorMessage.toLowerCase().includes('network') ||
      errorMessage.toLowerCase().includes('connection') ||
      errorMessage.toLowerCase().includes('timeout')) {
    return new NetworkError(errorMessage, { originalError: error })
  }

  // Optimistic locking / version mismatch
  if (errorMessage.toLowerCase().includes('version') ||
      errorMessage.toLowerCase().includes('conflict')) {
    return new ConflictError(errorMessage, { originalError: error })
  }

  // Default: wrap as database error
  return new WIFError(ErrorCodes.DATABASE_ERROR, errorMessage, {
    code: errorCode,
    details: errorDetails,
    originalError: error,
  })
}

// ============================================================================
// USER-FRIENDLY MESSAGES
// ============================================================================

/**
 * Convert WIFError to user-friendly message
 * Hides technical details and provides actionable guidance
 */
export function getUserFriendlyMessage(error: WIFError): string {
  switch (error.code) {
    case ErrorCodes.VALIDATION_FAILED:
      return 'Please check your input and try again. Some required fields may be missing or invalid.'

    case ErrorCodes.NETWORK_ERROR:
      return 'Unable to connect to the server. Please check your internet connection and try again.'

    case ErrorCodes.CONFLICT:
      return 'This record was recently modified by someone else. Please refresh and try again.'

    case ErrorCodes.NOT_FOUND:
      return 'The requested item could not be found. It may have been deleted or moved.'

    case ErrorCodes.PERMISSION_DENIED:
      return 'You do not have permission to perform this action. Please contact your administrator.'

    case ErrorCodes.INSUFFICIENT_BALANCE:
      return 'Insufficient balance to complete this transaction.'

    case ErrorCodes.INVALID_STATUS_TRANSITION:
      return 'This status change is not allowed. Please check the current status and try again.'

    case ErrorCodes.DATABASE_ERROR:
      return 'A database error occurred. Please try again or contact support if the problem persists.'

    case ErrorCodes.CONSTRAINT_VIOLATION:
      return 'This action would violate data integrity rules. Please check your input and try again.'

    case ErrorCodes.UNKNOWN_ERROR:
    default:
      return 'An unexpected error occurred. Please try again or contact support if the problem persists.'
  }
}

// ============================================================================
// ERROR UTILITIES
// ============================================================================

/**
 * Check if error is a WIFError
 */
export function isWIFError(error: any): error is WIFError {
  return error instanceof WIFError
}

/**
 * Check if error is a specific type
 */
export function isErrorType<T extends WIFError>(
  error: any,
  errorClass: new (...args: any[]) => T
): error is T {
  return error instanceof errorClass
}

/**
 * Extract error message safely from any error type
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof WIFError) {
    return error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  return 'An unknown error occurred'
}

/**
 * Log error with context (useful for debugging)
 */
export function logError(error: unknown, context?: string): void {
  const contextStr = context ? `[${context}]` : ''

  if (error instanceof WIFError) {
    console.error(`${contextStr} WIFError [${error.code}]:`, error.message, error.details)
  } else if (error instanceof Error) {
    console.error(`${contextStr} Error:`, error.message, error)
  } else {
    console.error(`${contextStr} Unknown error:`, error)
  }
}
