/**
 * Booking Types - Matches web app exactly
 *
 * Booking forms for trip cost management:
 * - Track internal (WIF) costs vs B2B prices
 * - Calculate profit margins
 * - Multi-currency support (JPY → MYR conversion)
 */

import { Currency } from './document'

export type BookingStatus = 'draft' | 'planning' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'

export type CostCategory =
  | 'transportation'
  | 'meals'
  | 'entrance_fees'
  | 'tour_guides'
  | 'flights'
  | 'accommodation'
  | 'other'

/**
 * A line item in a booking cost category
 * Matches web app's BookingLineItem type
 */
export interface BookingCostItem {
  id: string
  date?: string // Optional date for this line item
  description: string
  quantity: number
  internalPrice: number // WIF cost per unit (JPY)
  b2bPrice: number // Price charged to B2B partner per unit (JPY)
  internalTotal: number // quantity * internalPrice
  b2bTotal: number // quantity * b2bPrice
  profit: number // b2bTotal - internalTotal
  notes?: string // Optional notes for this line item
}

/**
 * Cost breakdown by category
 */
export interface BookingCostCategory {
  category: CostCategory
  items: BookingCostItem[]
  internalTotal: number
  b2bTotal: number
  profit: number
}

/**
 * Complete booking form
 * Matches web app structure - uses guestName as primary identifier
 */
export interface Booking {
  id: string
  bookingNumber: string
  guestName: string // Customer/guest name (also serves as trip identifier)
  startDate: string
  endDate: string
  pax: number // Number of participants
  status: BookingStatus
  currency: Currency
  exchangeRate?: number // JPY to MYR

  // Cost categories
  transportation: BookingCostItem[]
  meals: BookingCostItem[]
  entranceFees: BookingCostItem[]
  tourGuides: BookingCostItem[]
  flights: BookingCostItem[]
  accommodation: BookingCostItem[]
  other: BookingCostItem[]

  // Calculated totals (in JPY)
  totalInternalCostJPY: number
  totalB2BCostJPY: number
  totalProfitJPY: number

  // Converted totals (in MYR)
  totalInternalCostMYR?: number
  totalB2BCostMYR?: number
  totalProfitMYR?: number

  // Profit margin percentage
  profitMargin: number

  // Linked document
  linkedDocumentId?: string

  // Metadata
  notes?: string
  createdBy?: string
  createdAt: string
  updatedAt: string
}

/**
 * Booking status display names
 */
export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  draft: 'Draft',
  planning: 'Planning',
  confirmed: 'Confirmed',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

/**
 * Booking status colors for UI
 */
export const BOOKING_STATUS_COLORS: Record<BookingStatus, string> = {
  draft: '#8E8E93',
  planning: '#FF9500',
  confirmed: '#007AFF',
  in_progress: '#5856D6',
  completed: '#34C759',
  cancelled: '#FF3B30',
}

/**
 * Cost category display names
 */
export const COST_CATEGORY_LABELS: Record<CostCategory, string> = {
  transportation: 'Transportation',
  meals: 'Meals',
  entrance_fees: 'Entrance Fees',
  tour_guides: 'Tour Guides',
  flights: 'Flights',
  accommodation: 'Accommodation',
  other: 'Other',
}

/**
 * Calculate line item totals
 */
export function calculateItemTotals(item: Omit<BookingCostItem, 'internalTotal' | 'b2bTotal' | 'profit'>): BookingCostItem {
  const internalTotal = item.quantity * item.internalPrice
  const b2bTotal = item.quantity * item.b2bPrice
  const profit = b2bTotal - internalTotal

  return {
    ...item,
    internalTotal,
    b2bTotal,
    profit,
  }
}

/**
 * Calculate category totals
 */
export function calculateCategoryTotals(items: BookingCostItem[]): {
  internalTotal: number
  b2bTotal: number
  profit: number
} {
  return items.reduce(
    (acc, item) => ({
      internalTotal: acc.internalTotal + item.internalTotal,
      b2bTotal: acc.b2bTotal + item.b2bTotal,
      profit: acc.profit + item.profit,
    }),
    { internalTotal: 0, b2bTotal: 0, profit: 0 }
  )
}

/**
 * Calculate booking grand totals
 */
export function calculateBookingTotals(booking: Partial<Booking>): {
  totalInternalCostJPY: number
  totalB2BCostJPY: number
  totalProfitJPY: number
  totalInternalCostMYR?: number
  totalB2BCostMYR?: number
  totalProfitMYR?: number
  profitMargin: number
} {
  const categories = [
    booking.transportation || [],
    booking.meals || [],
    booking.entranceFees || [],
    booking.tourGuides || [],
    booking.flights || [],
    booking.accommodation || [],
    booking.other || [],
  ]

  const totals = categories.reduce(
    (acc, items) => {
      const categoryTotals = calculateCategoryTotals(items)
      return {
        internalTotal: acc.internalTotal + categoryTotals.internalTotal,
        b2bTotal: acc.b2bTotal + categoryTotals.b2bTotal,
        profit: acc.profit + categoryTotals.profit,
      }
    },
    { internalTotal: 0, b2bTotal: 0, profit: 0 }
  )

  const profitMargin = totals.b2bTotal > 0 ? (totals.profit / totals.b2bTotal) * 100 : 0

  const result: ReturnType<typeof calculateBookingTotals> = {
    totalInternalCostJPY: totals.internalTotal,
    totalB2BCostJPY: totals.b2bTotal,
    totalProfitJPY: totals.profit,
    profitMargin,
  }

  // Convert to MYR if exchange rate is provided
  // Exchange rate represents: 1 JPY = X MYR (e.g., 0.0385)
  // Therefore: JPY amount × exchange rate = MYR amount
  if (booking.exchangeRate && booking.exchangeRate > 0) {
    result.totalInternalCostMYR = totals.internalTotal * booking.exchangeRate
    result.totalB2BCostMYR = totals.b2bTotal * booking.exchangeRate
    result.totalProfitMYR = totals.profit * booking.exchangeRate
  }

  return result
}

/**
 * Create empty booking cost item
 */
export function createEmptyCostItem(): BookingCostItem {
  return {
    id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    description: '',
    quantity: 1,
    internalPrice: 0,
    b2bPrice: 0,
    internalTotal: 0,
    b2bTotal: 0,
    profit: 0,
  }
}
