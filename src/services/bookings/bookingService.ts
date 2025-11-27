/**
 * Booking Service for Mobile
 *
 * Provides CRUD operations for booking forms:
 * - Trip cost breakdown by category
 * - Internal (WIF) cost vs B2B pricing
 * - Profit calculation
 * - Currency conversion (JPY → MYR)
 *
 * IMPORTANT: Column names must match the web app's Supabase schema exactly!
 * See: /Users/firdaus/Documents/2025/code/wif-fin/supabase/migrations/002_bookings_only_simple.sql
 */

import { supabase } from '../api/supabaseClient'
import type {
  Booking,
  BookingStatus,
  BookingCostItem,
  Currency,
} from '../../types'
import { logBookingEvent } from '../activity/activityLogService'
import type { ActivityUser, ActivityBookingInfo } from '../../types/activity'

/**
 * Helper to create ActivityBookingInfo from Booking
 */
function toActivityBookingInfo(booking: Partial<Booking> & { id: string; bookingNumber?: string; guestName?: string; status?: BookingStatus }): ActivityBookingInfo {
  return {
    id: booking.id,
    bookingNumber: booking.bookingNumber || 'N/A',
    guestName: booking.guestName || 'Unknown',
    status: booking.status || 'draft',
  }
}

// Default company ID (single-tenant mode)
const DEFAULT_COMPANY_ID = 'c0000000-0000-0000-0000-000000000001'

// ============================================================================
// STATUS TRANSITION VALIDATION
// ============================================================================

/**
 * Valid status transitions for bookings
 * Prevents invalid state changes (e.g., completed → draft)
 */
const VALID_BOOKING_STATUS_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  draft: ['planning', 'cancelled'],
  planning: ['confirmed', 'cancelled'],
  confirmed: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [], // Final state - no transitions allowed
  cancelled: ['draft'], // Can only reopen to draft
}

/**
 * Check if a booking status transition is valid
 * @param currentStatus - Current booking status
 * @param newStatus - Desired new status
 * @returns True if transition is allowed, false otherwise
 */
export function isValidBookingStatusTransition(
  currentStatus: BookingStatus,
  newStatus: BookingStatus
): boolean {
  if (currentStatus === newStatus) return true // No change is always valid
  const allowedTransitions = VALID_BOOKING_STATUS_TRANSITIONS[currentStatus] || []
  return allowedTransitions.includes(newStatus)
}

/**
 * Get allowed next statuses for a given booking status
 * @param currentStatus - Current booking status
 * @returns Array of allowed next statuses
 */
export function getAllowedNextBookingStatuses(currentStatus: BookingStatus): BookingStatus[] {
  return VALID_BOOKING_STATUS_TRANSITIONS[currentStatus] || []
}

// ============================================================================
// BOOKING NUMBER GENERATION
// ============================================================================

/**
 * Generate booking number
 */
export async function generateBookingNumber(
  companyId: string = DEFAULT_COMPANY_ID
): Promise<string> {
  try {
    // Try to use database function
    const { data, error } = await supabase.rpc('generate_booking_number', {
      p_company_id: companyId,
    })

    if (error) throw error
    return data as string
  } catch (error) {
    // Fallback to client-side generation
    const year = new Date().getFullYear()
    const timestamp = Date.now().toString(36).toUpperCase().slice(-4)
    return `BK-${year}-${timestamp}`
  }
}

// ============================================================================
// BOOKING OPERATIONS
// ============================================================================

/**
 * Get all bookings for a company
 */
export async function getBookings(
  companyId: string = DEFAULT_COMPANY_ID,
  options?: {
    status?: BookingStatus
    limit?: number
    offset?: number
  }
): Promise<Booking[]> {
  try {
    let query = supabase
      .from('bookings')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('trip_start_date', { ascending: false })

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

    if (error) throw error

    // Convert database bookings to Booking type
    return (data || []).map(dbBookingToBooking)
  } catch (error) {
    console.error('Error getting bookings:', error)
    throw new Error(`Failed to get bookings: ${error}`)
  }
}

