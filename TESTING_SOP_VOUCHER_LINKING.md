# Testing Guide: Statement of Payment to Payment Voucher Linking Fix

## Overview
This document describes how to test the fixes for Statement of Payment (SOP) to Payment Voucher linking issues, specifically addressing the UNIQUE constraint problem with soft-deleted records.

## Problems Fixed

### Problem 1: UNIQUE Constraint with Soft Delete
**Issue**: When a SOP was soft-deleted, it still occupied the UNIQUE constraint slot on `linked_voucher_id`, preventing creation of a new SOP for the same voucher.

**Solution**: Migration 016 replaces the UNIQUE constraint with a partial unique index that only applies to non-deleted records.

### Problem 2: Pre-delete Validation for Payment Voucher
**Issue**: Users could delete a Payment Voucher even when an active SOP referenced it.

**Solution**: Added `checkCanDeleteDocument()` validation that checks for active (non-deleted) SOPs before allowing voucher deletion.

## Setup

### 1. Apply Database Migration

Run the migration to fix the UNIQUE constraint:

```bash
# If using Supabase CLI
supabase db push

# Or manually execute the SQL file in Supabase Studio
# File: supabase/migrations/016_fix_sop_voucher_unique_constraint.sql
```

### 2. Verify Migration

Check that the migration was applied successfully:

```sql
-- Should show NO results (old constraint removed)
SELECT conname
FROM pg_constraint
WHERE conname = 'statements_of_payment_linked_voucher_id_key';

-- Should show 1 result (new partial index created)
SELECT indexname
FROM pg_indexes
WHERE indexname = 'statements_of_payment_linked_voucher_id_active_idx';
```

## Test Cases

### Test Case 1: Create SOP for Voucher
**Objective**: Verify that a SOP can be created for a Payment Voucher

**Steps**:
1. Create a Payment Voucher with status "draft" or "issued"
2. Navigate to the voucher detail screen
3. Create a Statement of Payment linked to this voucher
4. Complete the SOP with status "completed"

**Expected Result**: SOP is created successfully and linked to the voucher

---

### Test Case 2: Prevent Duplicate Active SOP
**Objective**: Verify that only one active SOP can exist per voucher

**Steps**:
1. Use the voucher from Test Case 1 (which already has an active SOP)
2. Attempt to create another SOP for the same voucher

**Expected Result**:
- The creation should fail with a unique constraint violation
- Error message should indicate that an active SOP already exists for this voucher

---

### Test Case 3: Delete SOP (Soft Delete)
**Objective**: Verify that soft-deleting a SOP works correctly

**Steps**:
1. Navigate to the SOP created in Test Case 1
2. Delete the SOP (soft delete, sets `deleted_at` timestamp)
3. Verify the SOP no longer appears in the active SOP list
4. Check the database to confirm `deleted_at` is set on the documents table

**Expected Result**:
- SOP is soft-deleted successfully
- The SOP disappears from active document lists
- Database shows `deleted_at IS NOT NULL` for the SOP's document record

---

### Test Case 4: Create New SOP After Soft Delete
**Objective**: Verify that a new SOP can be created for a voucher after the previous SOP was soft-deleted

**Steps**:
1. Use the voucher from Test Case 3 (previous SOP was soft-deleted)
2. Create a new SOP for the same voucher
3. Complete the new SOP with status "completed"

**Expected Result**:
- New SOP is created successfully
- No unique constraint violation occurs
- The new SOP is properly linked to the voucher
- Account balance is updated correctly

---

### Test Case 5: Prevent Voucher Deletion with Active SOP
**Objective**: Verify that a Payment Voucher cannot be deleted if an active SOP references it

**Steps**:
1. Use the voucher from Test Case 4 (which has an active SOP)
2. Navigate to the voucher detail screen
3. Attempt to delete the voucher

**Expected Result**:
- Pre-delete validation shows an alert
- Alert message: "This Payment Voucher is referenced by Statement of Payment [SOP-NUMBER]. Please delete the statement first."
- Voucher is NOT deleted

---

### Test Case 6: Allow Voucher Deletion After SOP Soft Delete
**Objective**: Verify that a Payment Voucher can be deleted after its linked SOP is soft-deleted

**Steps**:
1. Use the voucher from Test Case 5
2. Navigate to the SOP detail screen
3. Delete the SOP (soft delete)
4. Navigate back to the voucher detail screen
5. Attempt to delete the voucher

**Expected Result**:
- Pre-delete validation passes
- Confirmation alert is shown: "Delete [VOUCHER-NUMBER]? This action cannot be undone."
- After confirmation, the voucher is soft-deleted successfully

