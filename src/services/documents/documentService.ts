/**
 * Document Service for Mobile
 *
 * Provides CRUD operations for all document types:
 * - Invoice
 * - Receipt
 * - Payment Voucher
 * - Statement of Payment
 *
 * Matches web app's supabaseService.ts implementation
 */

import { supabase } from '../api/supabaseClient'
import {
  Document,
  DocumentType,
  DocumentStatus,
  Invoice,
  Receipt,
  PaymentVoucher,
  StatementOfPayment,
  LineItem,
  Currency,
  Country,
} from '../../types'
import { logDocumentEvent } from '../activity/activityLogService'
import type { ActivityUser, ActivityDocumentInfo } from '../../types/activity'
import {
  NotFoundError,
  ConflictError,
  InvalidStatusTransitionError,
  fromSupabaseError,
  logError,
} from '../../utils/errors'
// NOTE: Account balance updates are handled by the database trigger
// 'create_transaction_on_document_complete' - do NOT import updateAccountBalance here

/**
 * Helper to create ActivityDocumentInfo from Document
 */
function toActivityDocumentInfo(doc: Partial<Document> & { id: string; documentType: DocumentType; documentNumber?: string; status?: DocumentStatus }): ActivityDocumentInfo {
  return {
    id: doc.id,
    documentNumber: doc.documentNumber || 'N/A',
    documentType: doc.documentType,
    status: doc.status || 'draft',
  }
}

// Default company ID (single-tenant mode)
const DEFAULT_COMPANY_ID = 'c0000000-0000-0000-0000-000000000001'

// ============================================================================
// STATUS TRANSITION VALIDATION
// ============================================================================

/**
 * Valid status transitions for documents
 * Prevents invalid state changes (e.g., completed → draft)
 */
const VALID_STATUS_TRANSITIONS: Record<DocumentStatus, DocumentStatus[]> = {
  draft: ['issued', 'cancelled'],
  issued: ['paid', 'cancelled'],
  paid: ['completed', 'cancelled'],
  completed: [], // Final state - no transitions allowed
  cancelled: ['draft'], // Can only reopen to draft
}

/**
 * Check if a status transition is valid
 */
export function isValidStatusTransition(
  currentStatus: DocumentStatus,
  newStatus: DocumentStatus
): boolean {
  if (currentStatus === newStatus) return true // No change is always valid
  const allowedTransitions = VALID_STATUS_TRANSITIONS[currentStatus] || []
  return allowedTransitions.includes(newStatus)
}

/**
 * Get allowed next statuses for a given status
 */
export function getAllowedNextStatuses(currentStatus: DocumentStatus): DocumentStatus[] {
  return VALID_STATUS_TRANSITIONS[currentStatus] || []
}

// ============================================================================
// ACCOUNT BALANCE UPDATES
// ============================================================================
//
// IMPORTANT: Account balance updates are handled AUTOMATICALLY by the database
// trigger 'create_transaction_on_document_complete' defined in Supabase.
//
// The trigger fires when:
// - A document is inserted with status='completed'
// - A document's status is updated to 'completed'
//
// It automatically:
// - Creates a transaction record in the 'transactions' table
// - Updates the account's current_balance
//
// DO NOT manually call updateAccountBalance or create transactions from the
// mobile app, as this would result in DUPLICATE entries.
// ============================================================================

// ============================================================================
// DOCUMENT NUMBER GENERATION
// ============================================================================

/**
 * Generate document number using database RPC
 */
export async function generateDocumentNumber(
  documentType: DocumentType,
  companyId: string = DEFAULT_COMPANY_ID
): Promise<string> {
  try {
    const { data, error } = await supabase.rpc('generate_document_number', {
      p_company_id: companyId,
      p_document_type: documentType,
    })

    if (error) throw error
    return data as string
  } catch (error) {
    console.error('Error generating document number:', error)
    // Fallback to client-side generation
    const prefix = getDocumentPrefix(documentType)
    const timestamp = Date.now().toString(36).toUpperCase()
    return `${prefix}-${timestamp}`
  }
}

function getDocumentPrefix(type: DocumentType): string {
  switch (type) {
    case 'invoice':
      return 'INV'
    case 'receipt':
      return 'RCP'
    case 'payment_voucher':
      return 'PV'
    case 'statement_of_payment':
      return 'SOP'
  }
}

// ============================================================================
// DOCUMENT FETCHING
// ============================================================================

/**
 * Get all documents for a company
 */
export async function getDocuments(
  companyId: string = DEFAULT_COMPANY_ID,
  options?: {
    type?: DocumentType
    status?: DocumentStatus
    limit?: number
    offset?: number
  }
): Promise<Document[]> {
  try {
    let query = supabase
      .from('documents')
      .select('*')
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (options?.type) {
      query = query.eq('document_type', options.type)
    }

    if (options?.status) {
      query = query.eq('status', options.status)
    }

    if (options?.limit) {
      query = query.limit(options.limit)
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options?.limit || 50) - 1)
    }

    const { data, error } = await query

    if (error) throw fromSupabaseError(error)

    // Fetch complete documents with type-specific data
    const documents = await Promise.all(
      (data || []).map((doc) => getDocument(doc.id, doc.document_type as DocumentType))
    )

    return documents.filter((doc): doc is Document => doc !== null)
  } catch (error) {
    logError(error, 'getDocuments')
    throw error
  }
}

/**
 * Get a single document with all related data
 */
