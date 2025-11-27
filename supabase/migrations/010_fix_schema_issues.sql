-- ============================================================================
-- WIF Finance - Schema Fixes for Mobile App Compatibility
-- Migration: 010
-- Description: Fix schema issues identified during mobile app integration
-- ============================================================================

-- ============================================================================
-- FIX 1: Make transactions.document_id NULLABLE
-- ============================================================================
-- Mobile app allows manual balance adjustments without linked documents
-- This is needed for initial balance setup and manual corrections

ALTER TABLE transactions ALTER COLUMN document_id DROP NOT NULL;

-- Add comment explaining the change
COMMENT ON COLUMN transactions.document_id IS 'Optional reference to source document. NULL for manual transactions or initial balance setup.';

-- ============================================================================
-- FIX 2: Add booking_number function alias
-- ============================================================================
-- Mobile app calls generate_booking_number but function is named generate_booking_code

CREATE OR REPLACE FUNCTION generate_booking_number(p_company_id UUID)
RETURNS VARCHAR(50) AS $$
BEGIN
  -- Alias to generate_booking_code for mobile app compatibility
  RETURN generate_booking_code(p_company_id);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FIX 3: Add "other" category columns to bookings (optional)
-- ============================================================================
-- Mobile app supports "other" cost category but it's not persisted
-- Uncomment these if you want to persist "other" category items

-- ALTER TABLE bookings ADD COLUMN IF NOT EXISTS other_items JSONB DEFAULT '[]';
-- ALTER TABLE bookings ADD COLUMN IF NOT EXISTS other_total DECIMAL(15,2) DEFAULT 0;
-- ALTER TABLE bookings ADD COLUMN IF NOT EXISTS other_b2b_total DECIMAL(15,2) DEFAULT 0;

-- ============================================================================
-- FIX 4: Add missing index on transactions.type for query performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(transaction_type);

-- ============================================================================
-- FIX 5: Ensure RLS policies allow anon access (for mobile app without auth header)
-- ============================================================================
-- Mobile app may connect without full Supabase Auth session

-- Bookings: Allow anon access
DROP POLICY IF EXISTS "Allow anon read bookings" ON bookings;
CREATE POLICY "Allow anon read bookings" ON bookings FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Allow anon insert bookings" ON bookings;
CREATE POLICY "Allow anon insert bookings" ON bookings FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon update bookings" ON bookings;
CREATE POLICY "Allow anon update bookings" ON bookings FOR UPDATE TO anon USING (true);

DROP POLICY IF EXISTS "Allow anon delete bookings" ON bookings;
CREATE POLICY "Allow anon delete bookings" ON bookings FOR DELETE TO anon USING (true);

-- Users: Allow anon access (needed for custom auth login)
DROP POLICY IF EXISTS "Allow anon read users" ON users;
CREATE POLICY "Allow anon read users" ON users FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Allow anon update users" ON users;
CREATE POLICY "Allow anon update users" ON users FOR UPDATE TO anon USING (true);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT 'transactions.document_id is nullable' as check_name,
  CASE
    WHEN (SELECT is_nullable FROM information_schema.columns
          WHERE table_name = 'transactions' AND column_name = 'document_id') = 'YES'
    THEN '✓ PASS'
    ELSE '✗ FAIL'
  END as status;

SELECT 'generate_booking_number function exists' as check_name,
  CASE
    WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'generate_booking_number')
    THEN '✓ PASS'
    ELSE '✗ FAIL'
  END as status;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
