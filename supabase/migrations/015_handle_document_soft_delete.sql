-- Migration: Handle document soft-delete by reversing transactions
-- When a document is soft-deleted (deleted_at set), reverse its transaction
-- When a document is restored (deleted_at cleared), recreate the transaction

-- ============================================================================
-- TRIGGER FUNCTION: Handle document soft-delete
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_document_soft_delete()
RETURNS TRIGGER AS $$
DECLARE
    v_account_id UUID;
    v_transaction_type TEXT;
    v_amount DECIMAL(15,2);
    v_current_balance DECIMAL(15,2);
    v_new_balance DECIMAL(15,2);
    v_description TEXT;
BEGIN
    -- Only handle documents that affect accounts (receipts and statements of payment)
    IF NEW.document_type NOT IN ('receipt', 'statement_of_payment') THEN
        RETURN NEW;
    END IF;

    -- Only proceed if document was completed (has account_id)
    IF NEW.account_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- ========================================================================
    -- CASE 1: Document is being SOFT-DELETED (deleted_at changed from NULL to a value)
    -- ========================================================================
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
        RAISE NOTICE 'Document % is being soft-deleted, reversing transaction', NEW.document_number;

        -- Get current account balance
        SELECT current_balance INTO v_current_balance
        FROM accounts
        WHERE id = NEW.account_id;

        -- Determine reversal type (opposite of original)
        IF NEW.document_type = 'receipt' THEN
            -- Receipt originally increased balance, so we decrease
            v_transaction_type := 'decrease';
            v_amount := NEW.amount;
            v_new_balance := v_current_balance - v_amount;
            v_description := 'Reversed: ' || COALESCE(NEW.document_number, 'Unknown');
        ELSE
            -- Statement of payment originally decreased balance, so we increase
            v_transaction_type := 'increase';
            v_amount := NEW.amount;
            v_new_balance := v_current_balance + v_amount;
            v_description := 'Reversed: ' || COALESCE(NEW.document_number, 'Unknown');
        END IF;

        -- Create reversal transaction
        INSERT INTO transactions (
            account_id,
            document_id,
            transaction_type,
            amount,
            balance_before,
            balance_after,
            description,
            transaction_date,
            metadata
        ) VALUES (
            NEW.account_id,
            NEW.id,
            v_transaction_type,
            v_amount,
            v_current_balance,
            v_new_balance,
            v_description,
            NOW(),
            jsonb_build_object('reversal', true, 'reason', 'document_deleted')
        );

        -- Update account balance
        UPDATE accounts
        SET current_balance = v_new_balance
        WHERE id = NEW.account_id;

        RAISE NOTICE 'Reversed transaction for document %. Balance: % -> %',
            NEW.document_number, v_current_balance, v_new_balance;

    -- ========================================================================
    -- CASE 2: Document is being RESTORED (deleted_at changed from a value to NULL)
    -- ========================================================================
    ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
        -- Only restore if document is still completed
        IF NEW.status = 'completed' THEN
            RAISE NOTICE 'Document % is being restored, recreating transaction', NEW.document_number;

            -- Get current account balance
            SELECT current_balance INTO v_current_balance
            FROM accounts
            WHERE id = NEW.account_id;

            -- Determine transaction type (same as original)
            IF NEW.document_type = 'receipt' THEN
                v_transaction_type := 'increase';
                v_amount := NEW.amount;
                v_new_balance := v_current_balance + v_amount;
                v_description := 'Payment received - ' || NEW.document_number;
            ELSE
                v_transaction_type := 'decrease';
                v_amount := NEW.amount;
                v_new_balance := v_current_balance - v_amount;
                v_description := 'Payment made - ' || NEW.document_number;
            END IF;

            -- Create restored transaction
            INSERT INTO transactions (
                account_id,
                document_id,
                transaction_type,
                amount,
                balance_before,
                balance_after,
                description,
                transaction_date,
                metadata
            ) VALUES (
                NEW.account_id,
                NEW.id,
                v_transaction_type,
                v_amount,
                v_current_balance,
                v_new_balance,
                v_description,
                NOW(),
                jsonb_build_object('restored', true, 'reason', 'document_restored')
            );

            -- Update account balance
            UPDATE accounts
            SET current_balance = v_new_balance
            WHERE id = NEW.account_id;

            RAISE NOTICE 'Restored transaction for document %. Balance: % -> %',
                NEW.document_number, v_current_balance, v_new_balance;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- CREATE TRIGGER
-- ============================================================================

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_document_soft_delete ON documents;

-- Create new trigger that fires AFTER UPDATE on deleted_at
CREATE TRIGGER on_document_soft_delete
    AFTER UPDATE OF deleted_at ON documents
    FOR EACH ROW
    EXECUTE FUNCTION handle_document_soft_delete();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION handle_document_soft_delete() IS
'Automatically reverses transactions when documents are soft-deleted and recreates them when restored.
This ensures ledger balances stay accurate when documents are deleted or restored.';

COMMENT ON TRIGGER on_document_soft_delete ON documents IS
'Triggers transaction reversal/recreation when a document is soft-deleted or restored.';