export async function getDocument(
  documentId: string,
  documentType: DocumentType
): Promise<Document | null> {
  try {
    // Get base document
    const { data: docData, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single()

    if (docError) throw fromSupabaseError(docError)
    if (!docData) throw new NotFoundError('Document not found', { documentId })

    // Get line items
    const { data: items, error: itemsError } = await supabase
      .from('line_items')
      .select('*')
      .eq('document_id', documentId)
      .order('line_number')

    if (itemsError) throw fromSupabaseError(itemsError)

    // Get type-specific data and construct document
    switch (documentType) {
      case 'invoice':
        return await getInvoiceData(docData, items || [])
      case 'receipt':
        return await getReceiptData(docData, items || [])
      case 'payment_voucher':
        return await getPaymentVoucherData(docData, items || [])
      case 'statement_of_payment':
        return await getStatementOfPaymentData(docData, items || [])
      default:
        throw new Error(`Unknown document type: ${documentType}`)
    }
  } catch (error) {
    logError(error, 'getDocument')
    // Return null for NotFoundError to maintain backward compatibility
    if (error instanceof NotFoundError) {
      return null
    }
    throw error
  }
}

// ============================================================================
// DOCUMENT CREATION
// ============================================================================

/**
 * Rollback a partially created document
 * Deletes the base document and all related data (cascade handled by DB)
 */
async function rollbackDocument(documentId: string): Promise<void> {
  try {
    // Delete from type-specific tables first (in case cascade isn't set up)
    await Promise.all([
      supabase.from('invoices').delete().eq('document_id', documentId),
      supabase.from('receipts').delete().eq('document_id', documentId),
      supabase.from('payment_vouchers').delete().eq('document_id', documentId),
      supabase.from('statements_of_payment').delete().eq('document_id', documentId),
      supabase.from('line_items').delete().eq('document_id', documentId),
    ])
    // Delete the base document
    await supabase.from('documents').delete().eq('id', documentId)
    console.log(`Rollback completed for document ${documentId}`)
  } catch (rollbackError) {
    console.error('Rollback failed:', rollbackError)
    // Log but don't throw - the original error is more important
  }
}

/**
 * Create a new document
 * Implements transaction-like rollback: if any step fails after base document
 * creation, the entire operation is rolled back to prevent orphaned records.
 * @param document - Document data to create
 * @param companyId - Company ID (defaults to single-tenant mode)
 * @param bookingId - Optional linked booking ID
 * @param user - Optional user for activity logging
 */
export async function createDocument(
  document: Omit<Document, 'id' | 'createdAt' | 'updatedAt'>,
  companyId: string = DEFAULT_COMPANY_ID,
  bookingId?: string,
  user?: ActivityUser
): Promise<Document> {
  let documentId: string | null = null

  try {
    // Generate document number
    const documentNumber = await generateDocumentNumber(document.documentType, companyId)

    // Create base document
    const docInsert = {
      company_id: companyId,
      account_id: document.accountId || null,
      booking_id: bookingId || null,
      document_type: document.documentType,
      document_number: documentNumber,
      status: document.status,
      document_date: document.date,
      currency: document.currency,
      country: document.country,
      amount: document.amount,
      subtotal: document.subtotal || null,
      tax_rate: document.taxRate || null,
      tax_amount: document.taxAmount || null,
      total: document.total || null,
      notes: document.notes || null,
    }

    const { data: docData, error: docError } = await supabase
      .from('documents')
      .insert(docInsert)
      .select()
      .single()

    if (docError) throw fromSupabaseError(docError)
    documentId = docData!.id

    // Create type-specific data (with rollback on failure)
    try {
      switch (document.documentType) {
        case 'invoice':
          await createInvoice(documentId, document as Invoice)
          break
        case 'receipt':
          await createReceipt(documentId, document as Receipt)
          break
        case 'payment_voucher':
          await createPaymentVoucher(documentId, document as PaymentVoucher)
          break
        case 'statement_of_payment':
          await createStatementOfPayment(documentId, document as StatementOfPayment)
          break
      }
    } catch (typeError) {
      console.error('Failed to create type-specific data, rolling back:', typeError)
      await rollbackDocument(documentId)
      throw new Error(`Failed to create ${document.documentType} data: ${typeError}`)
    }

    // Create line items if present (with rollback on failure)
    if ('items' in document && document.items && Array.isArray(document.items) && document.items.length > 0) {
      try {
        await createLineItems(documentId, document.items as LineItem[])
      } catch (itemsError) {
        console.error('Failed to create line items, rolling back:', itemsError)
        await rollbackDocument(documentId)
        throw new Error(`Failed to create line items: ${itemsError}`)
      }
    }

    // Fetch and return complete document
    const createdDoc = await getDocument(documentId, document.documentType)
    if (!createdDoc) {
      await rollbackDocument(documentId)
      throw new NotFoundError('Failed to fetch created document', { documentId })
    }

    // Log activity if user is provided
    if (user) {
      logDocumentEvent('document:created', user, toActivityDocumentInfo(createdDoc), {
        bookingId,
        amount: createdDoc.amount,
        currency: createdDoc.currency,
      })
    }

    // NOTE: Account balance updates are handled by the database trigger
    // 'create_transaction_on_document_complete' which fires when a document
    // is inserted/updated with status='completed'. Do NOT call applyAccountBalanceChange
    // here as it would create duplicate transactions.

    return createdDoc
  } catch (error) {
    // If we have a documentId but got an unexpected error, try to rollback
    if (documentId && !(error instanceof Error && error.message.includes('rolling back'))) {
      await rollbackDocument(documentId)
    }
    logError(error, 'createDocument')
    throw error
  }
}

// ============================================================================
// DOCUMENT UPDATES
// ============================================================================

/**
 * Update a document
 * @param documentId - Document ID to update
 * @param updates - Partial document updates
 * @param user - Optional user for activity logging
 * @param expectedUpdatedAt - Optional timestamp for optimistic locking (ISO 8601 format)
 * @returns Updated document or null if not found
 * @throws Error if document was modified by another user (concurrent edit detected)
 */
export async function updateDocument(
  documentId: string,
  updates: Partial<Document>,
  user?: ActivityUser,
  expectedUpdatedAt?: string
): Promise<Document | null> {
  try {
    // First check if document exists and get version info
    const { data: existingDoc, error: checkError } = await supabase
      .from('documents')
      .select('id, document_type, updated_at')
      .eq('id', documentId)
      .maybeSingle()

    if (checkError) throw fromSupabaseError(checkError)
    if (!existingDoc) throw new NotFoundError('Document not found', { documentId })

    // Optimistic locking: Check if document was modified by another user
    if (expectedUpdatedAt && existingDoc.updated_at !== expectedUpdatedAt) {
      throw new ConflictError('Document was modified by another user', {
        documentId,
        expectedUpdatedAt,
        actualUpdatedAt: existingDoc.updated_at,
      })
    }

    const documentType = existingDoc.document_type as DocumentType

    // Update base document
    const { error: updateError } = await supabase
      .from('documents')
      .update({
        ...(updates.documentNumber !== undefined && { document_number: updates.documentNumber }),
        ...(updates.status && { status: updates.status }),
        ...(updates.amount !== undefined && { amount: updates.amount }),
        ...(updates.subtotal !== undefined && { subtotal: updates.subtotal }),
        ...(updates.taxRate !== undefined && { tax_rate: updates.taxRate }),
        ...(updates.taxAmount !== undefined && { tax_amount: updates.taxAmount }),
        ...(updates.total !== undefined && { total: updates.total }),
        ...(updates.notes !== undefined && { notes: updates.notes }),
        ...(updates.date && { document_date: updates.date }),
        ...(updates.accountId !== undefined && { account_id: updates.accountId || null }),
      })
      .eq('id', documentId)

    if (updateError) throw fromSupabaseError(updateError)

    // Update type-specific data
    switch (documentType) {
      case 'invoice':
        await updateInvoice(documentId, updates as Partial<Invoice>)
        break
      case 'receipt':
        await updateReceipt(documentId, updates as Partial<Receipt>)
        break
      case 'payment_voucher':
        await updatePaymentVoucher(documentId, updates as Partial<PaymentVoucher>)
        break
      case 'statement_of_payment':
        await updateStatementOfPayment(documentId, updates as Partial<StatementOfPayment>)
        break
    }

    // Update line items if provided (with race condition protection)
    if ('items' in updates && updates.items && updates.items.length > 0) {
      // Step 1: Backup existing line items before deletion
      const { data: existingItems } = await supabase
        .from('line_items')
        .select('*')
        .eq('document_id', documentId)
        .order('line_number')

      const backupItems = existingItems || []

      // Step 2: Delete existing line items
      const { error: deleteError } = await supabase
        .from('line_items')
        .delete()
        .eq('document_id', documentId)

      if (deleteError) {
        console.error('Failed to delete old line items:', deleteError)
        throw deleteError
      }

      // Step 3: Try to insert new line items
      try {
        await createLineItems(documentId, updates.items)
      } catch (insertError) {
        // Step 4: Restore backup if insert fails
        console.error('Failed to insert new line items, restoring backup:', insertError)
        if (backupItems.length > 0) {
          const restoreItems = backupItems.map((item) => ({
            document_id: item.document_id,
            line_number: item.line_number,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            amount: item.amount,
          }))
          await supabase.from('line_items').insert(restoreItems)
          console.log('Line items backup restored successfully')
        }
        throw new Error(`Failed to update line items: ${insertError}`)
      }
    }

    // Fetch and return complete updated document
    const updatedDoc = await getDocument(documentId, documentType)

    // Log activity if user is provided
    if (user && updatedDoc) {
      logDocumentEvent('document:updated', user, toActivityDocumentInfo(updatedDoc), {
        updatedFields: Object.keys(updates),
      })
    }

    return updatedDoc
  } catch (error) {
    console.error('Error updating document:', error)
    throw new Error(`Failed to update document: ${error}`)
  }
}

/**
 * Update document status with transition validation
 * @param documentId - Document ID to update
 * @param status - New status
 * @param user - Optional user for activity logging
 * @param skipValidation - Skip validation (use with caution, for admin overrides only)
 * @returns Object with success flag and optional error message
 */
export async function updateDocumentStatus(
  documentId: string,
  status: DocumentStatus,
  user?: ActivityUser,
  skipValidation: boolean = false
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get document info for validation and logging
    const { data: docInfo, error: fetchError } = await supabase
      .from('documents')
      .select('document_number, document_type, status')
      .eq('id', documentId)
      .single()

    if (fetchError || !docInfo) {
      return { success: false, error: 'Document not found' }
    }

    const previousStatus = docInfo.status as DocumentStatus
    const documentType = docInfo.document_type as DocumentType

    // Validate status transition unless skipped
    if (!skipValidation && !isValidStatusTransition(previousStatus, status)) {
      const allowedNext = getAllowedNextStatuses(previousStatus)
      const allowedStr = allowedNext.length > 0 ? allowedNext.join(', ') : 'none (final state)'
      console.warn(`Invalid status transition: ${previousStatus} → ${status}. Allowed: ${allowedStr}`)
      return {
        success: false,
        error: `Cannot change status from "${previousStatus}" to "${status}". Allowed transitions: ${allowedStr}`,
      }
    }

    const { error: updateError } = await supabase
      .from('documents')
      .update({ status })
      .eq('id', documentId)

    if (updateError) throw updateError

    // Log activity if user is provided
    if (user) {
      logDocumentEvent('document:status_changed', user, {
        id: documentId,
        documentNumber: docInfo.document_number,
        documentType: docInfo.document_type,
        status,
      }, {
        previousStatus,
        newStatus: status,
      })
    }

    // NOTE: Account balance updates are handled by the database trigger
    // 'create_transaction_on_document_complete' which fires when a document's
    // status is updated to 'completed'. Do NOT call applyAccountBalanceChange
    // here as it would create duplicate transactions.

    return { success: true }
  } catch (error) {
    console.error('Error updating document status:', error)
    return { success: false, error: `Failed to update status: ${error}` }
  }
}