/**
 * Get a single booking
 */
export async function getBooking(bookingId: string): Promise<Booking | null> {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null // No rows found
      throw error
    }

    if (!data) return null

    return dbBookingToBooking(data)
  } catch (error) {
    console.error('Error getting booking:', error)
    return null
  }
}

/**
 * Create a new booking
 * @param booking - Booking data to create
 * @param companyId - Company ID
 * @param user - Optional user for activity logging
 */
export async function createBooking(
  booking: Omit<Booking, 'id' | 'bookingNumber' | 'createdAt' | 'updatedAt'>,
  companyId: string = DEFAULT_COMPANY_ID,
  user?: ActivityUser
): Promise<Booking> {
  try {
    // Generate booking number
    const bookingCode = await generateBookingNumber(companyId)

    // Calculate totals from cost items
    const totals = calculateTotals(booking)

    // Create booking with CORRECT column names (matching web app schema)
    const bookingInsert = {
      company_id: companyId,
      booking_code: bookingCode,
      guest_name: booking.guestName,
      trip_start_date: booking.startDate,
      trip_end_date: booking.endDate || booking.startDate,
      number_of_pax: booking.pax?.toString() || '',
      country: 'Japan',
      status: booking.status,
      exchange_rate: booking.exchangeRate || 0.026,

      // Cost items stored as JSONB (correct column names!)
      transportation_items: booking.transportation || [],
      meals_items: booking.meals || [],
      entrance_items: booking.entranceFees || [],
      tour_guide_items: booking.tourGuides || [],
      flight_items: booking.flights || [],
      accommodation_items: booking.accommodation || [],

      // Category totals (internal/WIF cost)
      transportation_total: sumInternalTotal(booking.transportation),
      meals_total: sumInternalTotal(booking.meals),
      entrance_total: sumInternalTotal(booking.entranceFees),
      tour_guide_total: sumInternalTotal(booking.tourGuides),
      flight_total: sumInternalTotal(booking.flights),
      accommodation_total: sumInternalTotal(booking.accommodation),

      // Category B2B totals
      transportation_b2b_total: sumB2BTotal(booking.transportation),
      meals_b2b_total: sumB2BTotal(booking.meals),
      entrance_b2b_total: sumB2BTotal(booking.entranceFees),
      tour_guide_b2b_total: sumB2BTotal(booking.tourGuides),
      flight_b2b_total: sumB2BTotal(booking.flights),
      accommodation_b2b_total: sumB2BTotal(booking.accommodation),

      // Grand totals (correct column names!)
      grand_total_jpy: totals.totalInternalCostJPY,
      grand_total_b2b_jpy: totals.totalB2BCostJPY,
      grand_total_myr: totals.totalInternalCostMYR || 0,
      grand_total_b2b_myr: totals.totalB2BCostMYR || 0,

      // Pricing in MYR
      wif_cost: totals.totalInternalCostMYR || 0,
      b2b_price: totals.totalB2BCostMYR || 0,
      expected_profit: totals.totalProfitMYR || 0,

      notes: booking.notes || null,
      is_active: true,
    }

    const { data, error } = await supabase
      .from('bookings')
      .insert(bookingInsert)
      .select()
      .single()

    if (error) throw error

    const createdBooking = dbBookingToBooking(data)

    // Log activity if user is provided
    if (user) {
      logBookingEvent('booking:created', user, toActivityBookingInfo(createdBooking), {
        totalJPY: createdBooking.totalB2BCostJPY,
        totalMYR: createdBooking.totalB2BCostMYR,
        pax: createdBooking.pax,
      })
    }

    return createdBooking
  } catch (error) {
    console.error('Error creating booking:', error)
    throw new Error(`Failed to create booking: ${error}`)
  }
}

