/**
 * Formatting utilities for display
 */

import { format, parseISO, isValid } from 'date-fns'

/**
 * Format a currency amount with symbol
 * @param amount - Amount to format
 * @param currency - Currency code (MYR, JPY, USD, etc.)
 * @returns Formatted currency string
 */
export function formatCurrency(amount: number, currency: string = 'MYR'): string {
  // Handle invalid numbers
  if (isNaN(amount) || amount === null || amount === undefined) {
    amount = 0
  }

  const symbols: Record<string, string> = {
    MYR: 'RM',
    JPY: '¥',
    USD: '$',
    SGD: 'S$',
  }

  const symbol = symbols[currency] || currency + ' '

  if (currency === 'JPY') {
    // JPY has no decimal places
    const rounded = Math.round(amount)
    const formatted = rounded.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
    return `${symbol}${formatted}`
  } else {
    // Other currencies have 2 decimal places
    const formatted = amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    return `${symbol} ${formatted}`
  }
}

/**
 * Format a date string for display
 * @param dateString - ISO date string or Date object
 * @param formatStr - date-fns format string (default: 'dd MMM yyyy')
 * @returns Formatted date string
 */
export function formatDate(dateString: string | Date | null | undefined, formatStr: string = 'dd MMM yyyy'): string {
  if (!dateString) return '-'

  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : dateString
    if (!isValid(date)) return '-'
    return format(date, formatStr)
  } catch {
    return '-'
  }
}

/**
 * Format a date for short display (e.g., in tables)
 * @param dateString - ISO date string
 * @returns Formatted short date string
 */
export function formatDateShort(dateString: string | null | undefined): string {
  return formatDate(dateString, 'dd/MM/yyyy')
}

/**
 * Format a date with time
 * @param dateString - ISO date string
 * @returns Formatted date and time string
 */
export function formatDateTime(dateString: string | null | undefined): string {
  return formatDate(dateString, 'dd MMM yyyy, HH:mm')
}