---

### Test Case 7: Multiple Delete/Recreate Cycles
**Objective**: Verify that multiple delete/recreate cycles work correctly

**Steps**:
1. Create a new Payment Voucher
2. Create SOP-1 for the voucher → Complete it
3. Soft-delete SOP-1
4. Create SOP-2 for the same voucher → Complete it
5. Soft-delete SOP-2
6. Create SOP-3 for the same voucher → Complete it
7. Verify account balances are correct throughout

**Expected Result**:
- All operations succeed without constraint violations
- Each SOP creation and deletion updates account balance correctly
- Final account balance reflects net effect of all completed transactions
- Transaction history shows all operations (including reversals)

---

## Database Validation Queries

### Check Active SOPs for a Voucher
```sql
-- Replace {voucher_id} with the payment_vouchers.id (NOT document_id)
SELECT
    sop.id,
    d.document_number,
    d.status,
    d.deleted_at,
    sop.linked_voucher_id
FROM statements_of_payment sop
JOIN documents d ON d.id = sop.document_id
WHERE sop.linked_voucher_id = '{voucher_id}'
    AND d.deleted_at IS NULL;  -- Only active SOPs
```

### Check Transaction History
```sql
-- Check all transactions for an account
SELECT
    t.id,
    t.transaction_type,
    t.amount,
    t.balance_before,
    t.balance_after,
    t.description,
    t.transaction_date,
    t.metadata,
    d.document_number,
    d.deleted_at
FROM transactions t
JOIN documents d ON d.id = t.document_id
WHERE t.account_id = '{account_id}'
ORDER BY t.transaction_date DESC;
```

### Verify Partial Index is Working
```sql
-- This should show the new partial index
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'statements_of_payment'
    AND indexname LIKE '%linked_voucher%';
```

## Edge Cases to Test

### Edge Case 1: Concurrent Operations
Test that two users cannot create duplicate SOPs simultaneously:
1. Open two sessions/devices
2. Try to create SOPs for the same voucher at the same time
3. One should succeed, the other should fail with constraint violation

### Edge Case 2: Restore Soft-Deleted SOP
If you implement an "undelete" feature:
1. Soft-delete a SOP
2. Create a new SOP for the same voucher
3. Attempt to restore the old SOP
4. Should fail due to unique constraint (only one active SOP allowed)

### Edge Case 3: Database Trigger Interactions
Verify the soft-delete trigger works correctly:
1. Create and complete a SOP (increases account balance)
2. Soft-delete the SOP
3. Verify that the trigger reverses the transaction (decreases account balance)
4. Check that reversal transaction has `metadata: {reversal: true}`

## Rollback Plan

If issues are found, the migration can be rolled back:

```sql
-- Drop the partial index
DROP INDEX IF EXISTS statements_of_payment_linked_voucher_id_active_idx;

-- Restore the original UNIQUE constraint
ALTER TABLE statements_of_payment
ADD CONSTRAINT statements_of_payment_linked_voucher_id_key
UNIQUE (linked_voucher_id);
```

**Warning**: This rollback will fail if there are multiple soft-deleted SOPs for the same voucher. You'll need to clean up the data first.

## Success Criteria

All tests pass if:
- ✅ SOPs can be created for vouchers
- ✅ Only one active SOP can exist per voucher
- ✅ SOPs can be soft-deleted successfully
- ✅ New SOPs can be created after soft-delete
- ✅ Vouchers cannot be deleted with active SOPs
- ✅ Vouchers can be deleted after SOP soft-delete
- ✅ Account balances remain accurate throughout all operations
- ✅ Transaction history shows all operations including reversals
- ✅ No database constraint violations occur during normal operations

## Known Limitations

1. **Hard Delete**: If you ever need to truly delete (hard delete) records from the database, you'll need to handle the cascade manually since we're using soft deletes.

2. **Performance**: The partial index uses a subquery (`WHERE document_id IN (SELECT...)`). For very large databases, this might have performance implications. Monitor query performance.

3. **Audit Trail**: Soft-deleted records remain in the database. Implement periodic cleanup if needed (e.g., purge records deleted > 1 year ago).

## Additional Notes

- The `checkCanDeleteDocument()` function is called twice: once in the UI for pre-validation, and once in `deleteDocument()` for defense in depth
- All deletion operations are logged to the activity log if a user is provided
- The partial index only applies to non-deleted documents, so the uniqueness constraint doesn't affect soft-deleted records
