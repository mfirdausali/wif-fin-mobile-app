/**
 * Null Safety Utilities
 *
 * Helper functions to safely handle null and undefined values
 * Prevents null/undefined errors throughout the application
 */

/**
 * Return value if not null/undefined, otherwise return default
 *
 * @param value - Value to check
 * @param defaultValue - Default value to use if value is null/undefined
 * @returns The value or default value
 *
 * @example
 * nullSafe('hello', 'default') // 'hello'
 * nullSafe(null, 'default') // 'default'
 * nullSafe(undefined, 'default') // 'default'
 * nullSafe(0, 10) // 0 (zero is valid)
 * nullSafe('', 'default') // '' (empty string is valid)
 * nullSafe(false, true) // false (false is valid)
 */
export function nullSafe<T>(value: T | null | undefined, defaultValue: T): T {
  return value !== null && value !== undefined ? value : defaultValue
}

/**
 * Return array if not null/undefined/invalid, otherwise return empty array
 * Also ensures the value is actually an array
 *
 * @param value - Array to check
 * @returns The array or empty array
 *
 * @example
 * nullSafeArray([1, 2, 3]) // [1, 2, 3]
 * nullSafeArray(null) // []
 * nullSafeArray(undefined) // []
 * nullSafeArray([]) // [] (empty array is valid)
 * nullSafeArray('not an array') // []
 */
export function nullSafeArray<T>(value: T[] | null | undefined): T[] {
  if (value === null || value === undefined) {
    return []
  }

  if (!Array.isArray(value)) {
    return []
  }

  return value
}

/**
 * Return object if not null/undefined, otherwise return empty object
 * Also ensures the value is actually an object
 *
 * @param value - Object to check
 * @returns The object or empty object (partial)
 *
 * @example
 * nullSafeObject({ name: 'John' }) // { name: 'John' }
 * nullSafeObject(null) // {}
 * nullSafeObject(undefined) // {}
 * nullSafeObject({}) // {} (empty object is valid)
 * nullSafeObject('not an object') // {}
 * nullSafeObject([1, 2, 3]) // {} (arrays are not objects for this purpose)
 */
export function nullSafeObject<T extends object>(value: T | null | undefined): Partial<T> {
  if (value === null || value === undefined) {
    return {} as Partial<T>
  }

  if (typeof value !== 'object' || Array.isArray(value)) {
    return {} as Partial<T>
  }

  return value
}

/**
 * Return string if not null/undefined/empty, otherwise return default
 * Trims whitespace before checking
 *
 * @param value - String to check
 * @param defaultValue - Default string to use
 * @returns The string or default value
 *
 * @example
 * nullSafeString('hello', 'default') // 'hello'
 * nullSafeString(null, 'default') // 'default'
 * nullSafeString(undefined, 'default') // 'default'
 * nullSafeString('', 'default') // 'default' (empty string returns default)
 * nullSafeString('   ', 'default') // 'default' (whitespace only returns default)
 * nullSafeString(' hello ', 'default') // 'hello' (trimmed)
 */
export function nullSafeString(value: string | null | undefined, defaultValue: string = ''): string {
  if (value === null || value === undefined || typeof value !== 'string') {
    return defaultValue
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : defaultValue
}

/**
 * Safely access nested object properties with optional chaining alternative
 * Returns undefined if any part of the path is null/undefined
 *
 * @param obj - Object to access
 * @param path - Path to property (e.g., 'user.profile.name')
 * @param defaultValue - Default value if path doesn't exist
 * @returns Value at path or default value
 *
 * @example
 * const obj = { user: { profile: { name: 'John' } } }
 * getNestedValue(obj, 'user.profile.name') // 'John'
 * getNestedValue(obj, 'user.profile.age') // undefined
 * getNestedValue(obj, 'user.profile.age', 0) // 0
 * getNestedValue(null, 'user.name') // undefined
 * getNestedValue(obj, 'user.missing.deep.path', 'default') // 'default'
 */
export function getNestedValue<T = any>(
  obj: any,
  path: string,
  defaultValue?: T
): T | undefined {
  if (!obj || typeof obj !== 'object') {
    return defaultValue
  }

  const keys = path.split('.')
  let current = obj

  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return defaultValue
    }
    current = current[key]
  }

  return current !== undefined ? current : defaultValue
}

/**
 * Safely set nested object properties, creating intermediate objects as needed
 * Does not modify original object, returns new object
 *
 * @param obj - Object to modify
 * @param path - Path to property (e.g., 'user.profile.name')
 * @param value - Value to set
 * @returns New object with value set at path
 *
 * @example
 * const obj = { user: { name: 'John' } }
 * setNestedValue(obj, 'user.profile.age', 25)
 * // Returns: { user: { name: 'John', profile: { age: 25 } } }
 *
 * setNestedValue({}, 'user.profile.name', 'Jane')
 * // Returns: { user: { profile: { name: 'Jane' } } }
 */
export function setNestedValue<T extends object>(
  obj: T,
  path: string,
  value: any
): T {
  const result = { ...obj }
  const keys = path.split('.')
  let current: any = result

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]
    if (!current[key] || typeof current[key] !== 'object') {
      current[key] = {}
    } else {
      current[key] = { ...current[key] }
    }
    current = current[key]
  }

  current[keys[keys.length - 1]] = value
  return result
}

