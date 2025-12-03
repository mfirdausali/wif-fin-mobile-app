/**
 * PDF Service Client
 *
 * Connects to pdf.wifjapan.com for PDF generation.
 * Transforms mobile booking data to web format expected by the API.
 */

import { File, Directory, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import Constants from 'expo-constants'
import type { Booking, BookingCostItem } from '../../types'

// Configuration for retry and timeout
const PDF_CONFIG = {
  timeout: 30000, // 30 seconds timeout
  maxRetries: 3,
  retryDelay: 1000, // 1 second initial delay
  retryMultiplier: 2, // Exponential backoff multiplier
}

/**
 * Convert base64 string to Uint8Array for file writing
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Fetch with timeout support using AbortController
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout: number
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    return response
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Fetch with retry logic and exponential backoff
 * Handles transient failures gracefully
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  config: typeof PDF_CONFIG
): Promise<Response> {
  let lastError: Error | null = null
  let delay = config.retryDelay

  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      console.log(`[Print PDF] Attempt ${attempt}/${config.maxRetries}`)
      const response = await fetchWithTimeout(url, options, config.timeout)

      if (response.status >= 500 && attempt < config.maxRetries) {
        console.warn(`[Print PDF] Server error ${response.status}, retrying...`)
        await sleep(delay)
        delay *= config.retryMultiplier
        continue
      }

      return response
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      if (attempt < config.maxRetries) {
        console.warn(`[Print PDF] Error on attempt ${attempt}, retrying...`)
        await sleep(delay)
        delay *= config.retryMultiplier
      }
    }
  }

  throw lastError || new Error('PDF request failed after all retries')
}

// PDF Service URL
const PDF_SERVICE_URL =
  Constants.expoConfig?.extra?.pdfServiceUrl ||
  process.env.EXPO_PUBLIC_PDF_SERVICE_URL ||
  'https://pdf.wifjapan.com'

// NOTE: Company info is fetched from Supabase by the PDF service
// Do NOT send companyInfo from mobile - let server fetch from single source of truth

export interface CompanyInfo {
  name: string
  address: string
  tel: string
  email: string
  registrationNo?: string
  registeredOffice?: string
}

export interface PrinterInfo {
  userName: string
  printDate: string // ISO timestamp
}

export interface BookingCardOptions {
  categories: string[]
  includePrices: boolean
  outputFormat: 'combined' | 'separate'
}

export interface BookingFormPrintOptions {
  pricingDisplay: 'none' | 'internal' | 'b2b' | 'both'
  includeNotes: boolean
  includeEmptyCategories: boolean
  showProfitMargin: boolean
  showExchangeRate: boolean
}

// Web API format types (matches pdf.wifjapan.com expectations)
interface WebBookingLineItem {
  date?: string
  description: string
  quantity: number
  internalPrice: number
  b2bPrice: number
  internalTotal: number
  b2bTotal: number
  profit: number
  notes?: string
}

interface WebBooking {
  id: string
  companyId: string
  bookingCode: string
  documentId?: string
  guestName: string
  tripStartDate: string
  tripEndDate?: string
  numberOfPax?: string
  country: string
  carTypes?: string[]
  transportationItems: WebBookingLineItem[]
  mealsItems: WebBookingLineItem[]
  entranceItems: WebBookingLineItem[]
  tourGuideItems: WebBookingLineItem[]
  flightItems: WebBookingLineItem[]
  accommodationItems: WebBookingLineItem[]
  transportationTotal: number
  mealsTotal: number
  entranceTotal: number
  tourGuideTotal: number
  flightTotal: number
  accommodationTotal: number
  transportationB2BTotal: number
  mealsB2BTotal: number
  entranceB2BTotal: number
  tourGuideB2BTotal: number
  flightB2BTotal: number
  accommodationB2BTotal: number
  grandTotalJpy: number
  grandTotalB2BJpy: number
  grandTotalMyr: number
  grandTotalB2BMyr: number
  exchangeRate: number
  wifCost: number
  b2bPrice: number
  expectedProfit: number
  status: string
  isActive: boolean
  notes?: string
  createdAt: string
  updatedAt: string
}

/**
 * Transform mobile BookingCostItem to web BookingLineItem
 */
function transformCostItem(item: BookingCostItem): WebBookingLineItem {
  return {
    description: item.description,
    quantity: item.quantity,
    internalPrice: item.internalPrice,
    b2bPrice: item.b2bPrice,
    internalTotal: item.internalTotal,
    b2bTotal: item.b2bTotal,
    profit: item.profit,
  }
}

/**
 * Calculate category totals
 */
function calculateCategoryTotals(items: BookingCostItem[]): { internal: number; b2b: number } {
  return items.reduce(
    (acc, item) => ({
      internal: acc.internal + (item.internalTotal || 0),
      b2b: acc.b2b + (item.b2bTotal || 0),
    }),
    { internal: 0, b2b: 0 }
  )
}

/**
 * Transform mobile Booking to web Booking format for API
 */
export function transformBookingForAPI(booking: Booking): WebBooking {
  // Transform all cost items
  const transportationItems = (booking.transportation || []).map(transformCostItem)
  const mealsItems = (booking.meals || []).map(transformCostItem)
  const entranceItems = (booking.entranceFees || []).map(transformCostItem)
  const tourGuideItems = (booking.tourGuides || []).map(transformCostItem)
  const flightItems = (booking.flights || []).map(transformCostItem)
  const accommodationItems = (booking.accommodation || []).map(transformCostItem)

  // Calculate category totals
  const transportationTotals = calculateCategoryTotals(booking.transportation || [])
  const mealsTotals = calculateCategoryTotals(booking.meals || [])
  const entranceTotals = calculateCategoryTotals(booking.entranceFees || [])
  const tourGuideTotals = calculateCategoryTotals(booking.tourGuides || [])
  const flightTotals = calculateCategoryTotals(booking.flights || [])
  const accommodationTotals = calculateCategoryTotals(booking.accommodation || [])

  // Calculate exchange rate (default to 0.03 if not provided)
  const exchangeRate = booking.exchangeRate || 0.03

  return {
    id: booking.id,
    companyId: 'wif-mobile', // Identify as mobile source
    bookingCode: booking.bookingNumber,
    documentId: booking.linkedDocumentId,
    guestName: booking.guestName,
    tripStartDate: booking.startDate,
    tripEndDate: booking.endDate || undefined,
    numberOfPax: String(booking.pax || ''),
    country: 'Japan', // Default for this app
    transportationItems,
    mealsItems,
    entranceItems,
    tourGuideItems,
    flightItems,
    accommodationItems,
    transportationTotal: transportationTotals.internal,
    mealsTotal: mealsTotals.internal,
    entranceTotal: entranceTotals.internal,
    tourGuideTotal: tourGuideTotals.internal,
    flightTotal: flightTotals.internal,
    accommodationTotal: accommodationTotals.internal,
    transportationB2BTotal: transportationTotals.b2b,
    mealsB2BTotal: mealsTotals.b2b,
    entranceB2BTotal: entranceTotals.b2b,
    tourGuideB2BTotal: tourGuideTotals.b2b,
    flightB2BTotal: flightTotals.b2b,
    accommodationB2BTotal: accommodationTotals.b2b,
    grandTotalJpy: booking.totalInternalCostJPY,
    grandTotalB2BJpy: booking.totalB2BCostJPY,
    grandTotalMyr: booking.totalInternalCostMYR || booking.totalInternalCostJPY * exchangeRate,
    grandTotalB2BMyr: booking.totalB2BCostMYR || booking.totalB2BCostJPY * exchangeRate,
    exchangeRate,
    wifCost: booking.totalInternalCostMYR || booking.totalInternalCostJPY * exchangeRate,
    b2bPrice: booking.totalB2BCostMYR || booking.totalB2BCostJPY * exchangeRate,
    expectedProfit: booking.totalProfitMYR || booking.totalProfitJPY * exchangeRate,
    status: booking.status,
    isActive: booking.status !== 'cancelled',
    notes: booking.notes,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
  }
}

/**
 * Map mobile category keys to web API category keys
 */
export const CATEGORY_KEY_MAP: Record<string, string> = {
  transportation: 'transportation',
  meals: 'meals',
  entrance_fees: 'entrance',
  tour_guides: 'tourGuide',
  flights: 'flights',
  accommodation: 'accommodation',
  other: 'other',
}

/**
 * Reverse map for getting items from mobile booking
 */
export const MOBILE_CATEGORY_KEYS: Record<string, keyof Booking> = {
  transportation: 'transportation',
  meals: 'meals',
  entrance_fees: 'entranceFees',
  tour_guides: 'tourGuides',
  flights: 'flights',
  accommodation: 'accommodation',
  other: 'other',
}

/**
 * Category display labels
 */
export const CATEGORY_LABELS: Record<string, string> = {
  transportation: 'Transportation',
  meals: 'Meals / Restaurant',
  entrance_fees: 'Entrance Fees',
  tour_guides: 'Tour Guide',
  flights: 'Flights',
  accommodation: 'Accommodation',
  other: 'Other',
}

export interface PDFResult {
  success: boolean
  filename?: string
  filePath?: string
  error?: string
}

export interface MultiplePDFResult {
  success: boolean
  files?: { filename: string; filePath: string }[]
  error?: string
}

/**
 * PDF Service class for interacting with pdf.wifjapan.com
 */
export class PdfService {
  /**
   * Check if PDF service is available
   */
  static async checkHealth(): Promise<boolean> {
    try {
      const response = await fetchWithTimeout(
        `${PDF_SERVICE_URL}/health`,
        { method: 'GET' },
        5000 // 5 second timeout for health check
      )
      return response.ok
    } catch {
      return false
    }
  }

  /**
   * Generate and download booking card PDFs
   */
  static async generateBookingCards(
    booking: Booking,
    options: BookingCardOptions,
    _companyInfo?: CompanyInfo, // Ignored - server fetches from Supabase
    printerInfo?: PrinterInfo
  ): Promise<PDFResult | MultiplePDFResult> {
    try {
      // Transform booking to web format
      const webBooking = transformBookingForAPI(booking)

      // Map mobile category keys to web API keys
      const apiCategories = options.categories.map(
        (cat) => CATEGORY_KEY_MAP[cat] || cat
      )

      // Get device timezone
      const deviceTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone

      // Prepare printer info with device date/time
      const finalPrinterInfo = {
        userName: printerInfo?.userName || 'Mobile User',
        printDate: new Date().toISOString(),
        timezone: deviceTimezone,
      }

      // NOTE: companyInfo is NOT sent - server will fetch from Supabase (single source of truth)
      const response = await fetchWithRetry(
        `${PDF_SERVICE_URL}/api/pdf/booking-card`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            booking: webBooking,
            categories: apiCategories,
            includePrices: options.includePrices,
            outputFormat: options.outputFormat,
            // companyInfo: undefined - let server fetch from Supabase
            printerInfo: finalPrinterInfo,
          }),
        },
        PDF_CONFIG
      )

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }))
        return {
          success: false,
          error: error.error || `HTTP ${response.status}`,
        }
      }

      const contentType = response.headers.get('Content-Type')
      console.log(`PDF response content-type: ${contentType}`)

      if (contentType?.includes('application/pdf')) {
        // Single PDF (combined output or single category)
        console.log('Processing single PDF response')
        return await this.handleSinglePDF(response, booking.bookingNumber)
      } else if (contentType?.includes('application/json')) {
        // Multiple separate PDFs
        console.log('Processing multiple PDFs response')
        return await this.handleMultiplePDFs(response, booking.bookingNumber)
      }

      console.error('Unexpected response content-type:', contentType)
      return {
        success: false,
        error: 'Unexpected response format',
      }
    } catch (error) {
      console.error('PDF generation error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Generate and download booking form PDF
   */
  static async downloadBookingForm(
    booking: Booking,
    options: BookingFormPrintOptions,
    _companyInfo?: CompanyInfo, // Ignored - server fetches from Supabase
    printerInfo?: PrinterInfo
  ): Promise<PDFResult> {
    try {
      // Transform booking to web format
      const webBooking = transformBookingForAPI(booking)

      // Get device timezone
      const deviceTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone

      // Prepare printer info with device date/time
      const finalPrinterInfo = {
        userName: printerInfo?.userName || 'Mobile User',
        printDate: new Date().toISOString(), // Device's current date/time
        timezone: deviceTimezone,
      }

      // Prepare request body
      // NOTE: companyInfo is NOT sent - server will fetch from Supabase (single source of truth)
      const requestBody = {
        booking: webBooking,
        options: {
          pricingDisplay: options.pricingDisplay,
          includeNotes: options.includeNotes,
          includeEmptyCategories: options.includeEmptyCategories,
          showProfitMargin: options.showProfitMargin,
          showExchangeRate: options.showExchangeRate,
          paperSize: 'a4',
          orientation: 'portrait',
        },
        // companyInfo: undefined - let server fetch from Supabase
        printerInfo: finalPrinterInfo,
      }

      console.log('Requesting booking form PDF from:', `${PDF_SERVICE_URL}/api/pdf/booking-form`)

      const response = await fetchWithRetry(
        `${PDF_SERVICE_URL}/api/pdf/booking-form`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        },
        PDF_CONFIG
      )

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }))
        return {
          success: false,
          error: error.error || `HTTP ${response.status}`,
        }
      }

      const contentType = response.headers.get('Content-Type')
      console.log(`Booking form PDF response content-type: ${contentType}`)

      if (contentType?.includes('application/pdf')) {
        // Handle PDF response
        console.log('Processing booking form PDF response')
        return await this.handleSinglePDF(response, booking.bookingNumber, 'booking-form')
      }

      console.error('Unexpected response content-type:', contentType)
      return {
        success: false,
        error: 'Unexpected response format',
      }
    } catch (error) {
      console.error('Booking form PDF generation error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Handle single PDF response (combined output or single category)
   */
  private static async handleSinglePDF(
    response: Response,
    bookingNumber: string,
    filePrefix: string = 'booking-card'
  ): Promise<PDFResult> {
    try {
      const blob = await response.blob()
      const filename = `${filePrefix}-${bookingNumber}.pdf`

      // Convert blob to base64
      const reader = new FileReader()
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string
          // Remove data URL prefix
          const base64Data = result.split(',')[1]
          resolve(base64Data)
        }
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })

      // Convert base64 to bytes and write using new File API
      const bytes = base64ToUint8Array(base64)
      const file = new File(Paths.cache, filename)
      await file.write(bytes)

      console.log(`PDF saved successfully: ${filename} at ${file.uri}`)

      return {
        success: true,
        filename,
        filePath: file.uri,
      }
    } catch (error) {
      console.error('Error saving single PDF:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save PDF',
      }
    }
  }

  /**
   * Handle multiple PDFs response (separate output)
   */
  private static async handleMultiplePDFs(
    response: Response,
    bookingNumber: string
  ): Promise<MultiplePDFResult> {
    try {
      const data = await response.json()

      if (!data.pdfs || !Array.isArray(data.pdfs)) {
        return {
          success: false,
          error: 'Invalid response format',
        }
      }

      const files: { filename: string; filePath: string }[] = []

      for (const pdf of data.pdfs) {
        // Convert base64 to bytes and write using new File API
        const bytes = base64ToUint8Array(pdf.data)
        const file = new File(Paths.cache, pdf.filename)
        await file.write(bytes)

        files.push({
          filename: pdf.filename,
          filePath: file.uri,
        })
      }

      return {
        success: true,
        files,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save PDFs',
      }
    }
  }

  /**
   * Share a PDF file
   */
  static async sharePDF(filePath: string): Promise<boolean> {
    try {
      const isAvailable = await Sharing.isAvailableAsync()
      if (!isAvailable) {
        console.error('Sharing is not available on this platform')
        return false
      }

      await Sharing.shareAsync(filePath, {
        mimeType: 'application/pdf',
        dialogTitle: 'Share Booking Card',
      })

      // Clean up old PDFs after successful share
      await this.cleanupTempFiles()

      return true
    } catch (error) {
      console.error('Share error:', error)
      return false
    }
  }

  /**
   * Share multiple PDF files
   */
  static async shareMultiplePDFs(
    files: { filename: string; filePath: string }[]
  ): Promise<boolean> {
    try {
      const isAvailable = await Sharing.isAvailableAsync()
      if (!isAvailable) {
        console.error('Sharing is not available on this platform')
        return false
      }

      // Share files one by one (most platforms don't support multi-file sharing)
      for (const file of files) {
        await Sharing.shareAsync(file.filePath, {
          mimeType: 'application/pdf',
          dialogTitle: `Share ${file.filename}`,
        })
      }

      // Clean up old PDFs after successful share
      await this.cleanupTempFiles()

      return true
    } catch (error) {
      console.error('Share error:', error)
      return false
    }
  }

  /**
   * Clean up temporary PDF files
   */
  static async cleanupTempFiles(): Promise<void> {
    try {
      const cacheDir = new Directory(Paths.cache)
      const entries = await cacheDir.list()

      for (const entry of entries) {
        if (entry instanceof File && entry.uri.endsWith('.pdf')) {
          await entry.delete()
        }
      }
    } catch (error) {
      console.error('Cleanup error:', error)
    }
  }
}

/**
 * Get categories with item counts from a booking
 */
export function getCategoriesWithCounts(
  booking: Booking
): { key: string; label: string; count: number }[] {
  return Object.keys(CATEGORY_LABELS).map((key) => {
    const itemsKey = MOBILE_CATEGORY_KEYS[key]
    const items = itemsKey ? booking[itemsKey] : []
    return {
      key,
      label: CATEGORY_LABELS[key],
      count: Array.isArray(items) ? items.length : 0,
    }
  })
}