// ============================================================================
// DOCUMENT DELETION
// ============================================================================

/**
 * Check if a document can be deleted
 * Validates business rules:
 * - Payment Vouchers cannot be deleted if referenced by any Statement of Payment
 * @param documentId - Document ID to check
 * @returns Object with canDelete flag and optional reason message
 */
export async function checkCanDeleteDocument(
  documentId: string
): Promise<{ canDelete: boolean; reason?: string }> {
  try {
    // Get the document to check its type
    const { data: docData, error: docError } = await supabase
      .from('documents')
      .select('document_type')
      .eq('id', documentId)
      .is('deleted_at', null)
      .single()

    if (docError) throw fromSupabaseError(docError)
    if (!docData) {
      return { canDelete: false, reason: 'Document not found' }
    }

    // If it's a payment voucher, check for linked statements
    if (docData.document_type === 'payment_voucher') {
      // First, get the payment_vouchers.id from the document_id
      const { data: voucherData, error: voucherError } = await supabase
        .from('payment_vouchers')
        .select('id')
        .eq('document_id', documentId)
        .maybeSingle()

      if (voucherError) throw fromSupabaseError(voucherError)

      if (voucherData) {
        // Check if any ACTIVE (non-deleted) statements reference this voucher
        const { data: statements, error: statementsError } = await supabase
          .from('statements_of_payment')
          .select('id, documents!inner(document_number, deleted_at)')
          .eq('linked_voucher_id', voucherData.id)

        if (statementsError) throw fromSupabaseError(statementsError)

        // Filter for non-deleted statements only
        const activeStatements = statements?.filter((sop: any) => {
          const doc = Array.isArray(sop.documents) ? sop.documents[0] : sop.documents
          return doc && !doc.deleted_at
        })

        if (activeStatements && activeStatements.length > 0) {
          const statementDoc = activeStatements[0].documents as any
          const statementNumber = Array.isArray(statementDoc)
            ? statementDoc[0]?.document_number
            : statementDoc?.document_number

          return {
            canDelete: false,
            reason: `This Payment Voucher is referenced by Statement of Payment ${statementNumber || ''}. Please delete the statement first.`,
          }
        }
      }
    }

    return { canDelete: true }
  } catch (error) {
    console.error('Error checking if document can be deleted:', error)
    return {
      canDelete: false,
      reason: `Failed to validate deletion: ${error}`,
    }
  }
}

