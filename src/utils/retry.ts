/**
 * Retry utility for WIF Finance
 * Provides automatic retry logic for failed operations with exponential backoff
 */

import { NetworkError } from './errors'

// ============================================================================
// RETRY OPTIONS
// ============================================================================

export interface RetryOptions {
  /**
   * Maximum number of attempts (including the initial attempt)
   * @default 3
   */
  maxAttempts?: number

  /**
   * Initial delay in milliseconds before the first retry
   * @default 1000
   */
  delayMs?: number

  /**
   * Multiplier for exponential backoff
   * Each retry will wait delayMs * (backoffMultiplier ^ attemptNumber)
   * @default 2
   */
  backoffMultiplier?: number

  /**
   * Maximum delay in milliseconds (caps exponential backoff)
   * @default 10000
   */
  maxDelayMs?: number

  /**
   * Custom function to determine if an error should trigger a retry
   * If not provided, only network errors will be retried
   * @param error - The error that occurred
   * @returns true if the operation should be retried
   */
  shouldRetry?: (error: any) => boolean

  /**
   * Callback invoked before each retry attempt
   * Useful for logging or updating UI
   * @param attempt - The attempt number (1-based)
   * @param error - The error that triggered the retry
   */
  onRetry?: (attempt: number, error: any) => void
}

// ============================================================================
// RETRY FUNCTION
// ============================================================================

/**
 * Execute a function with automatic retry on failure
 *
 * @param fn - The async function to execute
 * @param options - Retry configuration options
 * @returns Promise that resolves with the function result or rejects with the last error
 *
 * @example
 * ```typescript
 * // Simple retry with defaults
 * const result = await withRetry(() => fetchData())
 *
 * // Custom retry logic
 * const result = await withRetry(
 *   () => createDocument(data),
 *   {
 *     maxAttempts: 5,
 *     delayMs: 2000,
 *     shouldRetry: (error) => error.code === 'NETWORK_ERROR',
 *     onRetry: (attempt) => console.log(`Retry attempt ${attempt}`)
 *   }
 * )
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const {
    maxAttempts = 3,
    delayMs = 1000,
    backoffMultiplier = 2,
    maxDelayMs = 10000,
    shouldRetry = defaultShouldRetry,
    onRetry,
  } = options || {}

  let lastError: any

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Execute the function
      return await fn()
    } catch (error) {
      lastError = error

      // Check if we should retry
      const isLastAttempt = attempt === maxAttempts
      const shouldRetryError = shouldRetry(error)

      if (isLastAttempt || !shouldRetryError) {
        // No more retries, throw the error
        throw error
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        delayMs * Math.pow(backoffMultiplier, attempt - 1),
        maxDelayMs
      )

      // Call onRetry callback if provided
      if (onRetry) {
        onRetry(attempt, error)
      }

      // Wait before retrying
      await sleep(delay)
    }
  }

  // This should never be reached, but TypeScript requires it
  throw lastError
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Default retry logic - only retry network errors
 */
function defaultShouldRetry(error: any): boolean {
  // Retry network errors
  if (error instanceof NetworkError) {
    return true
  }

  // Retry if error message contains network-related keywords
  const errorMessage = error?.message?.toLowerCase() || ''
  const networkKeywords = ['network', 'connection', 'timeout', 'fetch', 'offline']

  return networkKeywords.some(keyword => errorMessage.includes(keyword))
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ============================================================================
// SPECIALIZED RETRY FUNCTIONS
// ============================================================================

/**
 * Retry with aggressive settings for critical operations
 * Uses more attempts and longer delays
 */
export async function withAggressiveRetry<T>(
  fn: () => Promise<T>,
  customOptions?: Partial<RetryOptions>
): Promise<T> {
  return withRetry(fn, {
    maxAttempts: 5,
    delayMs: 2000,
    backoffMultiplier: 2,
    maxDelayMs: 15000,
    ...customOptions,
  })
}

/**
 * Retry with minimal settings for non-critical operations
 * Uses fewer attempts and shorter delays
 */
export async function withQuickRetry<T>(
  fn: () => Promise<T>,
  customOptions?: Partial<RetryOptions>
): Promise<T> {
  return withRetry(fn, {
    maxAttempts: 2,
    delayMs: 500,
    backoffMultiplier: 1.5,
    maxDelayMs: 2000,
    ...customOptions,
  })
}

/**
 * Retry only on specific error codes
 */
export function createRetryWithCodes(errorCodes: string[]): typeof withRetry {
  return <T>(fn: () => Promise<T>, options?: RetryOptions) => {
    return withRetry(fn, {
      ...options,
      shouldRetry: (error) => {
        // Use custom shouldRetry if provided
        if (options?.shouldRetry) {
          return options.shouldRetry(error)
        }
        // Otherwise check error codes
        return errorCodes.includes(error?.code)
      },
    })
  }
}

// ============================================================================
// RETRY WITH TIMEOUT
// ============================================================================

/**
 * Execute a function with retry and timeout
 * Useful for operations that might hang
 *
 * @param fn - The async function to execute
 * @param timeoutMs - Timeout in milliseconds
 * @param retryOptions - Retry configuration options
 */
export async function withRetryAndTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  retryOptions?: RetryOptions
): Promise<T> {
  return withRetry(
    () => promiseWithTimeout(fn(), timeoutMs),
    retryOptions
  )
}

/**
 * Wrap a promise with a timeout
 */
function promiseWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)
    ),
  ])
}
