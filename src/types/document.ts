/**
 * Document Types - Matches web app exactly
 *
 * Document types for WIF Finance:
 * - Invoice: Customer invoices
 * - Receipt: Payment receipts (can link to invoice)
 * - Payment Voucher: Payment requests (requires approval)
 * - Statement of Payment: Payment execution (links to voucher)
 */

export type Currency = 'MYR' | 'JPY'
export type Country = 'Malaysia' | 'Japan'
export type DocumentType = 'invoice' | 'receipt' | 'payment_voucher' | 'statement_of_payment'
export type DocumentStatus = 'draft' | 'issued' | 'paid' | 'completed' | 'cancelled'

export interface LineItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
  amount: number
}

/**
 * User reference for document tracking
 */
export interface UserReference {
  id: string
  name: string
  username: string
}

/**
 * Base document fields shared by all document types
 */
export interface BaseDocument {
  id: string
  documentType: DocumentType
  documentNumber: string
  date: string
  status: DocumentStatus
  currency: Currency
  country: Country
  amount: number
  subtotal?: number
  taxRate?: number
  taxAmount?: number
  total?: number
  accountId?: string
  accountName?: string
  notes?: string
  createdAt: string
  updatedAt: string
  createdBy?: UserReference
  updatedBy?: UserReference
  lastModifiedAt?: string
}

/**
 * Invoice document
 */
export interface Invoice extends BaseDocument {
  documentType: 'invoice'
  customerName: string
  customerAddress?: string
  customerEmail?: string
  invoiceDate: string
  dueDate: string
  items: LineItem[]
  subtotal: number
  total: number
  paymentTerms?: string
}

/**
 * Receipt document
 */
export interface Receipt extends BaseDocument {
  documentType: 'receipt'
  payerName: string
  payerContact?: string
  receiptDate: string
  paymentMethod: string
  linkedInvoiceId?: string
  linkedInvoiceNumber?: string
  receivedBy: string
}

/**
 * Payment Voucher document
 */
export interface PaymentVoucher extends BaseDocument {
  documentType: 'payment_voucher'
  payeeName: string
  payeeAddress?: string
  payeeBankAccount?: string
  payeeBankName?: string
  voucherDate: string
  items: LineItem[]
  subtotal: number
  total: number
  requestedBy: string
  approvedBy?: string | UserReference
  approvalDate?: string
  paymentDueDate?: string
  purpose?: string
  supportingDocStoragePath?: string
  supportingDocFilename?: string
}

/**
 * Statement of Payment document
 */
export interface StatementOfPayment extends BaseDocument {
  documentType: 'statement_of_payment'
  linkedVoucherId: string
  linkedVoucherNumber: string
  paymentDate: string
  paymentMethod: string
  transactionReference: string
  transferProofFilename?: string
  transferProofBase64?: string
  transferProofStoragePath?: string
  confirmedBy: string
  payeeName: string
  items: LineItem[]
  subtotal: number
  total: number
  transactionFee?: number
  transactionFeeType?: string
  totalDeducted: number
}

/**
 * Union type for all documents
 */
export type Document = Invoice | Receipt | PaymentVoucher | StatementOfPayment

/**
 * Document type display names
 */
export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  invoice: 'Invoice',
  receipt: 'Receipt',
  payment_voucher: 'Payment Voucher',
  statement_of_payment: 'Statement of Payment',
}

/**
 * Document status display names
 */
export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  draft: 'Draft',
  issued: 'Issued',
  paid: 'Paid',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

/**
 * Document status colors for UI
 */
export const DOCUMENT_STATUS_COLORS: Record<DocumentStatus, string> = {
  draft: '#8E8E93',
  issued: '#007AFF',
  paid: '#34C759',
  completed: '#34C759',
  cancelled: '#FF3B30',
}

/**
 * Document type colors for UI
 */
export const DOCUMENT_TYPE_COLORS: Record<DocumentType, string> = {
  invoice: '#007AFF',
  receipt: '#34C759',
  payment_voucher: '#FF9500',
  statement_of_payment: '#5856D6',
}

/**
 * Type guard to check if document is an Invoice
 */
export function isInvoice(doc: Document): doc is Invoice {
  return doc.documentType === 'invoice'
}

/**
 * Type guard to check if document is a Receipt
 */
export function isReceipt(doc: Document): doc is Receipt {
  return doc.documentType === 'receipt'
}

/**
 * Type guard to check if document is a PaymentVoucher
 */
export function isPaymentVoucher(doc: Document): doc is PaymentVoucher {
  return doc.documentType === 'payment_voucher'
}

/**
 * Type guard to check if document is a StatementOfPayment
 */
export function isStatementOfPayment(doc: Document): doc is StatementOfPayment {
  return doc.documentType === 'statement_of_payment'
}