/**
 * Soft delete a document
 * @param documentId - Document ID to delete
 * @param user - Optional user for activity logging
 */
export async function deleteDocument(documentId: string, user?: ActivityUser): Promise<boolean> {
  try {
    // Check if document can be deleted (validates business rules)
    const validation = await checkCanDeleteDocument(documentId)
    if (!validation.canDelete) {
      console.warn('Cannot delete document:', validation.reason)
      throw new Error(validation.reason || 'Cannot delete document')
    }

    // Get document info for logging before deletion
    const { data: docInfo } = await supabase
      .from('documents')
      .select('document_number, document_type, status')
      .eq('id', documentId)
      .single()

    const { error } = await supabase
      .from('documents')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', documentId)

    if (error) throw error

    // Log activity if user is provided
    if (user && docInfo) {
      logDocumentEvent('document:deleted', user, {
        id: documentId,
        documentNumber: docInfo.document_number,
        documentType: docInfo.document_type,
        status: docInfo.status,
      })
    }

    return true
  } catch (error) {
    console.error('Error deleting document:', error)
    return false
  }
}

// ============================================================================
// TYPE-SPECIFIC DOCUMENT OPERATIONS
// ============================================================================

async function createInvoice(documentId: string, invoice: Invoice): Promise<void> {
  const { error } = await supabase.from('invoices').insert({
    document_id: documentId,
    customer_name: invoice.customerName,
    customer_address: invoice.customerAddress || null,
    customer_email: invoice.customerEmail || null,
    invoice_date: invoice.invoiceDate,
    due_date: invoice.dueDate,
    payment_terms: invoice.paymentTerms || null,
  })

  if (error) throw error
}

async function createReceipt(documentId: string, receipt: Receipt): Promise<void> {
  // Look up invoice ID if linked
  let invoiceId: string | null = null
  if (receipt.linkedInvoiceId) {
    const { data } = await supabase
      .from('invoices')
      .select('id')
      .eq('document_id', receipt.linkedInvoiceId)
      .maybeSingle()
    invoiceId = data?.id || null
  }

  const { error } = await supabase.from('receipts').insert({
    document_id: documentId,
    linked_invoice_id: invoiceId,
    payer_name: receipt.payerName,
    payer_contact: receipt.payerContact || null,
    receipt_date: receipt.receiptDate,
    payment_method: receipt.paymentMethod,
    received_by: receipt.receivedBy,
  })

  if (error) throw error
}

