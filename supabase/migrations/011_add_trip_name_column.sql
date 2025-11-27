-- ============================================================================
-- WIF Finance - Add Trip Name Column
-- Migration: 011
-- Description: Add trip_name column to bookings table for mobile app compatibility
-- ============================================================================

-- ============================================================================
-- ADD TRIP_NAME COLUMN
-- ============================================================================
-- The mobile app needs to distinguish between:
-- - trip_name: The name/title of the trip (e.g., "Japan Winter Tour 2025")
-- - guest_name: The name of the customer/guest (e.g., "Hilmi Salleh")
--
-- Previously, guest_name was used for both purposes.

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS trip_name TEXT;

-- For existing records, copy guest_name to trip_name as initial value
UPDATE bookings SET trip_name = guest_name WHERE trip_name IS NULL;

-- Add index for searching by trip name
CREATE INDEX IF NOT EXISTS idx_bookings_trip_name ON bookings(trip_name);

-- Add comment
COMMENT ON COLUMN bookings.trip_name IS 'Name/title of the trip (e.g., Japan Winter Tour). Separate from guest_name which is the customer name.';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT 'trip_name column exists' as check_name,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_name = 'bookings' AND column_name = 'trip_name')
    THEN '✓ PASS'
    ELSE '✗ FAIL'
  END as status;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
