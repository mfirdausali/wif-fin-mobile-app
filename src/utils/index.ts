/**
 * WIF Finance Utility Functions
 *
 * Re-exports all utility modules for convenient imports
 * Usage: import { NotFoundError, safeParseNumber, validateInvoice } from '@/utils'
 */

// Error handling utilities
export {
  WIFError,
  ValidationError,
  NetworkError,
  ConflictError,
  NotFoundError,
  PermissionError,
  InsufficientBalanceError,
  InvalidStatusTransitionError,
  ErrorCodes,
  fromSupabaseError,
  getUserFriendlyMessage,
  isWIFError,
  isErrorType,
  getErrorMessage,
  logError,
} from './errors'

// Validation utilities
export {
  type ValidationResult,
  isValidUUID,
  isValidEmail,
  isValidDate,
  isPositiveNumber,
  isNonEmptyString,
  validateInvoice,
  validateReceipt,
  validatePaymentVoucher,
  validateStatementOfPayment,
  validateBooking,
  validateBookingCostItem,
} from './validation'

// Number utilities
export {
  safeParseNumber,
  safeParseDecimal,
  formatCurrency,
  parsePaxString,
  calculatePercentage,
  safeAdd,
  safeMultiply,
  safeDivide,
  clamp,
  isInRange,
} from './numbers'

// Null safety utilities
export {
  nullSafe,
  nullSafeArray,
  nullSafeObject,
  nullSafeString,
  getNestedValue,
  setNestedValue,
  filterNullish,
  coalesce,
  nullSafeMap,
  nullSafeFilter,
  nullSafeReduce,
  isNullish,
  isDefined,
  firstOrDefault,
  lastOrDefault,
} from './nullSafe'

// Retry utilities
export {
  type RetryOptions,
  withRetry,
  withAggressiveRetry,
  withQuickRetry,
  createRetryWithCodes,
  withRetryAndTimeout,
} from './retry'