async function createPaymentVoucher(documentId: string, voucher: PaymentVoucher): Promise<void> {
  const { error } = await supabase.from('payment_vouchers').insert({
    document_id: documentId,
    payee_name: voucher.payeeName,
    payee_address: voucher.payeeAddress || null,
    payee_bank_account: voucher.payeeBankAccount || null,
    payee_bank_name: voucher.payeeBankName || null,
    voucher_date: voucher.voucherDate,
    payment_due_date: voucher.paymentDueDate || null,
    requested_by: voucher.requestedBy,
    approved_by: typeof voucher.approvedBy === 'string' ? voucher.approvedBy : voucher.approvedBy?.name || null,
    approval_date: voucher.approvalDate || null,
  })

  if (error) throw error
}

async function createStatementOfPayment(documentId: string, statement: StatementOfPayment): Promise<void> {
  // Look up voucher ID
  let voucherId: string | null = null
  if (statement.linkedVoucherId) {
    const { data } = await supabase
      .from('payment_vouchers')
      .select('id')
      .eq('document_id', statement.linkedVoucherId)
      .maybeSingle()
    voucherId = data?.id || null
  }

  const { error } = await supabase.from('statements_of_payment').insert({
    document_id: documentId,
    linked_voucher_id: voucherId,
    payment_date: statement.paymentDate,
    payment_method: statement.paymentMethod,
    transaction_reference: statement.transactionReference,
    transfer_proof_filename: statement.transferProofFilename || null,
    transfer_proof_base64: statement.transferProofBase64 || null,
    confirmed_by: statement.confirmedBy,
    payee_name: statement.payeeName,
    transaction_fee: statement.transactionFee || 0,
    transaction_fee_type: statement.transactionFeeType || null,
    total_deducted: statement.totalDeducted,
  })

  if (error) throw error
}

// ============================================================================
// TYPE-SPECIFIC DOCUMENT UPDATES
// ============================================================================

async function updateInvoice(documentId: string, updates: Partial<Invoice>): Promise<void> {
  const updateData: any = {}

  if (updates.customerName !== undefined) updateData.customer_name = updates.customerName
  if (updates.customerAddress !== undefined) updateData.customer_address = updates.customerAddress
  if (updates.customerEmail !== undefined) updateData.customer_email = updates.customerEmail
  if (updates.invoiceDate !== undefined) updateData.invoice_date = updates.invoiceDate
  if (updates.dueDate !== undefined) updateData.due_date = updates.dueDate
  if (updates.paymentTerms !== undefined) updateData.payment_terms = updates.paymentTerms

  if (Object.keys(updateData).length > 0) {
    const { error } = await supabase
      .from('invoices')
      .update(updateData)
      .eq('document_id', documentId)

    if (error) throw error
  }
}

async function updateReceipt(documentId: string, updates: Partial<Receipt>): Promise<void> {
  const updateData: any = {}

  if (updates.payerName !== undefined) updateData.payer_name = updates.payerName
  if (updates.payerContact !== undefined) updateData.payer_contact = updates.payerContact
  if (updates.receiptDate !== undefined) updateData.receipt_date = updates.receiptDate
  if (updates.paymentMethod !== undefined) updateData.payment_method = updates.paymentMethod
  if (updates.receivedBy !== undefined) updateData.received_by = updates.receivedBy

  if (Object.keys(updateData).length > 0) {
    const { error } = await supabase
      .from('receipts')
      .update(updateData)
      .eq('document_id', documentId)

    if (error) throw error
  }
}

async function updatePaymentVoucher(documentId: string, updates: Partial<PaymentVoucher>): Promise<void> {
  const updateData: any = {}

  if (updates.payeeName !== undefined) updateData.payee_name = updates.payeeName
  if (updates.payeeAddress !== undefined) updateData.payee_address = updates.payeeAddress
  if (updates.payeeBankAccount !== undefined) updateData.payee_bank_account = updates.payeeBankAccount
  if (updates.payeeBankName !== undefined) updateData.payee_bank_name = updates.payeeBankName
  if (updates.voucherDate !== undefined) updateData.voucher_date = updates.voucherDate
  if (updates.paymentDueDate !== undefined) updateData.payment_due_date = updates.paymentDueDate
  if (updates.requestedBy !== undefined) updateData.requested_by = updates.requestedBy

  if (Object.keys(updateData).length > 0) {
    const { error } = await supabase
      .from('payment_vouchers')
      .update(updateData)
      .eq('document_id', documentId)

    if (error) throw error
  }
}

async function updateStatementOfPayment(documentId: string, updates: Partial<StatementOfPayment>): Promise<void> {
  const updateData: any = {}

  if (updates.paymentDate !== undefined) updateData.payment_date = updates.paymentDate
  if (updates.paymentMethod !== undefined) updateData.payment_method = updates.paymentMethod
  if (updates.transactionReference !== undefined) updateData.transaction_reference = updates.transactionReference
  if (updates.confirmedBy !== undefined) updateData.confirmed_by = updates.confirmedBy
  if (updates.transactionFee !== undefined) updateData.transaction_fee = updates.transactionFee
  if (updates.transactionFeeType !== undefined) updateData.transaction_fee_type = updates.transactionFeeType
  if (updates.totalDeducted !== undefined) updateData.total_deducted = updates.totalDeducted

  if (Object.keys(updateData).length > 0) {
    const { error } = await supabase
      .from('statements_of_payment')
      .update(updateData)
      .eq('document_id', documentId)

    if (error) throw error
  }
}

// ============================================================================
// LINE ITEMS
// ============================================================================

async function createLineItems(documentId: string, items: LineItem[]): Promise<void> {
  const inserts = items.map((item, index) => ({
    document_id: documentId,
    line_number: index + 1,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    amount: item.amount,
  }))

  const { error } = await supabase.from('line_items').insert(inserts)
  if (error) throw error
}

