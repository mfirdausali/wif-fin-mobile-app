/**
 * Authentication Service for Mobile
 *
 * Matches the web app's authentication system:
 * - Custom auth (NOT Supabase Auth)
 * - Users stored in 'users' table
 * - SHA-256 password hashing with salt
 * - Session management
 */

import CryptoJS from 'crypto-js'
import { supabase } from '../api/supabaseClient'
import * as SecureStore from 'expo-secure-store'

// Types matching web app
export type UserRole = 'viewer' | 'accountant' | 'manager' | 'admin'

export interface User {
  id: string
  username: string
  email: string
  fullName: string
  role: UserRole
  isActive: boolean
  companyId: string
  lastLogin?: string
  createdAt: string
  updatedAt: string
}

export interface LoginCredentials {
  usernameOrEmail: string
  password: string
  rememberMe?: boolean
}

export interface LoginResponse {
  success: boolean
  user?: User
  error?: string
  errorCode?: 'INVALID_CREDENTIALS' | 'ACCOUNT_LOCKED' | 'ACCOUNT_INACTIVE' | 'SESSION_ERROR'
}

// Storage keys
const STORAGE_KEYS = {
  SESSION: 'wif_mobile_session',
  USER: 'wif_mobile_user',
} as const

// ============================================================================
// PASSWORD UTILITIES (matches web app)
// ============================================================================

/**
 * Hash a password using SHA-256 with salt
 * MUST match the web app's implementation exactly
 */
export function hashPassword(password: string): string {
  const salt = 'WIF_FINANCE_SALT_2025'
  const salted = password + salt
  return CryptoJS.SHA256(salted).toString()
}

/**
 * Verify a password against a hash
 */
export function verifyPassword(password: string, hash: string): boolean {
  const hashedInput = hashPassword(password)
  return hashedInput === hash
}

// ============================================================================
// DATABASE USER TYPE CONVERTER
// ============================================================================

interface DBUser {
  id: string
  username: string
  email: string
  full_name: string
  role: string
  is_active: boolean
  company_id: string
  password_hash: string
  failed_login_attempts: number
  locked_until: string | null
  last_login: string | null
  created_at: string
  updated_at: string
}

function dbUserToUser(dbUser: DBUser): User {
  return {
    id: dbUser.id,
    username: dbUser.username,
    email: dbUser.email,
    fullName: dbUser.full_name,
    role: dbUser.role as UserRole,
    isActive: dbUser.is_active,
    companyId: dbUser.company_id,
    lastLogin: dbUser.last_login || undefined,
    createdAt: dbUser.created_at,
    updatedAt: dbUser.updated_at,
  }
}

// ============================================================================
// AUTHENTICATION
// ============================================================================

/**
 * Login with username/email and password
 */
export async function login(credentials: LoginCredentials): Promise<LoginResponse> {
  const { usernameOrEmail, password } = credentials

  try {
    // Find user by username or email (case-insensitive)
    const { data: users, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .or(`username.ilike.${usernameOrEmail},email.ilike.${usernameOrEmail}`)

    if (fetchError) {
      console.error('Error fetching user:', fetchError)
      return {
        success: false,
        error: 'Connection error. Please try again.',
        errorCode: 'SESSION_ERROR',
      }
    }

    // User not found
    if (!users || users.length === 0) {
      return {
        success: false,
        error: 'Invalid username or password',
        errorCode: 'INVALID_CREDENTIALS',
      }
    }

    const dbUser = users[0] as DBUser

    // Check if account is locked
    if (dbUser.locked_until) {
      const lockedUntil = new Date(dbUser.locked_until)
      const now = new Date()

      if (now < lockedUntil) {
        const minutesRemaining = Math.ceil((lockedUntil.getTime() - now.getTime()) / 60000)
        return {
          success: false,
          error: `Account is locked. Try again in ${minutesRemaining} minute(s)`,
          errorCode: 'ACCOUNT_LOCKED',
        }
      }
    }

    // Check if account is active
    if (!dbUser.is_active) {
      return {
        success: false,
        error: 'Account is inactive. Please contact your administrator',
        errorCode: 'ACCOUNT_INACTIVE',
      }
    }

    // Verify password
    if (!dbUser.password_hash || !verifyPassword(password, dbUser.password_hash)) {
      // Update failed login attempts
      await updateFailedLoginAttempts(dbUser.id, dbUser.failed_login_attempts + 1)

      return {
        success: false,
        error: 'Invalid username or password',
        errorCode: 'INVALID_CREDENTIALS',
      }
    }

    // Success! Update last login and reset failed attempts
    await updateLastLogin(dbUser.id)

    const user = dbUserToUser(dbUser)

    // Store user session
    await storeSession(user)

    return {
      success: true,
      user,
    }
  } catch (error) {
    console.error('Login error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred',
      errorCode: 'SESSION_ERROR',
    }
  }
}

/**
 * Logout - clear session
 */
export async function logout(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(STORAGE_KEYS.SESSION)
    await SecureStore.deleteItemAsync(STORAGE_KEYS.USER)
  } catch (error) {
    console.error('Logout error:', error)
  }
}

