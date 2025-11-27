/**
 * Number Utilities
 *
 * Safe number parsing and formatting utilities for WIF Finance
 * Handles edge cases: null, undefined, NaN, Infinity, invalid strings
 */

import { Currency } from '../types/document'

/**
 * Safely parse any value to a number with fallback to default
 *
 * @param value - Any value to parse as number
 * @param defaultValue - Default value if parsing fails (default: 0)
 * @returns Parsed number or default value
 *
 * @example
 * safeParseNumber('123') // 123
 * safeParseNumber('123.45') // 123.45
 * safeParseNumber('invalid') // 0
 * safeParseNumber(null) // 0
 * safeParseNumber(undefined) // 0
 * safeParseNumber(NaN) // 0
 * safeParseNumber(Infinity) // 0
 * safeParseNumber('42', 10) // 42
 * safeParseNumber('invalid', 10) // 10
 */
export function safeParseNumber(value: any, defaultValue: number = 0): number {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return defaultValue
  }

  // If already a number, check for NaN and Infinity
  if (typeof value === 'number') {
    if (isNaN(value) || !isFinite(value)) {
      return defaultValue
    }
    return value
  }

  // Try to parse string/other types
  if (typeof value === 'string') {
    // Remove whitespace and common currency symbols
    const cleaned = value.trim().replace(/[,\s$¥RM]/g, '')

    // Empty string after cleaning
    if (cleaned === '') {
      return defaultValue
    }

    const parsed = parseFloat(cleaned)
    if (isNaN(parsed) || !isFinite(parsed)) {
      return defaultValue
    }
    return parsed
  }

  // Boolean conversion (true = 1, false = 0)
  if (typeof value === 'boolean') {
    return value ? 1 : 0
  }

  // For any other type, return default
  return defaultValue
}

/**
 * Safely parse a value to a number with specific decimal places
 *
 * @param value - Any value to parse as decimal
 * @param decimals - Number of decimal places (default: 2)
 * @returns Parsed decimal number rounded to specified places
 *
 * @example
 * safeParseDecimal('123.456') // 123.46 (rounded to 2 decimals)
 * safeParseDecimal('123.456', 1) // 123.5
 * safeParseDecimal('123.456', 0) // 123
 * safeParseDecimal('invalid') // 0.00
 * safeParseDecimal(123.9999, 2) // 124.00
 */
export function safeParseDecimal(value: any, decimals: number = 2): number {
  const parsed = safeParseNumber(value, 0)
  const multiplier = Math.pow(10, decimals)
  return Math.round(parsed * multiplier) / multiplier
}

/**
 * Format a number as currency string
 *
 * @param amount - Amount to format
 * @param currency - Currency code ('MYR' or 'JPY')
 * @returns Formatted currency string
 *
 * @example
 * formatCurrency(1234.56, 'MYR') // 'RM 1,234.56'
 * formatCurrency(1234.56, 'JPY') // '¥1,235' (JPY has no decimals)
 * formatCurrency(0, 'MYR') // 'RM 0.00'
 * formatCurrency(-500, 'MYR') // 'RM -500.00'
 * formatCurrency(NaN, 'MYR') // 'RM 0.00'
 */
export function formatCurrency(amount: number, currency: 'MYR' | 'JPY'): string {
  // Handle invalid numbers
  const safeAmount = safeParseNumber(amount, 0)

  if (currency === 'JPY') {
    // JPY has no decimal places
    const rounded = Math.round(safeAmount)
    const formatted = rounded.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
    return `¥${formatted}`
  } else {
    // MYR has 2 decimal places
    const formatted = safeAmount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    return `RM ${formatted}`
  }
}

/**
 * Parse a pax string to extract total number of participants
 * Handles various formats like "8A + 2CWB", "10 adults", "5", etc.
 *
 * @param paxString - String describing number of participants
 * @returns Total number of participants
 *
 * @example
 * parsePaxString('8A + 2CWB') // 10
 * parsePaxString('8 A + 2 CWB') // 10
 * parsePaxString('10 adults') // 10
 * parsePaxString('5') // 5
 * parsePaxString('2A + 1C + 1I') // 4
 * parsePaxString('invalid') // 0
 * parsePaxString('') // 0
 * parsePaxString(null) // 0
 */
export function parsePaxString(paxString: string): number {
  if (!paxString || typeof paxString !== 'string') {
    return 0
  }

  const cleaned = paxString.trim()
  if (cleaned === '') {
    return 0
  }

  // Try parsing as simple number first
  const simpleNumber = parseInt(cleaned, 10)
  if (!isNaN(simpleNumber) && simpleNumber > 0) {
    return simpleNumber
  }

  // Extract all numbers from the string and sum them
  // Pattern matches numbers that may be followed by letters (like "8A", "2CWB")
  const numberPattern = /(\d+)\s*[A-Za-z]*/g
  const matches = cleaned.matchAll(numberPattern)

  let total = 0
  for (const match of matches) {
    const num = parseInt(match[1], 10)
    if (!isNaN(num)) {
      total += num
    }
  }

  return total
}

