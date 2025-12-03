# Changelog: Statement of Payment to Payment Voucher Linking Fix

**Date**: 2025-12-02
**Issue**: UNIQUE constraint with soft-delete causing SOP creation failures
**Status**: ✅ Fixed

---

## Summary

Fixed critical issues with Statement of Payment (SOP) to Payment Voucher linking:

1. **Database Schema Issue**: The UNIQUE constraint on `linked_voucher_id` prevented creating a new SOP for a voucher after the previous SOP was soft-deleted
2. **Validation Issue**: Payment Vouchers could be deleted even when an active SOP referenced them, causing orphaned records

## Changes Made

### 1. Database Migration (Migration 016)

**File**: `/Users/firdaus/Documents/2025/code/wif-fin-mobile-app/wif-finance/supabase/migrations/016_fix_sop_voucher_unique_constraint.sql`

**Changes**:
- Dropped the UNIQUE constraint on `statements_of_payment.linked_voucher_id`
- Created a partial unique index that only enforces uniqueness for non-deleted records
- Index name: `statements_of_payment_linked_voucher_id_active_idx`
- Condition: `WHERE document_id IN (SELECT id FROM documents WHERE deleted_at IS NULL)`

**Impact**:
- Allows multiple soft-deleted SOPs for the same voucher (historical records)
- Enforces only one active (non-deleted) SOP per voucher at any time
- Maintains data integrity while supporting soft-delete workflow

---

### 2. Document Service Enhancement

**File**: `/Users/firdaus/Documents/2025/code/wif-fin-mobile-app/wif-finance/src/services/documents/documentService.ts`

**Changes**:

#### a. Fixed `checkCanDeleteDocument()` function (Lines 644-669)
- **Before**: Query didn't filter out soft-deleted statements
- **After**: Now filters statements by `documents.deleted_at IS NULL`
- Only checks for ACTIVE (non-deleted) SOPs when validating voucher deletion

**Code Changes**:
```typescript
// Added deleted_at to the select
.select('id, documents!inner(document_number, deleted_at)')

// Filter for non-deleted statements only
const activeStatements = statements?.filter((sop: any) => {
  const doc = Array.isArray(sop.documents) ? sop.documents[0] : sop.documents
  return doc && !doc.deleted_at
})
```

#### b. Enhanced validation in `deleteDocument()` (Lines 687-725)
- Already calls `checkCanDeleteDocument()` internally
- Throws clear error messages when deletion is blocked
- Maintains defense-in-depth approach

**Impact**:
- Prevents deletion of vouchers with active SOPs
- Allows deletion of vouchers when all linked SOPs are soft-deleted
- Provides clear, actionable error messages to users

---

### 3. Mobile App UI Update

**File**: `/Users/firdaus/Documents/2025/code/wif-fin-mobile-app/wif-finance/app/document/voucher/[id].tsx`

**Changes**:

#### a. Import added (Line 11)
```typescript
import { checkCanDeleteDocument } from '../../../src/services'
```

#### b. Removed direct supabase queries (Line 15)
- Removed unused `import { supabase } from '../../../src/services/api/supabaseClient'`

#### c. Refactored `handleDelete()` function (Lines 220-265)
- **Before**: Direct supabase queries that didn't filter soft-deleted records
- **After**: Uses `checkCanDeleteDocument()` service function with proper filtering

**Code Changes**:
```typescript
// Pre-delete validation using service function
const validation = await checkCanDeleteDocument(voucher.id)
if (!validation.canDelete) {
  Alert.alert('Cannot Delete', validation.reason || 'This document cannot be deleted')
  return
}
```

**Impact**:
- Consistent validation logic across app and service layer
- Better error messages for users
- Proper handling of soft-deleted records
- Added permission check before validation

---

## Files Modified

1. ✅ `supabase/migrations/016_fix_sop_voucher_unique_constraint.sql` (NEW)
2. ✅ `src/services/documents/documentService.ts` (MODIFIED)
3. ✅ `app/document/voucher/[id].tsx` (MODIFIED)
4. ✅ `TESTING_SOP_VOUCHER_LINKING.md` (NEW - Testing guide)
5. ✅ `CHANGELOG_SOP_VOUCHER_FIX.md` (NEW - This file)

## Testing Required

See `TESTING_SOP_VOUCHER_LINKING.md` for comprehensive testing instructions.