/**
 * Get stored session
 */
export async function getStoredSession(): Promise<User | null> {
  try {
    const userJson = await SecureStore.getItemAsync(STORAGE_KEYS.USER)
    if (!userJson) return null

    const user = JSON.parse(userJson) as User
    return user
  } catch (error) {
    console.error('Error getting stored session:', error)
    return null
  }
}

/**
 * Store user session
 */
async function storeSession(user: User): Promise<void> {
  try {
    await SecureStore.setItemAsync(STORAGE_KEYS.USER, JSON.stringify(user))
    await SecureStore.setItemAsync(STORAGE_KEYS.SESSION, new Date().toISOString())
  } catch (error) {
    console.error('Error storing session:', error)
  }
}

// ============================================================================
// USER DATABASE UPDATES
// ============================================================================

async function updateFailedLoginAttempts(userId: string, attempts: number): Promise<void> {
  try {
    const updateData: { failed_login_attempts: number; locked_until?: string } = {
      failed_login_attempts: attempts,
    }

    // Lock account after 5 failed attempts (30 minutes)
    if (attempts >= 5) {
      const lockedUntil = new Date()
      lockedUntil.setMinutes(lockedUntil.getMinutes() + 30)
      updateData.locked_until = lockedUntil.toISOString()
    }

    await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId)
  } catch (error) {
    console.error('Error updating failed login attempts:', error)
  }
}

async function updateLastLogin(userId: string): Promise<void> {
  try {
    await supabase
      .from('users')
      .update({
        last_login: new Date().toISOString(),
        failed_login_attempts: 0,
        locked_until: null,
      })
      .eq('id', userId)
  } catch (error) {
    console.error('Error updating last login:', error)
  }
}

// ============================================================================
// USER FETCHING
// ============================================================================

/**
 * Get user by ID
 */
export async function getUserById(userId: string): Promise<User | null> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (error || !data) return null

    return dbUserToUser(data as DBUser)
  } catch (error) {
    console.error('Error fetching user:', error)
    return null
  }
}

/**
 * Refresh user data from database
 */
export async function refreshUser(userId: string): Promise<User | null> {
  const user = await getUserById(userId)
  if (user) {
    await storeSession(user)
  }
  return user
}

// ============================================================================
// CONNECTION TEST
// ============================================================================

/**
 * Test Supabase connection
 */
export async function testConnection(): Promise<{ success: boolean; message: string }> {
  try {
    const { data, error } = await supabase
      .from('companies')
      .select('id, name')
      .limit(1)

    if (error) {
      return {
        success: false,
        message: `Database error: ${error.message}`,
      }
    }

    if (data && data.length > 0) {
      return {
        success: true,
        message: `Connected to ${data[0].name}`,
      }
    }

    return {
      success: true,
      message: 'Connected (no company found)',
    }
  } catch (error: any) {
    return {
      success: false,
      message: `Connection failed: ${error.message}`,
    }
  }
}