// ============================================================================
// DATA CONVERTERS
// ============================================================================

function dbLineItemToLineItem(dbItem: any): LineItem {
  return {
    id: dbItem.line_number.toString(),
    description: dbItem.description,
    quantity: dbItem.quantity,
    unitPrice: dbItem.unit_price,
    amount: dbItem.amount,
  }
}

async function getInvoiceData(doc: any, items: any[]): Promise<Invoice> {
  const { data } = await supabase
    .from('invoices')
    .select('*')
    .eq('document_id', doc.id)
    .maybeSingle()

  const invoiceData = data || {
    customer_name: 'Unknown',
    invoice_date: doc.document_date,
    due_date: doc.document_date,
  }

  // Fetch account name if accountId exists
  let accountName: string | undefined
  if (doc.account_id) {
    const { data: accountData } = await supabase
      .from('accounts')
      .select('name')
      .eq('id', doc.account_id)
      .maybeSingle()

    accountName = accountData?.name
  }

  return {
    id: doc.id,
    documentType: 'invoice',
    documentNumber: doc.document_number,
    status: doc.status,
    date: doc.document_date,
    currency: doc.currency as Currency,
    country: doc.country as Country,
    amount: doc.amount,
    subtotal: doc.subtotal || 0,
    taxRate: doc.tax_rate || undefined,
    taxAmount: doc.tax_amount || undefined,
    total: doc.total || doc.amount,
    accountId: doc.account_id || undefined,
    accountName: accountName,
    notes: doc.notes || undefined,
    items: items.map(dbLineItemToLineItem),
    customerName: invoiceData.customer_name,
    customerAddress: invoiceData.customer_address || undefined,
    customerEmail: invoiceData.customer_email || undefined,
    invoiceDate: invoiceData.invoice_date,
    dueDate: invoiceData.due_date,
    paymentTerms: invoiceData.payment_terms || undefined,
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
  }
}

async function getReceiptData(doc: any, items: any[]): Promise<Receipt> {
  const { data } = await supabase
    .from('receipts')
    .select('*')
    .eq('document_id', doc.id)
    .maybeSingle()

  const receiptData = data || {
    payer_name: 'Unknown',
    receipt_date: doc.document_date,
    payment_method: 'Unknown',
    received_by: 'Unknown',
  }

  // Fetch linked invoice's document number and document_id if linkedInvoiceId exists
  // Using two separate queries for reliability (JOIN syntax can fail without proper FK relationships)
  let linkedInvoiceNumber: string | undefined
  let linkedInvoiceDocumentId: string | undefined
  if (receiptData.linked_invoice_id) {
    try {
      // The linked_invoice_id in receipts table references invoices.id (NOT documents.id)
      // Step 1: Get document_id from invoices table
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .select('document_id')
        .eq('id', receiptData.linked_invoice_id)
        .maybeSingle()

      if (invoiceError) {
        console.error('[getReceiptData] Failed to fetch invoice document_id:', invoiceError)
      } else if (invoiceData?.document_id) {
        // Store the document_id for navigation
        linkedInvoiceDocumentId = invoiceData.document_id

        // Step 2: Get document_number from documents table using the document_id
        const { data: documentData, error: documentError } = await supabase
          .from('documents')
          .select('document_number')
          .eq('id', invoiceData.document_id)
          .maybeSingle()

        if (documentError) {
          console.error('[getReceiptData] Failed to fetch document_number:', documentError)
        } else if (documentData?.document_number) {
          linkedInvoiceNumber = documentData.document_number
          console.log('[getReceiptData] Successfully fetched linked invoice:', {
            linked_invoice_id: receiptData.linked_invoice_id,
            document_id: linkedInvoiceDocumentId,
            linkedInvoiceNumber,
          })
        } else {
          console.warn('[getReceiptData] Document number not found for document_id:', invoiceData.document_id)
        }
      } else {
        console.warn('[getReceiptData] Invoice not found for linked_invoice_id:', receiptData.linked_invoice_id)
      }
    } catch (error) {
      console.error('[getReceiptData] Error fetching linked invoice data:', error)
    }
  }

  // Fetch account name if accountId exists
  let accountName: string | undefined
  if (doc.account_id) {
    const { data: accountData } = await supabase
      .from('accounts')
      .select('name')
      .eq('id', doc.account_id)
      .maybeSingle()

    accountName = accountData?.name
  }

  return {
    id: doc.id,
    documentType: 'receipt',
    documentNumber: doc.document_number,
    status: doc.status,
    date: doc.document_date,
    currency: doc.currency as Currency,
    country: doc.country as Country,
    amount: doc.amount,
    subtotal: doc.subtotal || 0,
    taxRate: doc.tax_rate || undefined,
    taxAmount: doc.tax_amount || undefined,
    total: doc.total || doc.amount,
    accountId: doc.account_id || undefined,
    accountName: accountName,
    notes: doc.notes || undefined,
    payerName: receiptData.payer_name,
    payerContact: receiptData.payer_contact || undefined,
    receiptDate: receiptData.receipt_date,
    paymentMethod: receiptData.payment_method,
    linkedInvoiceId: linkedInvoiceDocumentId || receiptData.linked_invoice_id || undefined,
    linkedInvoiceNumber: linkedInvoiceNumber,
    receivedBy: receiptData.received_by,
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
  }
}

