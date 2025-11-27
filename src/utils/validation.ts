/**
 * Validation Utilities
 *
 * Type-safe validation helpers for WIF Finance
 * Handles edge cases: null, undefined, empty strings, invalid formats
 */

import {
  Invoice,
  Receipt,
  PaymentVoucher,
  StatementOfPayment,
  LineItem,
} from '../types/document'
import {
  Booking,
  BookingCostItem,
} from '../types/booking'

/**
 * Validation result interface
 */
export interface ValidationResult {
  valid: boolean
  errors: Array<{ field: string; message: string }>
}

/**
 * Field error helper
 */
function createError(field: string, message: string) {
  return { field, message }
}

/**
 * Check if a value is a valid UUID (v4 format)
 *
 * @example
 * isValidUUID('550e8400-e29b-41d4-a716-446655440000') // true
 * isValidUUID('invalid') // false
 * isValidUUID('') // false
 * isValidUUID(null) // false
 */
export function isValidUUID(value: string): boolean {
  if (!value || typeof value !== 'string') {
    return false
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(value)
}

/**
 * Check if a value is a valid email address
 *
 * @example
 * isValidEmail('user@example.com') // true
 * isValidEmail('invalid.email') // false
 * isValidEmail('') // false
 * isValidEmail(null) // false
 */
export function isValidEmail(value: string): boolean {
  if (!value || typeof value !== 'string') {
    return false
  }

  // RFC 5322 simplified email regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(value.trim())
}

/**
 * Check if a value is a valid ISO date string
 *
 * @example
 * isValidDate('2025-11-27') // true
 * isValidDate('2025-11-27T10:30:00Z') // true
 * isValidDate('invalid') // false
 * isValidDate('') // false
 * isValidDate(null) // false
 */
export function isValidDate(value: string): boolean {
  if (!value || typeof value !== 'string') {
    return false
  }

  const date = new Date(value)
  return date instanceof Date && !isNaN(date.getTime())
}

/**
 * Check if a value is a positive number (> 0)
 *
 * @example
 * isPositiveNumber(10) // true
 * isPositiveNumber(0) // false
 * isPositiveNumber(-5) // false
 * isPositiveNumber(NaN) // false
 * isPositiveNumber(Infinity) // false
 */
export function isPositiveNumber(value: number): boolean {
  return typeof value === 'number' && !isNaN(value) && isFinite(value) && value > 0
}

/**
 * Check if a value is a non-empty string
 *
 * @example
 * isNonEmptyString('hello') // true
 * isNonEmptyString('   ') // false (whitespace only)
 * isNonEmptyString('') // false
 * isNonEmptyString(null) // false
 * isNonEmptyString(undefined) // false
 */
export function isNonEmptyString(value: string): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

/**
 * Validate line items array
 */
function validateLineItems(items: LineItem[] | undefined, fieldPrefix: string): Array<{ field: string; message: string }> {
  const errors: Array<{ field: string; message: string }> = []

  if (!items || !Array.isArray(items)) {
    errors.push(createError(`${fieldPrefix}.items`, 'Items array is required'))
    return errors
  }

  if (items.length === 0) {
    errors.push(createError(`${fieldPrefix}.items`, 'At least one item is required'))
    return errors
  }

  items.forEach((item, index) => {
    if (!item.id || !isNonEmptyString(item.id)) {
      errors.push(createError(`${fieldPrefix}.items[${index}].id`, 'Item ID is required'))
    }
    if (!item.description || !isNonEmptyString(item.description)) {
      errors.push(createError(`${fieldPrefix}.items[${index}].description`, 'Item description is required'))
    }
    if (!isPositiveNumber(item.quantity)) {
      errors.push(createError(`${fieldPrefix}.items[${index}].quantity`, 'Item quantity must be positive'))
    }
    if (typeof item.unitPrice !== 'number' || isNaN(item.unitPrice)) {
      errors.push(createError(`${fieldPrefix}.items[${index}].unitPrice`, 'Item unit price must be a valid number'))
    }
    if (typeof item.amount !== 'number' || isNaN(item.amount)) {
      errors.push(createError(`${fieldPrefix}.items[${index}].amount`, 'Item amount must be a valid number'))
    }
  })

  return errors
}

/**
 * Validate Invoice document
 *
 * @example
 * const result = validateInvoice({
 *   customerName: 'John Doe',
 *   invoiceDate: '2025-11-27',
 *   dueDate: '2025-12-27',
 *   items: [...]
 * })
 * if (!result.valid) {
 *   console.error('Validation errors:', result.errors)
 * }
 */
export function validateInvoice(data: Partial<Invoice>): ValidationResult {
  const errors: Array<{ field: string; message: string }> = []

  // Required string fields
  if (!data.customerName || !isNonEmptyString(data.customerName)) {
    errors.push(createError('customerName', 'Customer name is required'))
  }

  // Date fields
  if (!data.invoiceDate || !isValidDate(data.invoiceDate)) {
    errors.push(createError('invoiceDate', 'Valid invoice date is required'))
  }
  if (!data.dueDate || !isValidDate(data.dueDate)) {
    errors.push(createError('dueDate', 'Valid due date is required'))
  }

  // Optional email validation
  if (data.customerEmail && !isValidEmail(data.customerEmail)) {
    errors.push(createError('customerEmail', 'Invalid email format'))
  }

  // Line items validation
  errors.push(...validateLineItems(data.items, 'invoice'))

  // Numeric fields
  if (data.subtotal !== undefined && (typeof data.subtotal !== 'number' || isNaN(data.subtotal))) {
    errors.push(createError('subtotal', 'Subtotal must be a valid number'))
  }
  if (data.total !== undefined && (typeof data.total !== 'number' || isNaN(data.total))) {
    errors.push(createError('total', 'Total must be a valid number'))
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Validate Receipt document
 *
 * @example
 * const result = validateReceipt({
 *   payerName: 'Jane Smith',
 *   receiptDate: '2025-11-27',
 *   paymentMethod: 'Bank Transfer',
 *   receivedBy: 'Admin User'
 * })
 */
export function validateReceipt(data: Partial<Receipt>): ValidationResult {
  const errors: Array<{ field: string; message: string }> = []

  // Required string fields
  if (!data.payerName || !isNonEmptyString(data.payerName)) {
    errors.push(createError('payerName', 'Payer name is required'))
  }
  if (!data.receivedBy || !isNonEmptyString(data.receivedBy)) {
    errors.push(createError('receivedBy', 'Received by field is required'))
  }
  if (!data.paymentMethod || !isNonEmptyString(data.paymentMethod)) {
    errors.push(createError('paymentMethod', 'Payment method is required'))
  }

  // Date field
  if (!data.receiptDate || !isValidDate(data.receiptDate)) {
    errors.push(createError('receiptDate', 'Valid receipt date is required'))
  }

  // Optional UUID validation
  if (data.linkedInvoiceId && !isValidUUID(data.linkedInvoiceId)) {
    errors.push(createError('linkedInvoiceId', 'Invalid linked invoice ID format'))
  }

  // Amount validation
  if (data.amount !== undefined && (typeof data.amount !== 'number' || isNaN(data.amount) || data.amount <= 0)) {
    errors.push(createError('amount', 'Amount must be a positive number'))
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Validate Payment Voucher document
 *
 * @example
 * const result = validatePaymentVoucher({
 *   payeeName: 'Supplier Inc.',
 *   voucherDate: '2025-11-27',
 *   requestedBy: 'Manager',
 *   items: [...]
 * })
 */
export function validatePaymentVoucher(data: Partial<PaymentVoucher>): ValidationResult {
  const errors: Array<{ field: string; message: string }> = []

  // Required string fields
  if (!data.payeeName || !isNonEmptyString(data.payeeName)) {
    errors.push(createError('payeeName', 'Payee name is required'))
  }
  if (!data.requestedBy || !isNonEmptyString(data.requestedBy)) {
    errors.push(createError('requestedBy', 'Requested by field is required'))
  }

  // Date field
  if (!data.voucherDate || !isValidDate(data.voucherDate)) {
    errors.push(createError('voucherDate', 'Valid voucher date is required'))
  }

  // Optional date validation
  if (data.paymentDueDate && !isValidDate(data.paymentDueDate)) {
    errors.push(createError('paymentDueDate', 'Invalid payment due date'))
  }
  if (data.approvalDate && !isValidDate(data.approvalDate)) {
    errors.push(createError('approvalDate', 'Invalid approval date'))
  }

  // Line items validation
  errors.push(...validateLineItems(data.items, 'paymentVoucher'))

  // Numeric fields
  if (data.subtotal !== undefined && (typeof data.subtotal !== 'number' || isNaN(data.subtotal))) {
    errors.push(createError('subtotal', 'Subtotal must be a valid number'))
  }
  if (data.total !== undefined && (typeof data.total !== 'number' || isNaN(data.total))) {
    errors.push(createError('total', 'Total must be a valid number'))
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Validate Statement of Payment document
 *
 * @example
 * const result = validateStatementOfPayment({
 *   linkedVoucherId: '550e8400-e29b-41d4-a716-446655440000',
 *   linkedVoucherNumber: 'PV-2025-001',
 *   paymentDate: '2025-11-27',
 *   paymentMethod: 'Wire Transfer',
 *   transactionReference: 'TXN123456',
 *   confirmedBy: 'Finance Officer',
 *   payeeName: 'Supplier Inc.',
 *   items: [...]
 * })
 */
export function validateStatementOfPayment(data: Partial<StatementOfPayment>): ValidationResult {
  const errors: Array<{ field: string; message: string }> = []

  // Required string fields
  if (!data.linkedVoucherId || !isValidUUID(data.linkedVoucherId)) {
    errors.push(createError('linkedVoucherId', 'Valid linked voucher ID is required'))
  }
  if (!data.linkedVoucherNumber || !isNonEmptyString(data.linkedVoucherNumber)) {
    errors.push(createError('linkedVoucherNumber', 'Linked voucher number is required'))
  }
  if (!data.payeeName || !isNonEmptyString(data.payeeName)) {
    errors.push(createError('payeeName', 'Payee name is required'))
  }
  if (!data.confirmedBy || !isNonEmptyString(data.confirmedBy)) {
    errors.push(createError('confirmedBy', 'Confirmed by field is required'))
  }
  if (!data.paymentMethod || !isNonEmptyString(data.paymentMethod)) {
    errors.push(createError('paymentMethod', 'Payment method is required'))
  }
  if (!data.transactionReference || !isNonEmptyString(data.transactionReference)) {
    errors.push(createError('transactionReference', 'Transaction reference is required'))
  }

  // Date field
  if (!data.paymentDate || !isValidDate(data.paymentDate)) {
    errors.push(createError('paymentDate', 'Valid payment date is required'))
  }

  // Line items validation
  errors.push(...validateLineItems(data.items, 'statementOfPayment'))

  // Numeric fields
  if (data.subtotal !== undefined && (typeof data.subtotal !== 'number' || isNaN(data.subtotal))) {
    errors.push(createError('subtotal', 'Subtotal must be a valid number'))
  }
  if (data.total !== undefined && (typeof data.total !== 'number' || isNaN(data.total))) {
    errors.push(createError('total', 'Total must be a valid number'))
  }
  if (data.totalDeducted !== undefined && (typeof data.totalDeducted !== 'number' || isNaN(data.totalDeducted))) {
    errors.push(createError('totalDeducted', 'Total deducted must be a valid number'))
  }
  if (data.transactionFee !== undefined && (typeof data.transactionFee !== 'number' || isNaN(data.transactionFee))) {
    errors.push(createError('transactionFee', 'Transaction fee must be a valid number'))
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Validate Booking document
 *
 * @example
 * const result = validateBooking({
 *   bookingNumber: 'BK-2025-001',
 *   guestName: 'Japan Winter Tour - Travel Group A',
 *   startDate: '2025-12-01',
 *   endDate: '2025-12-10',
 *   pax: 10,
 *   currency: 'JPY'
 * })
 */
export function validateBooking(data: Partial<Booking>): ValidationResult {
  const errors: Array<{ field: string; message: string }> = []

  // Required string fields
  if (!data.bookingNumber || !isNonEmptyString(data.bookingNumber)) {
    errors.push(createError('bookingNumber', 'Booking number is required'))
  }
  if (!data.guestName || !isNonEmptyString(data.guestName)) {
    errors.push(createError('guestName', 'Guest name is required'))
  }

  // Date fields
  if (!data.startDate || !isValidDate(data.startDate)) {
    errors.push(createError('startDate', 'Valid start date is required'))
  }
  if (!data.endDate || !isValidDate(data.endDate)) {
    errors.push(createError('endDate', 'Valid end date is required'))
  }

  // Date range validation
  if (data.startDate && data.endDate && isValidDate(data.startDate) && isValidDate(data.endDate)) {
    const start = new Date(data.startDate)
    const end = new Date(data.endDate)
    if (end < start) {
      errors.push(createError('endDate', 'End date must be after start date'))
    }
  }

  // Pax validation
  if (!data.pax || !isPositiveNumber(data.pax) || !Number.isInteger(data.pax)) {
    errors.push(createError('pax', 'Number of participants must be a positive integer'))
  }

  // Currency validation
  if (!data.currency || (data.currency !== 'MYR' && data.currency !== 'JPY')) {
    errors.push(createError('currency', 'Currency must be MYR or JPY'))
  }

  // Exchange rate validation (if provided)
  if (data.exchangeRate !== undefined && !isPositiveNumber(data.exchangeRate)) {
    errors.push(createError('exchangeRate', 'Exchange rate must be a positive number'))
  }

  // Optional UUID validation
  if (data.linkedDocumentId && !isValidUUID(data.linkedDocumentId)) {
    errors.push(createError('linkedDocumentId', 'Invalid linked document ID format'))
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Validate Booking Cost Item
 *
 * @example
 * const result = validateBookingCostItem({
 *   id: 'item-123',
 *   description: 'Hotel accommodation',
 *   quantity: 5,
 *   internalPrice: 10000,
 *   b2bPrice: 12000
 * })
 */
export function validateBookingCostItem(item: Partial<BookingCostItem>): ValidationResult {
  const errors: Array<{ field: string; message: string }> = []

  // ID validation
  if (!item.id || !isNonEmptyString(item.id)) {
    errors.push(createError('id', 'Item ID is required'))
  }

  // Description validation
  if (!item.description || !isNonEmptyString(item.description)) {
    errors.push(createError('description', 'Item description is required'))
  }

  // Quantity validation
  if (!item.quantity || !isPositiveNumber(item.quantity)) {
    errors.push(createError('quantity', 'Quantity must be a positive number'))
  }

  // Price validations
  if (item.internalPrice === undefined || typeof item.internalPrice !== 'number' || isNaN(item.internalPrice)) {
    errors.push(createError('internalPrice', 'Internal price must be a valid number'))
  }
  if (item.b2bPrice === undefined || typeof item.b2bPrice !== 'number' || isNaN(item.b2bPrice)) {
    errors.push(createError('b2bPrice', 'B2B price must be a valid number'))
  }

  // Business logic validation
  if (
    item.internalPrice !== undefined &&
    item.b2bPrice !== undefined &&
    !isNaN(item.internalPrice) &&
    !isNaN(item.b2bPrice) &&
    item.b2bPrice < item.internalPrice
  ) {
    errors.push(createError('b2bPrice', 'B2B price should not be less than internal price (negative profit)'))
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
