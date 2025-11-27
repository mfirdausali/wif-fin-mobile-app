/**
 * PDF Service for generating and sharing document PDFs
 * Uses the same PDF backend as the web app
 *
 * Automatically fetches company info from Supabase before generating PDFs
 */

import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import Constants from 'expo-constants'
import type { Document } from '../../types'
import { getCompanyInfo, type CompanyInfo } from '../company/companyService'
import { logDocumentEvent } from '../activity/activityLogService'
import type { ActivityUser } from '../../types/activity'

// Get PDF service URL from config (same as web app)
const PDF_SERVICE_URL = Constants.expoConfig?.extra?.pdfServiceUrl || 'https://pdf.wifjapan.com'

// Configuration for retry and timeout
const PDF_CONFIG = {
  timeout: 30000, // 30 seconds timeout
  maxRetries: 3,
  retryDelay: 1000, // 1 second initial delay
  retryMultiplier: 2, // Exponential backoff multiplier
}

// Re-export CompanyInfo for convenience
export type { CompanyInfo }

export interface PrinterInfo {
  userName: string
  printDate: string // ISO timestamp
}

/**
 * Get API endpoint for document type
 */
function getEndpointForDocumentType(documentType: string): string {
  switch (documentType) {
    case 'invoice':
      return '/api/pdf/invoice'
    case 'receipt':
      return '/api/pdf/receipt'
    case 'payment_voucher':
      return '/api/pdf/payment-voucher'
    case 'statement_of_payment':
      return '/api/pdf/statement-of-payment'
    default:
      throw new Error(`Unknown document type: ${documentType}`)
  }
}

/**
 * Get data key for request body
 */
function getDataKeyForDocumentType(documentType: string): string {
  switch (documentType) {
    case 'invoice':
      return 'invoice'
    case 'receipt':
      return 'receipt'
    case 'payment_voucher':
      return 'paymentVoucher'
    case 'statement_of_payment':
      return 'statementOfPayment'
    default:
      throw new Error(`Unknown document type: ${documentType}`)
  }
}

/**
 * Convert base64 string to Uint8Array (for writing binary files)
 */
function base64ToBytes(base64: string): Uint8Array {
  const binaryString = atob(base64)
  const len = binaryString.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
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
  config: {
    maxRetries: number
    timeout: number
    retryDelay: number
    retryMultiplier: number
  }
): Promise<Response> {
  let lastError: Error | null = null
  let delay = config.retryDelay

  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      console.log(`[PDF] Attempt ${attempt}/${config.maxRetries} to ${url}`)
      const response = await fetchWithTimeout(url, options, config.timeout)

      // Retry on 5xx server errors
      if (response.status >= 500 && attempt < config.maxRetries) {
        console.warn(`[PDF] Server error ${response.status}, retrying in ${delay}ms...`)
        await sleep(delay)
        delay *= config.retryMultiplier
        continue
      }

      return response
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Check if it's an abort error (timeout)
      const isTimeout = lastError.name === 'AbortError'
      const errorType = isTimeout ? 'Timeout' : 'Network error'

      if (attempt < config.maxRetries) {
        console.warn(`[PDF] ${errorType} on attempt ${attempt}, retrying in ${delay}ms...`, lastError.message)
        await sleep(delay)
        delay *= config.retryMultiplier
      } else {
        console.error(`[PDF] ${errorType} on final attempt ${attempt}:`, lastError.message)
      }
    }
  }

  throw lastError || new Error('PDF request failed after all retries')
}

/**
 * Generate PDF and return local file path
 * Automatically fetches company info from Supabase if not provided
 * Features:
 * - 30 second timeout per request
 * - 3 retries with exponential backoff (1s, 2s, 4s)
 * - Automatic retry on 5xx server errors and network failures
 * @param documentData - Document to generate PDF for
 * @param companyInfo - Optional company info (fetched from Supabase if not provided)
 * @param printerInfo - Optional printer info
 * @param user - Optional user for activity logging
 */
export async function generatePDF(
  documentData: Document,
  companyInfo?: CompanyInfo,
  printerInfo?: PrinterInfo,
  user?: ActivityUser
): Promise<string> {
  const endpoint = getEndpointForDocumentType(documentData.documentType)
  const dataKey = getDataKeyForDocumentType(documentData.documentType)
  const url = `${PDF_SERVICE_URL}${endpoint}`

  try {
    // Fetch company info from Supabase if not provided
    const resolvedCompanyInfo = companyInfo || await getCompanyInfo()

    console.log('[PDF] Generating PDF with company info:', resolvedCompanyInfo.name)
    console.log(`[PDF] Request URL: ${url}`)

    // Make POST request with timeout and retry logic
    const response = await fetchWithRetry(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          [dataKey]: documentData,
          companyInfo: resolvedCompanyInfo,
          printerInfo,
        }),
      },
      PDF_CONFIG
    )

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(error.error || `HTTP ${response.status}`)
    }

    // Get blob and convert to base64 using FileReader (React Native compatible)
    const blob = await response.blob()
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          // Remove data URL prefix (e.g., "data:application/pdf;base64,")
          const base64 = reader.result.split(',')[1]
          resolve(base64)
        } else {
          reject(new Error('Failed to convert blob to base64'))
        }
      }
      reader.onerror = () => reject(new Error('FileReader error'))
      reader.readAsDataURL(blob)
    })

    // Save to cache directory using new expo-file-system v19 File API
    const fileName = `${documentData.documentType}-${documentData.documentNumber}.pdf`
    const file = new File(Paths.cache, fileName)

    // Convert base64 to bytes and write to file
    // Note: Native iOS module only accepts 1 argument for write()
    const bytes = base64ToBytes(base64Data)
    file.write(bytes)

    // Log activity if user is provided
    if (user) {
      logDocumentEvent('document:printed', user, {
        id: documentData.id,
        documentNumber: documentData.documentNumber,
        documentType: documentData.documentType,
        status: documentData.status,
      }, {
        printedBy: printerInfo?.userName,
        printDate: printerInfo?.printDate || new Date().toISOString(),
        fileName,
      })
    }

    console.log('[PDF] PDF generated successfully:', fileName)
    return file.uri
  } catch (error) {
    console.error('PDF generation error:', error)
    throw error
  }
}

/**
 * Generate PDF and open native share dialog
 * @param documentData - Document to generate PDF for
 * @param companyInfo - Optional company info
 * @param printerInfo - Optional printer info
 * @param user - Optional user for activity logging
 */
export async function sharePDF(
  documentData: Document,
  companyInfo?: CompanyInfo,
  printerInfo?: PrinterInfo,
  user?: ActivityUser
): Promise<void> {
  // Check if sharing is available
  const isAvailable = await Sharing.isAvailableAsync()
  if (!isAvailable) {
    throw new Error('Sharing is not available on this device')
  }

  // Generate the PDF (with activity logging)
  const filePath = await generatePDF(documentData, companyInfo, printerInfo, user)

  // Open share dialog
  await Sharing.shareAsync(filePath, {
    mimeType: 'application/pdf',
    dialogTitle: `Share ${documentData.documentType} ${documentData.documentNumber}`,
    UTI: 'com.adobe.pdf', // iOS specific
  })
}

/**
 * Check if PDF service is available
 * Uses 5 second timeout for health checks
 */
export async function checkPdfServiceHealth(): Promise<boolean> {
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