/**
 * Calculate percentage with safe division (handles division by zero)
 *
 * @param part - The part value
 * @param whole - The whole value
 * @param decimals - Number of decimal places (default: 2)
 * @returns Percentage value (0-100), or 0 if whole is 0
 *
 * @example
 * calculatePercentage(25, 100) // 25.00
 * calculatePercentage(1, 3) // 33.33
 * calculatePercentage(50, 0) // 0 (safe division by zero)
 * calculatePercentage(50, 200, 1) // 25.0
 */
export function calculatePercentage(part: number, whole: number, decimals: number = 2): number {
  const safePart = safeParseNumber(part, 0)
  const safeWhole = safeParseNumber(whole, 0)

  if (safeWhole === 0) {
    return 0
  }

  const percentage = (safePart / safeWhole) * 100
  return safeParseDecimal(percentage, decimals)
}

/**
 * Add multiple numbers safely, handling NaN and invalid values
 *
 * @param numbers - Array of numbers to add
 * @returns Sum of all valid numbers
 *
 * @example
 * safeAdd([1, 2, 3]) // 6
 * safeAdd([1, NaN, 3]) // 4
 * safeAdd([1, null, 3]) // 4
 * safeAdd([]) // 0
 */
export function safeAdd(...numbers: any[]): number {
  return numbers.reduce((sum, num) => sum + safeParseNumber(num, 0), 0)
}

/**
 * Multiply numbers safely, handling NaN and invalid values
 *
 * @param a - First number
 * @param b - Second number
 * @param decimals - Number of decimal places (default: 2)
 * @returns Product of the two numbers
 *
 * @example
 * safeMultiply(5, 3) // 15.00
 * safeMultiply(5.5, 2) // 11.00
 * safeMultiply(NaN, 5) // 0.00
 * safeMultiply(5, null) // 0.00
 */
export function safeMultiply(a: any, b: any, decimals: number = 2): number {
  const safeA = safeParseNumber(a, 0)
  const safeB = safeParseNumber(b, 0)
  return safeParseDecimal(safeA * safeB, decimals)
}

/**
 * Divide numbers safely, handling division by zero, NaN, and invalid values
 *
 * @param numerator - The numerator
 * @param denominator - The denominator
 * @param decimals - Number of decimal places (default: 2)
 * @returns Result of division, or 0 if denominator is 0
 *
 * @example
 * safeDivide(10, 2) // 5.00
 * safeDivide(10, 3) // 3.33
 * safeDivide(10, 0) // 0.00 (safe division by zero)
 * safeDivide(NaN, 5) // 0.00
 * safeDivide(10, null) // 0.00
 */
export function safeDivide(numerator: any, denominator: any, decimals: number = 2): number {
  const safeNumerator = safeParseNumber(numerator, 0)
  const safeDenominator = safeParseNumber(denominator, 0)

  if (safeDenominator === 0) {
    return 0
  }

  return safeParseDecimal(safeNumerator / safeDenominator, decimals)
}

/**
 * Clamp a number between min and max values
 *
 * @param value - Value to clamp
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns Clamped value
 *
 * @example
 * clamp(5, 0, 10) // 5
 * clamp(-5, 0, 10) // 0
 * clamp(15, 0, 10) // 10
 * clamp(NaN, 0, 10) // 0
 */
export function clamp(value: number, min: number, max: number): number {
  const safeValue = safeParseNumber(value, min)
  const safeMin = safeParseNumber(min, 0)
  const safeMax = safeParseNumber(max, 0)

  return Math.min(Math.max(safeValue, safeMin), safeMax)
}

/**
 * Check if a number is within a range (inclusive)
 *
 * @param value - Value to check
 * @param min - Minimum value (inclusive)
 * @param max - Maximum value (inclusive)
 * @returns True if value is within range
 *
 * @example
 * isInRange(5, 0, 10) // true
 * isInRange(0, 0, 10) // true
 * isInRange(10, 0, 10) // true
 * isInRange(-1, 0, 10) // false
 * isInRange(11, 0, 10) // false
 */
export function isInRange(value: number, min: number, max: number): boolean {
  const safeValue = safeParseNumber(value, min - 1) // Default outside range
  const safeMin = safeParseNumber(min, 0)
  const safeMax = safeParseNumber(max, 0)

  return safeValue >= safeMin && safeValue <= safeMax
}