**Key Test Scenarios**:
1. Create SOP for voucher → Delete SOP → Create new SOP for same voucher ✅ Should work
2. Try to delete voucher with active SOP ✅ Should be blocked with clear message
3. Delete SOP → Delete voucher ✅ Should work
4. Multiple create/delete cycles ✅ Should work without constraint violations

## Migration Instructions

### Step 1: Apply Database Migration

```bash
# Using Supabase CLI
cd /Users/firdaus/Documents/2025/code/wif-fin-mobile-app/wif-finance
supabase db push
```

Or manually in Supabase Studio:
1. Go to SQL Editor
2. Open `supabase/migrations/016_fix_sop_voucher_unique_constraint.sql`
3. Execute the SQL

### Step 2: Verify Migration

Run these queries in Supabase Studio:

```sql
-- Check old constraint is removed
SELECT COUNT(*) FROM pg_constraint
WHERE conname = 'statements_of_payment_linked_voucher_id_key';
-- Should return: 0

-- Check new index exists
SELECT COUNT(*) FROM pg_indexes
WHERE indexname = 'statements_of_payment_linked_voucher_id_active_idx';
-- Should return: 1
```

### Step 3: Deploy Mobile App

The mobile app changes are already in the codebase. Just rebuild and deploy:

```bash
# For development
npm run ios
# or
npm run android

# For production
eas build --platform ios
eas build --platform android
```

### Step 4: Test

Follow the test cases in `TESTING_SOP_VOUCHER_LINKING.md`

## Rollback Procedure

If issues arise, you can rollback the migration:

```sql
-- Drop the partial index
DROP INDEX IF EXISTS statements_of_payment_linked_voucher_id_active_idx;

-- Restore the original UNIQUE constraint
ALTER TABLE statements_of_payment
ADD CONSTRAINT statements_of_payment_linked_voucher_id_key
UNIQUE (linked_voucher_id);
```

**⚠️ Warning**: Rollback will fail if there are multiple soft-deleted SOPs for the same voucher. Clean up data first if needed.

## Performance Considerations

The partial unique index uses a subquery to check `deleted_at` on the documents table:

```sql
WHERE document_id IN (SELECT id FROM documents WHERE deleted_at IS NULL)
```

**Monitoring**:
- For small to medium databases (<100k documents): No performance impact expected
- For large databases (>100k documents): Monitor index performance
- If performance issues arise, consider adding a `deleted_at` column directly to `statements_of_payment` table

**Alternative Approach** (if performance is an issue):
```sql
-- Add deleted_at to statements_of_payment
ALTER TABLE statements_of_payment ADD COLUMN deleted_at TIMESTAMPTZ;

-- Keep in sync with documents table via trigger
CREATE TRIGGER sync_sop_deleted_at
AFTER UPDATE OF deleted_at ON documents
FOR EACH ROW
WHEN (NEW.document_type = 'statement_of_payment')
EXECUTE FUNCTION sync_sop_deleted_at_fn();

-- Simpler partial index
CREATE UNIQUE INDEX statements_of_payment_linked_voucher_id_active_idx
ON statements_of_payment (linked_voucher_id)
WHERE deleted_at IS NULL;
```

This alternative approach was NOT implemented in this fix to avoid schema changes and maintain consistency with the existing soft-delete pattern.

## Future Enhancements

1. **Audit Trail Cleanup**: Implement periodic cleanup of soft-deleted records older than X months
2. **Performance Optimization**: If database grows large, consider the alternative approach mentioned above
3. **Restore Functionality**: Add UI to restore soft-deleted documents (with validation to prevent duplicate active SOPs)
4. **Cascade Soft-Delete**: When voucher is deleted, optionally soft-delete linked SOPs
5. **Visual Indicators**: Show warning in UI when viewing vouchers that have soft-deleted SOPs

## References

- Original Schema: `supabase/migrations/001_initial_schema.sql` (Line 188)
- Soft-Delete Trigger: `supabase/migrations/015_handle_document_soft_delete.sql`
- Document Service: `src/services/documents/documentService.ts`
- Service Exports: `src/services/index.ts`

## Support

For questions or issues, refer to:
1. This changelog
2. Testing guide: `TESTING_SOP_VOUCHER_LINKING.md`
3. Migration file: `supabase/migrations/016_fix_sop_voucher_unique_constraint.sql`
4. Service documentation in `documentService.ts`