async function getPaymentVoucherData(doc: any, items: any[]): Promise<PaymentVoucher> {
  const { data } = await supabase
    .from('payment_vouchers')
    .select('*')
    .eq('document_id', doc.id)
    .maybeSingle()

  const voucherData = data || {
    payee_name: 'Unknown',
    voucher_date: doc.document_date,
    requested_by: 'Unknown',
  }

  // Fetch account name if accountId exists
  let accountName: string | undefined
  if (doc.account_id) {
    const { data: accountData } = await supabase
      .from('accounts')
      .select('name')
      .eq('id', doc.account_id)
      .maybeSingle()

    accountName = accountData?.name
  }

  return {
    id: doc.id,
    documentType: 'payment_voucher',
    documentNumber: doc.document_number,
    status: doc.status,
    date: doc.document_date,
    currency: doc.currency as Currency,
    country: doc.country as Country,
    amount: doc.amount,
    subtotal: doc.subtotal || 0,
    taxRate: doc.tax_rate || undefined,
    taxAmount: doc.tax_amount || undefined,
    total: doc.total || doc.amount,
    accountId: doc.account_id || undefined,
    accountName: accountName,
    notes: doc.notes || undefined,
    items: items.map(dbLineItemToLineItem),
    payeeName: voucherData.payee_name,
    payeeAddress: voucherData.payee_address || undefined,
    payeeBankAccount: voucherData.payee_bank_account || undefined,
    payeeBankName: voucherData.payee_bank_name || undefined,
    voucherDate: voucherData.voucher_date,
    paymentDueDate: voucherData.payment_due_date || undefined,
    requestedBy: voucherData.requested_by,
    approvedBy: voucherData.approved_by || undefined,
    approvalDate: voucherData.approval_date || undefined,
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
  }
}

async function getStatementOfPaymentData(doc: any, items: any[]): Promise<StatementOfPayment> {
  const { data } = await supabase
    .from('statements_of_payment')
    .select('*')
    .eq('document_id', doc.id)
    .maybeSingle()

  const statementData = data || {
    linked_voucher_id: '',
    payment_date: doc.document_date,
    payment_method: 'Unknown',
    transaction_reference: 'Unknown',
    confirmed_by: 'Unknown',
    payee_name: 'Unknown',
    total_deducted: doc.amount,
  }

  // Fetch account name if accountId exists
  let accountName: string | undefined
  if (doc.account_id) {
    const { data: accountData } = await supabase
      .from('accounts')
      .select('name')
      .eq('id', doc.account_id)
      .maybeSingle()

    accountName = accountData?.name
  }

  // Fetch linked voucher's document number if linkedVoucherId exists
  // Using JOIN query for reliability and efficiency
  let linkedVoucherNumber: string | undefined
  if (statementData.linked_voucher_id) {
    // The linked_voucher_id in statements_of_payment table references payment_vouchers.id (NOT documents.id)
    // We need to: payment_vouchers.id -> payment_vouchers.document_id -> documents.document_number
    const { data: voucherWithDoc, error: lookupError } = await supabase
      .from('payment_vouchers')
      .select('document_id, documents(document_number)')
      .eq('id', statementData.linked_voucher_id)
      .maybeSingle()

    if (lookupError) {
      console.warn('[getStatementOfPaymentData] Failed to lookup linked voucher:', lookupError)
    } else if (voucherWithDoc) {
      // Handle both nested object and array response formats from Supabase
      const docs = voucherWithDoc.documents
      if (docs) {
        linkedVoucherNumber = Array.isArray(docs) ? docs[0]?.document_number : (docs as any).document_number
      }
    }
  }

  return {
    id: doc.id,
    documentType: 'statement_of_payment',
    documentNumber: doc.document_number,
    status: doc.status,
    date: doc.document_date,
    currency: doc.currency as Currency,
    country: doc.country as Country,
    amount: doc.amount,
    subtotal: doc.subtotal || 0,
    taxRate: doc.tax_rate || undefined,
    taxAmount: doc.tax_amount || undefined,
    total: doc.total || doc.amount,
    accountId: doc.account_id || undefined,
    accountName: accountName,
    notes: doc.notes || undefined,
    items: items.map(dbLineItemToLineItem),
    linkedVoucherId: statementData.linked_voucher_id,
    linkedVoucherNumber: linkedVoucherNumber,
    paymentDate: statementData.payment_date,
    paymentMethod: statementData.payment_method,
    transactionReference: statementData.transaction_reference,
    transferProofFilename: statementData.transfer_proof_filename || undefined,
    transferProofBase64: statementData.transfer_proof_base64 || undefined,
    confirmedBy: statementData.confirmed_by,
    payeeName: statementData.payee_name,
    transactionFee: statementData.transaction_fee || 0,
    transactionFeeType: statementData.transaction_fee_type || undefined,
    totalDeducted: statementData.total_deducted,
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
  }
}

// ============================================================================
// CONCURRENCY & DATA INTEGRITY
// ============================================================================

/**
 * Check document version for optimistic locking
 * Returns the current version info (updated_at timestamp) for a document
 * @param documentId - Document ID to check
 * @returns Version info with updatedAt timestamp, or null if document not found
 */
export async function checkDocumentVersion(
  documentId: string
): Promise<{ updatedAt: string; updatedBy?: string } | null> {
  try {
    const { data, error } = await supabase
      .from('documents')
      .select('updated_at')
      .eq('id', documentId)
      .is('deleted_at', null)
      .maybeSingle()

    if (error) throw error
    if (!data) return null

    return {
      updatedAt: data.updated_at,
      updatedBy: undefined, // Could be extended if we track updated_by in the future
    }
  } catch (error) {
    console.error('Error checking document version:', error)
    return null
  }
}