/**
 * Update a booking
 * @param bookingId - Booking ID to update
 * @param updates - Partial booking updates
 * @param user - Optional user for activity logging
 * @param expectedUpdatedAt - Optional timestamp for optimistic locking (ISO 8601 format)
 * @returns Updated booking or null if not found
 * @throws Error if booking was modified by another user (concurrent edit detected)
 */
export async function updateBooking(
  bookingId: string,
  updates: Partial<Booking>,
  user?: ActivityUser,
  expectedUpdatedAt?: string
): Promise<Booking | null> {
  try {
    // Optimistic locking: Check if booking was modified by another user
    if (expectedUpdatedAt) {
      const { data: currentBooking, error: checkError } = await supabase
        .from('bookings')
        .select('updated_at')
        .eq('id', bookingId)
        .maybeSingle()

      if (checkError) throw checkError
      if (!currentBooking) return null

      if (currentBooking.updated_at !== expectedUpdatedAt) {
        throw new Error('Booking was modified by another user')
      }
    }

    // Build update object with CORRECT column names
    const updateData: Record<string, any> = {}

    if (updates.guestName !== undefined) updateData.guest_name = updates.guestName
    if (updates.startDate !== undefined) updateData.trip_start_date = updates.startDate
    if (updates.endDate !== undefined) updateData.trip_end_date = updates.endDate
    if (updates.pax !== undefined) updateData.number_of_pax = updates.pax.toString()
    if (updates.status !== undefined) updateData.status = updates.status
    if (updates.exchangeRate !== undefined) updateData.exchange_rate = updates.exchangeRate
    if (updates.notes !== undefined) updateData.notes = updates.notes

    // Cost items (correct column names!)
    if (updates.transportation !== undefined) {
      updateData.transportation_items = updates.transportation
      updateData.transportation_total = sumInternalTotal(updates.transportation)
      updateData.transportation_b2b_total = sumB2BTotal(updates.transportation)
    }
    if (updates.meals !== undefined) {
      updateData.meals_items = updates.meals
      updateData.meals_total = sumInternalTotal(updates.meals)
      updateData.meals_b2b_total = sumB2BTotal(updates.meals)
    }
    if (updates.entranceFees !== undefined) {
      updateData.entrance_items = updates.entranceFees
      updateData.entrance_total = sumInternalTotal(updates.entranceFees)
      updateData.entrance_b2b_total = sumB2BTotal(updates.entranceFees)
    }
    if (updates.tourGuides !== undefined) {
      updateData.tour_guide_items = updates.tourGuides
      updateData.tour_guide_total = sumInternalTotal(updates.tourGuides)
      updateData.tour_guide_b2b_total = sumB2BTotal(updates.tourGuides)
    }
    if (updates.flights !== undefined) {
      updateData.flight_items = updates.flights
      updateData.flight_total = sumInternalTotal(updates.flights)
      updateData.flight_b2b_total = sumB2BTotal(updates.flights)
    }
    if (updates.accommodation !== undefined) {
      updateData.accommodation_items = updates.accommodation
      updateData.accommodation_total = sumInternalTotal(updates.accommodation)
      updateData.accommodation_b2b_total = sumB2BTotal(updates.accommodation)
    }
    if (updates.other !== undefined) {
      // Note: 'other' category might not have dedicated columns in web app schema
      // We'll include it in the totals calculation
    }

    // Recalculate grand totals if any cost items changed
    const hasCostUpdates = updates.transportation || updates.meals ||
      updates.entranceFees || updates.tourGuides ||
      updates.flights || updates.accommodation || updates.other

    if (hasCostUpdates) {
      const totals = calculateTotals(updates)
      updateData.grand_total_jpy = totals.totalInternalCostJPY
      updateData.grand_total_b2b_jpy = totals.totalB2BCostJPY
      updateData.grand_total_myr = totals.totalInternalCostMYR || 0
      updateData.grand_total_b2b_myr = totals.totalB2BCostMYR || 0
      updateData.wif_cost = totals.totalInternalCostMYR || 0
      updateData.b2b_price = totals.totalB2BCostMYR || 0
      updateData.expected_profit = totals.totalProfitMYR || 0
    }

    const { data, error } = await supabase
      .from('bookings')
      .update(updateData)
      .eq('id', bookingId)
      .select()
      .single()

    if (error) throw error

    const updatedBooking = dbBookingToBooking(data)

    // Log activity if user is provided
    if (user) {
      logBookingEvent('booking:updated', user, toActivityBookingInfo(updatedBooking), {
        updatedFields: Object.keys(updates),
      })
    }

    return updatedBooking
  } catch (error) {
    console.error('Error updating booking:', error)
    throw new Error(`Failed to update booking: ${error}`)
  }
}

