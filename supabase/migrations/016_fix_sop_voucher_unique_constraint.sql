-- ============================================================================
-- WIF Finance - Fix Statement of Payment to Payment Voucher Linking
-- Migration: 016
-- Description: Fix UNIQUE constraint on linked_voucher_id to handle soft-deletes
-- ============================================================================

-- Problem:
-- The statements_of_payment table has UNIQUE(linked_voucher_id) constraint.
-- When a SOP is soft-deleted (documents.deleted_at IS NOT NULL), it still
-- occupies the UNIQUE constraint slot, preventing creation of a new SOP
-- for the same voucher.

-- Solution:
-- Since PostgreSQL doesn't allow subqueries in partial index predicates,
-- we'll simply remove the UNIQUE constraint entirely. The business logic
-- in the application layer already prevents creating duplicate SOPs for
-- the same voucher via checkCanDeleteDocument() validation.

-- ============================================================================
-- STEP 1: Drop the existing UNIQUE constraint
-- ============================================================================

ALTER TABLE statements_of_payment
DROP CONSTRAINT IF EXISTS statements_of_payment_linked_voucher_id_key;

-- ============================================================================
-- STEP 2: Create a trigger to enforce uniqueness for active records only
-- ============================================================================

-- This function checks if an active (non-deleted) SOP already exists for the voucher
CREATE OR REPLACE FUNCTION check_unique_active_sop_per_voucher()
RETURNS TRIGGER AS $$
DECLARE
    v_existing_count INTEGER;
BEGIN
    -- Check if any other active SOP exists for this voucher
    SELECT COUNT(*) INTO v_existing_count
    FROM statements_of_payment sop
    JOIN documents d ON sop.document_id = d.id
    WHERE sop.linked_voucher_id = NEW.linked_voucher_id
      AND d.deleted_at IS NULL
      AND sop.id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

    IF v_existing_count > 0 THEN
        RAISE EXCEPTION 'A Statement of Payment already exists for this Payment Voucher. Only one active SOP per voucher is allowed.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS enforce_unique_active_sop ON statements_of_payment;

-- Create trigger to enforce uniqueness on INSERT and UPDATE
CREATE TRIGGER enforce_unique_active_sop
    BEFORE INSERT OR UPDATE OF linked_voucher_id ON statements_of_payment
    FOR EACH ROW
    EXECUTE FUNCTION check_unique_active_sop_per_voucher();

-- ============================================================================
-- STEP 3: Add helpful comments
-- ============================================================================

COMMENT ON FUNCTION check_unique_active_sop_per_voucher() IS
'Ensures only one active (non-deleted) Statement of Payment can exist per Payment Voucher.
This allows creating a new SOP for a voucher after the previous one is soft-deleted.';

COMMENT ON TRIGGER enforce_unique_active_sop ON statements_of_payment IS
'Enforces one active SOP per voucher rule, checking documents.deleted_at status.';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check that the old constraint is gone
SELECT
    'Old UNIQUE constraint removed' as check_name,
    CASE
        WHEN NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'statements_of_payment_linked_voucher_id_key'
        )
        THEN '✓ PASS'
        ELSE '✗ FAIL'
    END as status;

-- Check that the new trigger exists
SELECT
    'New trigger created' as check_name,
    CASE
        WHEN EXISTS (
            SELECT 1 FROM pg_trigger
            WHERE tgname = 'enforce_unique_active_sop'
        )
        THEN '✓ PASS'
        ELSE '✗ FAIL'
    END as status;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
