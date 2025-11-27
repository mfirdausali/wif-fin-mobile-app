import { createClient } from '@supabase/supabase-js'
import * as SecureStore from 'expo-secure-store'
import Constants from 'expo-constants'

// Get config from environment/constants
const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || ''

// Custom storage adapter using SecureStore for sensitive data
const SecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(key)
    } catch {
      return null
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await SecureStore.setItemAsync(key, value)
    } catch (error) {
      console.error('SecureStore setItem error:', error)
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(key)
    } catch (error) {
      console.error('SecureStore removeItem error:', error)
    }
  },
}

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: SecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // Not needed for mobile
  },
  global: {
    headers: {
      'x-client-info': 'wif-finance-mobile',
    },
  },
})

// Database types (should match your existing web app types)
export interface Database {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string
          name: string
          address: string | null
          phone: string | null
          email: string | null
          website: string | null
          registration_number: string | null
          tax_id: string | null
          logo_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['companies']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['companies']['Insert']>
      }
      accounts: {
        Row: {
          id: string
          company_id: string
          name: string
          type: 'main_bank' | 'petty_cash'
          currency: 'MYR' | 'JPY'
          balance: number
          description: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['accounts']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['accounts']['Insert']>
      }
      documents: {
        Row: {
          id: string
          company_id: string
          document_number: string
          document_type: 'invoice' | 'receipt' | 'payment_voucher' | 'statement_of_payment'
          status: 'draft' | 'issued' | 'paid' | 'completed' | 'cancelled'
          date: string
          due_date: string | null
          customer_name: string | null
          customer_address: string | null
          description: string | null
          subtotal: number
          tax_amount: number
          total_amount: number
          currency: 'MYR' | 'JPY'
          account_id: string | null
          notes: string | null
          created_by: string | null
          updated_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['documents']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['documents']['Insert']>
      }
      document_line_items: {
        Row: {
          id: string
          document_id: string
          description: string
          quantity: number
          unit_price: number
          amount: number
          sort_order: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['document_line_items']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['document_line_items']['Insert']>
      }
      bookings: {
        Row: {
          id: string
          company_id: string
          booking_number: string
          trip_name: string
          customer_name: string
          start_date: string
          end_date: string
          status: 'planning' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'
          pax: number
          total_cost_wif: number
          total_cost_b2b: number
          currency: 'MYR' | 'JPY'
          exchange_rate: number | null
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['bookings']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['bookings']['Insert']>
      }
      users: {
        Row: {
          id: string
          email: string
          username: string
          name: string
          role: 'viewer' | 'accountant' | 'manager' | 'admin'
          company_id: string
          is_active: boolean
          last_login: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['users']['Insert']>
      }
      transactions: {
        Row: {
          id: string
          account_id: string
          document_id: string | null
          type: 'debit' | 'credit'
          amount: number
          balance_after: number
          description: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['transactions']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['transactions']['Insert']>
      }
      activity_logs: {
        Row: {
          id: string
          user_id: string | null
          action: string
          entity_type: string | null
          entity_id: string | null
          details: Record<string, any> | null
          ip_address: string | null
          user_agent: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['activity_logs']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['activity_logs']['Insert']>
      }
    }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']
export type InsertTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']
export type UpdateTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']

// Type aliases for convenience
export type Company = Tables<'companies'>
export type Account = Tables<'accounts'>
export type Document = Tables<'documents'>
export type DocumentLineItem = Tables<'document_line_items'>
export type Booking = Tables<'bookings'>
export type User = Tables<'users'>
export type Transaction = Tables<'transactions'>
export type ActivityLog = Tables<'activity_logs'>