/**
 * Update booking status with transition validation
 * @param bookingId - Booking ID
 * @param status - New status
 * @param user - Optional user for activity logging
 * @param skipValidation - Skip validation (use with caution, for admin overrides only)
 * @returns Object with success flag and optional error message
 */
export async function updateBookingStatus(
  bookingId: string,
  status: BookingStatus,
  user?: ActivityUser,
  skipValidation: boolean = false
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get current booking info for validation and logging
    const { data: bookingInfo, error: fetchError } = await supabase
      .from('bookings')
      .select('booking_code, guest_name, status')
      .eq('id', bookingId)
      .single()

    if (fetchError || !bookingInfo) {
      return { success: false, error: 'Booking not found' }
    }

    const previousStatus = bookingInfo.status as BookingStatus

    // Validate status transition unless skipped
    if (!skipValidation && !isValidBookingStatusTransition(previousStatus, status)) {
      const allowedNext = getAllowedNextBookingStatuses(previousStatus)
      const allowedStr = allowedNext.length > 0 ? allowedNext.join(', ') : 'none (final state)'
      console.warn(`Invalid booking status transition: ${previousStatus} → ${status}. Allowed: ${allowedStr}`)
      return {
        success: false,
        error: `Cannot change status from "${previousStatus}" to "${status}". Allowed transitions: ${allowedStr}`,
      }
    }

    const { error: updateError } = await supabase
      .from('bookings')
      .update({ status })
      .eq('id', bookingId)

    if (updateError) throw updateError

    // Log activity if user is provided
    if (user) {
      logBookingEvent('booking:status_changed', user, {
        id: bookingId,
        bookingNumber: bookingInfo.booking_code,
        guestName: bookingInfo.guest_name,
        status,
      }, {
        previousStatus,
        newStatus: status,
      })
    }

    return { success: true }
  } catch (error) {
    console.error('Error updating booking status:', error)
    return { success: false, error: `Failed to update status: ${error}` }
  }
}

/**
 * Delete a booking (soft delete)
 * @param bookingId - Booking ID to delete
 * @param user - Optional user for activity logging
 */
export async function deleteBooking(bookingId: string, user?: ActivityUser): Promise<boolean> {
  try {
    // Get booking info for logging before deletion
    const { data: bookingInfo } = await supabase
      .from('bookings')
      .select('booking_code, guest_name, status')
      .eq('id', bookingId)
      .single()

    const { error } = await supabase
      .from('bookings')
      .update({ is_active: false })
      .eq('id', bookingId)

    if (error) throw error

    // Log activity if user is provided
    if (user && bookingInfo) {
      logBookingEvent('booking:deleted', user, {
        id: bookingId,
        bookingNumber: bookingInfo.booking_code,
        guestName: bookingInfo.guest_name,
        status: bookingInfo.status,
      })
    }

    return true
  } catch (error) {
    console.error('Error deleting booking:', error)
    return false
  }
}

/**
 * Link a document to a booking
 */
