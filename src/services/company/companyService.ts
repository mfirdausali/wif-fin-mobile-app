/**
 * Company Service for Mobile App
 *
 * Manages company information for PDF generation and settings.
 * Mirrors the web app's implementation.
 */

import { supabase } from '../api/supabaseClient'
import * as SecureStore from 'expo-secure-store'

// Default company ID (single-tenant mode)
const DEFAULT_COMPANY_ID = 'c0000000-0000-0000-0000-000000000001'
const COMPANY_INFO_CACHE_KEY = 'wif_company_info'

export interface CompanyInfo {
  name: string
  address: string
  tel: string
  email: string
  registrationNo: string
  registeredOffice: string
  allowNegativeBalance: boolean
}

export interface DbCompany {
  id: string
  name: string
  address: string | null
  tel: string | null
  email: string | null
  registration_no: string | null
  registered_office: string | null
  allow_negative_balance: boolean | null
  created_at: string
  updated_at: string
}

const DEFAULT_COMPANY_INFO: CompanyInfo = {
  name: 'WIF JAPAN SDN BHD',
  address: 'Malaysia Office\nKuala Lumpur, Malaysia',
  tel: '+60-XXX-XXXXXXX',
  email: 'info@wifjapan.com',
  registrationNo: '(1594364-K)',
  registeredOffice: 'NO.6, LORONG KIRI 10, KAMPUNG DATUK KERAMAT, KUALA LUMPUR, 54000, Malaysia',
  allowNegativeBalance: false,
}

/**
 * Convert database company to CompanyInfo
 */
function dbCompanyToCompanyInfo(dbCompany: DbCompany): CompanyInfo {
  return {
    name: dbCompany.name || DEFAULT_COMPANY_INFO.name,
    address: dbCompany.address || DEFAULT_COMPANY_INFO.address,
    tel: dbCompany.tel || DEFAULT_COMPANY_INFO.tel,
    email: dbCompany.email || DEFAULT_COMPANY_INFO.email,
    registrationNo: dbCompany.registration_no || DEFAULT_COMPANY_INFO.registrationNo,
    registeredOffice: dbCompany.registered_office || DEFAULT_COMPANY_INFO.registeredOffice,
    allowNegativeBalance: dbCompany.allow_negative_balance ?? DEFAULT_COMPANY_INFO.allowNegativeBalance,
  }
}

/**
 * Get company info from cache (SecureStore)
 */
async function getCachedCompanyInfo(): Promise<CompanyInfo | null> {
  try {
    const cached = await SecureStore.getItemAsync(COMPANY_INFO_CACHE_KEY)
    if (cached) {
      return JSON.parse(cached)
    }
  } catch (error) {
    console.error('Error reading cached company info:', error)
  }
  return null
}

/**
 * Save company info to cache (SecureStore)
 */
async function cacheCompanyInfo(companyInfo: CompanyInfo): Promise<void> {
  try {
    await SecureStore.setItemAsync(COMPANY_INFO_CACHE_KEY, JSON.stringify(companyInfo))
  } catch (error) {
    console.error('Error caching company info:', error)
  }
}

/**
 * Get or create default company from Supabase
 */
export async function getOrCreateDefaultCompany(): Promise<CompanyInfo> {
  try {
    // Try to get existing company
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('id', DEFAULT_COMPANY_ID)
      .single()

    if (error && error.code !== 'PGRST116') {
      throw error
    }

    if (data) {
      const companyInfo = dbCompanyToCompanyInfo(data as DbCompany)
      await cacheCompanyInfo(companyInfo)
      return companyInfo
    }

    // Create company if it doesn't exist
    const insert = {
      id: DEFAULT_COMPANY_ID,
      name: DEFAULT_COMPANY_INFO.name,
      address: DEFAULT_COMPANY_INFO.address,
      tel: DEFAULT_COMPANY_INFO.tel,
      email: DEFAULT_COMPANY_INFO.email,
      registration_no: DEFAULT_COMPANY_INFO.registrationNo,
      registered_office: DEFAULT_COMPANY_INFO.registeredOffice,
      allow_negative_balance: DEFAULT_COMPANY_INFO.allowNegativeBalance,
    }

    const { data: newCompany, error: createError } = await supabase
      .from('companies')
      .insert(insert)
      .select()
      .single()

    if (createError) throw createError

    const companyInfo = dbCompanyToCompanyInfo(newCompany as DbCompany)
    await cacheCompanyInfo(companyInfo)
    return companyInfo
  } catch (error) {
    console.error('Error getting/creating company:', error)

    // Fall back to cache
    const cached = await getCachedCompanyInfo()
    if (cached) return cached

    return DEFAULT_COMPANY_INFO
  }
}

/**
 * Update company information
 */
export async function updateCompanyInfo(updates: Partial<CompanyInfo>): Promise<CompanyInfo> {
  try {
    const { data, error } = await supabase
      .from('companies')
      .update({
        ...(updates.name !== undefined && { name: updates.name }),
        ...(updates.address !== undefined && { address: updates.address }),
        ...(updates.tel !== undefined && { tel: updates.tel }),
        ...(updates.email !== undefined && { email: updates.email }),
        ...(updates.registrationNo !== undefined && { registration_no: updates.registrationNo }),
        ...(updates.registeredOffice !== undefined && { registered_office: updates.registeredOffice }),
        ...(updates.allowNegativeBalance !== undefined && { allow_negative_balance: updates.allowNegativeBalance }),
      })
      .eq('id', DEFAULT_COMPANY_ID)
      .select()
      .single()

    if (error) throw error

    const companyInfo = dbCompanyToCompanyInfo(data as DbCompany)
    await cacheCompanyInfo(companyInfo)
    return companyInfo
  } catch (error) {
    console.error('Error updating company:', error)
    throw new Error(`Failed to update company: ${error}`)
  }
}

/**
 * Get company info - tries cache first, then fetches from Supabase
 */
export async function getCompanyInfo(): Promise<CompanyInfo> {
  // Try cache first for fast response
  const cached = await getCachedCompanyInfo()
  if (cached) {
    // Refresh from Supabase in background
    getOrCreateDefaultCompany().catch(console.error)
    return cached
  }

  // No cache, fetch from Supabase
  return getOrCreateDefaultCompany()
}

/**
 * Get default company info (for offline/fallback)
 */
export function getDefaultCompanyInfo(): CompanyInfo {
  return { ...DEFAULT_COMPANY_INFO }
}