/**
 * Check if a document is stale (has been updated since a known timestamp)
 * Used to detect if local data is out of sync with server
 * @param documentId - Document ID to check
 * @param lastKnownUpdatedAt - Last known updated_at timestamp (ISO 8601 format)
 * @returns true if document has been updated since lastKnownUpdatedAt, false otherwise
 */
export async function isDocumentStale(
  documentId: string,
  lastKnownUpdatedAt: string
): Promise<boolean> {
  try {
    const currentVersion = await checkDocumentVersion(documentId)
    if (!currentVersion) return false // Document doesn't exist or was deleted

    return currentVersion.updatedAt !== lastKnownUpdatedAt
  } catch (error) {
    console.error('Error checking if document is stale:', error)
    return false
  }
}

// ============================================================================
// INVOICE PAYMENT TRACKING
// ============================================================================

/**
 * Invoice payment status information
 */
export interface InvoicePaymentStatus {
  invoiceTotal: number
  amountPaid: number
  balanceDue: number
  paymentCount: number
  lastPaymentDate?: string
  paymentStatus: 'unpaid' | 'partially_paid' | 'fully_paid'
  percentPaid: number
}

/**
 * Receipt linked to an invoice
 */
export interface LinkedReceipt {
  receiptId: string
  documentId: string
  documentNumber: string
  amount: number
  receiptDate: string
  paymentMethod: string
  payerName: string
  status: string
}

/**
 * Get payment status for an invoice
 * Calculates total paid, balance due, and payment progress from linked receipts
 * @param invoiceDocumentId - The document ID of the invoice (not invoice.id)
 */
export async function getInvoicePaymentStatus(
  invoiceDocumentId: string
): Promise<InvoicePaymentStatus | null> {
  try {
    // First, get the invoice total from documents table
    const { data: invoiceDoc, error: invoiceError } = await supabase
      .from('documents')
      .select('amount, currency')
      .eq('id', invoiceDocumentId)
      .eq('document_type', 'invoice')
      .is('deleted_at', null)
      .maybeSingle()

    if (invoiceError) throw invoiceError
    if (!invoiceDoc) return null

    const invoiceTotal = invoiceDoc.amount || 0

    // Get the invoice record to find linked receipts
    const { data: invoice, error: invError } = await supabase
      .from('invoices')
      .select('id')
      .eq('document_id', invoiceDocumentId)
      .maybeSingle()

    if (invError) throw invError
    if (!invoice) return null

    // Query linked receipts (non-deleted, completed)
    const { data: receipts, error: receiptsError } = await supabase
      .from('receipts')
      .select(`
        id,
        documents!inner (
          id,
          amount,
          document_date,
          status,
          deleted_at
        )
      `)
      .eq('linked_invoice_id', invoice.id)

    if (receiptsError) throw receiptsError

    // Filter and sum payments from active receipts
    let amountPaid = 0
    let paymentCount = 0
    let lastPaymentDate: string | undefined

    if (receipts) {
      for (const receipt of receipts) {
        const doc = receipt.documents as any
        // Only count non-deleted, completed receipts
        if (doc && !doc.deleted_at && (doc.status === 'completed' || doc.status === 'paid')) {
          amountPaid += doc.amount || 0
          paymentCount++
          if (!lastPaymentDate || doc.document_date > lastPaymentDate) {
            lastPaymentDate = doc.document_date
          }
        }
      }
    }

    const balanceDue = invoiceTotal - amountPaid
    const percentPaid = invoiceTotal > 0 ? Math.round((amountPaid / invoiceTotal) * 1000) / 10 : 100

    // Determine payment status
    let paymentStatus: 'unpaid' | 'partially_paid' | 'fully_paid'
    if (amountPaid === 0) {
      paymentStatus = 'unpaid'
    } else if (amountPaid >= invoiceTotal) {
      paymentStatus = 'fully_paid'
    } else {
      paymentStatus = 'partially_paid'
    }

    return {
      invoiceTotal,
      amountPaid,
      balanceDue,
      paymentCount,
      lastPaymentDate,
      paymentStatus,
      percentPaid,
    }
  } catch (error) {
    console.error('Error getting invoice payment status:', error)
    return null
  }
}

/**
 * Get all receipts linked to an invoice
 * @param invoiceDocumentId - The document ID of the invoice
 */
export async function getInvoiceReceipts(
  invoiceDocumentId: string
): Promise<LinkedReceipt[]> {
  try {
    // Get the invoice record
    const { data: invoice, error: invError } = await supabase
      .from('invoices')
      .select('id')
      .eq('document_id', invoiceDocumentId)
      .maybeSingle()

    if (invError) throw invError
    if (!invoice) return []

    // Query linked receipts
    const { data: receipts, error: receiptsError } = await supabase
      .from('receipts')
      .select(`
        id,
        payer_name,
        receipt_date,
        payment_method,
        documents!inner (
          id,
          document_number,
          amount,
          status,
          deleted_at
        )
      `)
      .eq('linked_invoice_id', invoice.id)
      .order('receipt_date', { ascending: false })

    if (receiptsError) throw receiptsError
    if (!receipts) return []

    // Map to LinkedReceipt format, filtering out deleted
    return receipts
      .filter((r) => {
        const doc = r.documents as any
        return doc && !doc.deleted_at
      })
      .map((r) => {
        const doc = r.documents as any
        return {
          receiptId: r.id,
          documentId: doc.id,
          documentNumber: doc.document_number,
          amount: doc.amount,
          receiptDate: r.receipt_date,
          paymentMethod: r.payment_method,
          payerName: r.payer_name,
          status: doc.status,
        }
      })
  } catch (error) {
    console.error('Error getting invoice receipts:', error)
    return []
  }
}