export async function linkDocumentToBooking(
  bookingId: string,
  documentId: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('bookings')
      .update({ document_id: documentId })
      .eq('id', bookingId)

    if (error) throw error
    return true
  } catch (error) {
    console.error('Error linking document to booking:', error)
    return false
  }
}

// ============================================================================
// BOOKING-TO-INVOICE WORKFLOW
// ============================================================================

/**
 * Create an invoice from a booking
 * This helper function streamlines the booking → invoice workflow by:
 * 1. Fetching the booking data
 * 2. Creating an invoice with aggregated cost items by category
 * 3. Linking the invoice to the booking
 * 4. Updating the booking with the invoice reference
 *
 * @param bookingId - ID of the booking to create invoice from
 * @param user - User creating the invoice (for activity logging)
 * @param companyId - Company ID (defaults to single-tenant mode)
 * @returns The created invoice document, or null if booking not found
 * @throws Error if invoice creation fails
 */
export async function createInvoiceFromBooking(
  bookingId: string,
  user: ActivityUser,
  companyId: string = DEFAULT_COMPANY_ID
): Promise<any | null> {
  try {
    // Import document service (lazy import to avoid circular dependencies)
    const { createDocument } = await import('../documents/documentService')

    // Step 1: Fetch the booking
    const booking = await getBooking(bookingId)
    if (!booking) {
      console.error(`Booking ${bookingId} not found`)
      return null
    }

    // Step 2: Aggregate cost items by category to create invoice line items
    const lineItems: any[] = []
    let lineNumber = 1

    // Helper to add category if it has items
    const addCategory = (categoryName: string, items: BookingCostItem[]) => {
      if (items && items.length > 0) {
        const categoryTotal = items.reduce((sum, item) => sum + (item.b2bTotal || 0), 0)
        if (categoryTotal > 0) {
          lineItems.push({
            id: lineNumber.toString(),
            description: categoryName,
            quantity: 1,
            unitPrice: categoryTotal,
            amount: categoryTotal,
          })
          lineNumber++
        }
      }
    }

    // Add all categories
    addCategory('Transportation', booking.transportation)
    addCategory('Meals', booking.meals)
    addCategory('Entrance Fees', booking.entranceFees)
    addCategory('Tour Guides', booking.tourGuides)
    addCategory('Flights', booking.flights)
    addCategory('Accommodation', booking.accommodation)
    addCategory('Other', booking.other)

    // Step 3: Determine currency and amount
    // Prefer MYR if available, otherwise use JPY
    const currency = booking.totalB2BCostMYR ? 'MYR' : 'JPY'
    const totalAmount = booking.totalB2BCostMYR || booking.totalB2BCostJPY

    // Calculate subtotal and tax (assume 0% tax by default)
    const subtotal = totalAmount
    const taxRate = 0
    const taxAmount = 0
    const total = totalAmount

    // Step 4: Create invoice date (today) and due date (30 days from now)
    const today = new Date()
    const invoiceDate = today.toISOString().split('T')[0]
    const dueDate = new Date(today.setDate(today.getDate() + 30)).toISOString().split('T')[0]

    // Step 5: Build invoice data
    const invoiceData = {
      documentType: 'invoice' as const,
      documentNumber: '', // Will be generated by createDocument
      status: 'draft' as const,
      date: invoiceDate,
      currency: currency as 'MYR' | 'JPY',
      country: 'Malaysia' as const,
      amount: totalAmount,
      subtotal,
      taxRate,
      taxAmount,
      total,
      notes: `Generated from booking ${booking.bookingNumber}`,

      // Invoice-specific fields
      customerName: booking.guestName,
      customerAddress: undefined,
      customerEmail: undefined,
      invoiceDate,
      dueDate,
      items: lineItems,
      paymentTerms: 'Net 30',
    }

    // Step 6: Create the invoice document
    const invoice = await createDocument(invoiceData, companyId, bookingId, user)

    // Step 7: Update booking with invoice reference
    await linkDocumentToBooking(bookingId, invoice.id)

    // Log activity (using generic booking:updated event since booking:invoice_created may not be defined)
    logBookingEvent('booking:updated', user, toActivityBookingInfo(booking), {
      action: 'invoice_created',
      invoiceId: invoice.id,
      invoiceNumber: invoice.documentNumber,
      amount: totalAmount,
      currency,
    })

    return invoice
  } catch (error) {
    console.error('Error creating invoice from booking:', error)
    throw new Error(`Failed to create invoice from booking: ${error}`)
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Sum internal totals from cost items
 */
function sumInternalTotal(items?: BookingCostItem[]): number {
  if (!items || items.length === 0) return 0
  return items.reduce((sum, item) => sum + (item.internalTotal || 0), 0)
}

/**
 * Sum B2B totals from cost items
 */
function sumB2BTotal(items?: BookingCostItem[]): number {
  if (!items || items.length === 0) return 0
  return items.reduce((sum, item) => sum + (item.b2bTotal || 0), 0)
}

/**
 * Calculate totals from cost items
 */
function calculateTotals(booking: Partial<Booking>) {
  const allItems: BookingCostItem[] = [
    ...(booking.transportation || []),
    ...(booking.meals || []),
    ...(booking.entranceFees || []),
    ...(booking.tourGuides || []),
    ...(booking.flights || []),
    ...(booking.accommodation || []),
    ...(booking.other || []),
  ]

  const totalInternalCostJPY = allItems.reduce((sum, item) => sum + (item.internalTotal || 0), 0)
  const totalB2BCostJPY = allItems.reduce((sum, item) => sum + (item.b2bTotal || 0), 0)
  const totalProfitJPY = totalB2BCostJPY - totalInternalCostJPY

  // Calculate MYR values if exchange rate is provided
  let totalInternalCostMYR: number | undefined
  let totalB2BCostMYR: number | undefined
  let totalProfitMYR: number | undefined

  const exchangeRate = booking.exchangeRate || 0.026
  if (exchangeRate > 0) {
    totalInternalCostMYR = totalInternalCostJPY * exchangeRate
    totalB2BCostMYR = totalB2BCostJPY * exchangeRate
    totalProfitMYR = totalProfitJPY * exchangeRate
  }

  // Calculate profit margin
  const profitMargin = totalB2BCostJPY > 0
    ? (totalProfitJPY / totalB2BCostJPY) * 100
    : 0

  return {
    totalInternalCostJPY,
    totalB2BCostJPY,
    totalProfitJPY,
    totalInternalCostMYR,
    totalB2BCostMYR,
    totalProfitMYR,
    profitMargin,
  }
}

/**
 * Convert database booking to Booking type
 * CRITICAL: Maps from ACTUAL web app database column names!
 */
function dbBookingToBooking(dbBooking: any): Booking {
  // Parse pax - could be number or string like "8A + 2CWB + 1TG"
  let pax = 0
  if (typeof dbBooking.number_of_pax === 'number') {
    pax = dbBooking.number_of_pax
  } else if (typeof dbBooking.number_of_pax === 'string') {
    // Try to extract total number from string like "8A + 2CWB + 1TG"
    const matches = dbBooking.number_of_pax.match(/\d+/g)
    if (matches) {
      pax = matches.reduce((sum: number, n: string) => sum + parseInt(n, 10), 0)
    }
  }

  // Get cost items from correct column names
  const transportationItems = dbBooking.transportation_items || []
  const mealsItems = dbBooking.meals_items || []
  const entranceItems = dbBooking.entrance_items || []
  const tourGuideItems = dbBooking.tour_guide_items || []
  const flightItems = dbBooking.flight_items || []
  const accommodationItems = dbBooking.accommodation_items || []

  // Calculate totals from items (more reliable than stored totals)
  const allItems = [
    ...transportationItems,
    ...mealsItems,
    ...entranceItems,
    ...tourGuideItems,
    ...flightItems,
    ...accommodationItems,
  ]

  const totalInternalCostJPY = allItems.reduce((sum: number, item: any) =>
    sum + (item.internalTotal || 0), 0)
  const totalB2BCostJPY = allItems.reduce((sum: number, item: any) =>
    sum + (item.b2bTotal || 0), 0)
  const totalProfitJPY = totalB2BCostJPY - totalInternalCostJPY

  const exchangeRate = Number(dbBooking.exchange_rate) || 0.026
  const profitMargin = totalB2BCostJPY > 0
    ? (totalProfitJPY / totalB2BCostJPY) * 100
    : 0

  return {
    id: dbBooking.id,
    bookingNumber: dbBooking.booking_code || '',
    guestName: dbBooking.guest_name || '',
    tripName: dbBooking.guest_name || '', // Web app uses guest_name as trip identifier
    startDate: dbBooking.trip_start_date || '',
    endDate: dbBooking.trip_end_date || '',
    pax,
    status: (dbBooking.status as BookingStatus) || 'draft',
    currency: 'JPY' as Currency,
    exchangeRate,

    // Cost categories from correct column names
    transportation: transportationItems,
    meals: mealsItems,
    entranceFees: entranceItems,
    tourGuides: tourGuideItems,
    flights: flightItems,
    accommodation: accommodationItems,
    other: [], // Web app doesn't have 'other' category in DB

    // Totals - calculate from items for accuracy
    totalInternalCostJPY,
    totalB2BCostJPY,
    totalProfitJPY,
    totalInternalCostMYR: Number(dbBooking.wif_cost) || (totalInternalCostJPY * exchangeRate),
    totalB2BCostMYR: Number(dbBooking.b2b_price) || (totalB2BCostJPY * exchangeRate),
    totalProfitMYR: Number(dbBooking.expected_profit) || (totalProfitJPY * exchangeRate),
    profitMargin,

    // Links
    linkedDocumentId: dbBooking.document_id || undefined,

    // Metadata
    notes: dbBooking.notes || undefined,
    createdBy: undefined,
    createdAt: dbBooking.created_at,
    updatedAt: dbBooking.updated_at,
  }
}

// ============================================================================
// CONCURRENCY & DATA INTEGRITY
// ============================================================================

/**
 * Check booking version for optimistic locking
 * Returns the current version info (updated_at timestamp) for a booking
 * @param bookingId - Booking ID to check
 * @returns Version info with updatedAt timestamp, or null if booking not found
 */
export async function checkBookingVersion(
  bookingId: string
): Promise<{ updatedAt: string; updatedBy?: string } | null> {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select('updated_at')
      .eq('id', bookingId)
      .eq('is_active', true)
      .maybeSingle()

    if (error) throw error
    if (!data) return null

    return {
      updatedAt: data.updated_at,
      updatedBy: undefined, // Could be extended if we track updated_by in the future
    }
  } catch (error) {
    console.error('Error checking booking version:', error)
    return null
  }
}

/**
 * Check if a booking is stale (has been updated since a known timestamp)
 * Used to detect if local data is out of sync with server
 * @param bookingId - Booking ID to check
 * @param lastKnownUpdatedAt - Last known updated_at timestamp (ISO 8601 format)
 * @returns true if booking has been updated since lastKnownUpdatedAt, false otherwise
 */
export async function isBookingStale(
  bookingId: string,
  lastKnownUpdatedAt: string
): Promise<boolean> {
  try {
    const currentVersion = await checkBookingVersion(bookingId)
    if (!currentVersion) return false // Booking doesn't exist or was deleted

    return currentVersion.updatedAt !== lastKnownUpdatedAt
  } catch (error) {
    console.error('Error checking if booking is stale:', error)
    return false
  }
}