/**
 * Filter out null and undefined values from an array
 *
 * @param array - Array to filter
 * @returns Array with only defined values
 *
 * @example
 * filterNullish([1, null, 2, undefined, 3]) // [1, 2, 3]
 * filterNullish([null, undefined]) // []
 * filterNullish([0, false, '']) // [0, false, ''] (falsy but defined values kept)
 */
export function filterNullish<T>(array: (T | null | undefined)[]): T[] {
  return array.filter((item): item is T => item !== null && item !== undefined)
}

/**
 * Coalesce - return first non-null/non-undefined value from arguments
 *
 * @param values - Values to check in order
 * @returns First non-null/non-undefined value, or undefined if all are null/undefined
 *
 * @example
 * coalesce(null, undefined, 'hello', 'world') // 'hello'
 * coalesce(null, undefined) // undefined
 * coalesce(0, 10) // 0 (zero is valid)
 * coalesce(null, '', 'default') // '' (empty string is valid)
 */
export function coalesce<T>(...values: (T | null | undefined)[]): T | undefined {
  for (const value of values) {
    if (value !== null && value !== undefined) {
      return value
    }
  }
  return undefined
}

/**
 * Safely map over array, handling null/undefined arrays
 *
 * @param array - Array to map
 * @param fn - Mapping function
 * @returns Mapped array or empty array
 *
 * @example
 * nullSafeMap([1, 2, 3], x => x * 2) // [2, 4, 6]
 * nullSafeMap(null, x => x * 2) // []
 * nullSafeMap(undefined, x => x * 2) // []
 */
export function nullSafeMap<T, U>(
  array: T[] | null | undefined,
  fn: (item: T, index: number) => U
): U[] {
  const safeArray = nullSafeArray(array)
  return safeArray.map(fn)
}

/**
 * Safely filter array, handling null/undefined arrays
 *
 * @param array - Array to filter
 * @param fn - Filter function
 * @returns Filtered array or empty array
 *
 * @example
 * nullSafeFilter([1, 2, 3, 4], x => x > 2) // [3, 4]
 * nullSafeFilter(null, x => x > 2) // []
 */
export function nullSafeFilter<T>(
  array: T[] | null | undefined,
  fn: (item: T, index: number) => boolean
): T[] {
  const safeArray = nullSafeArray(array)
  return safeArray.filter(fn)
}

/**
 * Safely reduce array, handling null/undefined arrays
 *
 * @param array - Array to reduce
 * @param fn - Reducer function
 * @param initialValue - Initial value for reducer
 * @returns Reduced value
 *
 * @example
 * nullSafeReduce([1, 2, 3], (sum, x) => sum + x, 0) // 6
 * nullSafeReduce(null, (sum, x) => sum + x, 0) // 0
 */
export function nullSafeReduce<T, U>(
  array: T[] | null | undefined,
  fn: (accumulator: U, item: T, index: number) => U,
  initialValue: U
): U {
  const safeArray = nullSafeArray(array)
  return safeArray.reduce(fn, initialValue)
}

/**
 * Check if value is null or undefined
 *
 * @param value - Value to check
 * @returns True if value is null or undefined
 *
 * @example
 * isNullish(null) // true
 * isNullish(undefined) // true
 * isNullish(0) // false
 * isNullish('') // false
 * isNullish(false) // false
 */
export function isNullish(value: any): value is null | undefined {
  return value === null || value === undefined
}

/**
 * Check if value is defined (not null or undefined)
 *
 * @param value - Value to check
 * @returns True if value is not null or undefined
 *
 * @example
 * isDefined(null) // false
 * isDefined(undefined) // false
 * isDefined(0) // true
 * isDefined('') // true
 * isDefined(false) // true
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined
}

/**
 * Safely get first item from array
 *
 * @param array - Array to get first item from
 * @param defaultValue - Default value if array is empty/null
 * @returns First item or default value
 *
 * @example
 * firstOrDefault([1, 2, 3]) // 1
 * firstOrDefault([]) // undefined
 * firstOrDefault([], 0) // 0
 * firstOrDefault(null, 'default') // 'default'
 */
export function firstOrDefault<T>(
  array: T[] | null | undefined,
  defaultValue?: T
): T | undefined {
  const safeArray = nullSafeArray(array)
  return safeArray.length > 0 ? safeArray[0] : defaultValue
}

/**
 * Safely get last item from array
 *
 * @param array - Array to get last item from
 * @param defaultValue - Default value if array is empty/null
 * @returns Last item or default value
 *
 * @example
 * lastOrDefault([1, 2, 3]) // 3
 * lastOrDefault([]) // undefined
 * lastOrDefault([], 0) // 0
 * lastOrDefault(null, 'default') // 'default'
 */
export function lastOrDefault<T>(
  array: T[] | null | undefined,
  defaultValue?: T
): T | undefined {
  const safeArray = nullSafeArray(array)
  return safeArray.length > 0 ? safeArray[safeArray.length - 1] : defaultValue
}
