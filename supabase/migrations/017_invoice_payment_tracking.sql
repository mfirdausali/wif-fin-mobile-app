-- ============================================================================
-- WIF Finance - Invoice Payment Tracking
-- Migration: 017
-- Description: Add view and helper function for tracking partial payments on invoices
-- ============================================================================

-- Problem:
-- When a partial payment (receipt) is made for an invoice, there's no easy way
-- to see the outstanding balance. Users need to manually calculate:
--   balance_due = invoice_total - sum(receipt_amounts)

-- Solution:
-- Create a view that calculates payment status for each invoice dynamically
-- from linked receipts. This maintains data integrity (single source of truth)
-- while providing convenient access to payment summaries.

-- ============================================================================
-- STEP 1: Create invoice payment summary view
-- ============================================================================

CREATE OR REPLACE VIEW invoice_payment_summary AS
SELECT
    i.id AS invoice_id,
    i.document_id,
    d.document_number,
    i.customer_name,
    d.currency,
    d.amount AS invoice_total,
    COALESCE(payment_data.total_paid, 0) AS amount_paid,
    d.amount - COALESCE(payment_data.total_paid, 0) AS balance_due,
    COALESCE(payment_data.payment_count, 0) AS payment_count,
    payment_data.last_payment_date,
    d.status,
    d.created_at,
    d.updated_at,
    -- Computed payment status
    CASE
        WHEN COALESCE(payment_data.total_paid, 0) = 0 THEN 'unpaid'
        WHEN COALESCE(payment_data.total_paid, 0) >= d.amount THEN 'fully_paid'
        ELSE 'partially_paid'
    END AS payment_status,
    -- Percentage paid (for progress bars)
    CASE
        WHEN d.amount = 0 THEN 100
        ELSE ROUND((COALESCE(payment_data.total_paid, 0) / d.amount * 100)::numeric, 1)
    END AS percent_paid
FROM invoices i
JOIN documents d ON i.document_id = d.id
LEFT JOIN LATERAL (
    SELECT
        SUM(rd.amount) AS total_paid,
        COUNT(*) AS payment_count,
        MAX(rd.document_date) AS last_payment_date
    FROM receipts r
    JOIN documents rd ON r.document_id = rd.id
    WHERE r.linked_invoice_id = i.id
      AND rd.deleted_at IS NULL  -- Exclude soft-deleted receipts
      AND rd.status IN ('completed', 'paid')  -- Only count completed receipts
) payment_data ON true
WHERE d.deleted_at IS NULL;  -- Exclude soft-deleted invoices

-- ============================================================================
-- STEP 2: Create helper function to get payment status for a single invoice
-- ============================================================================

CREATE OR REPLACE FUNCTION get_invoice_payment_status(p_invoice_document_id UUID)
RETURNS TABLE (
    invoice_total DECIMAL(15,2),
    amount_paid DECIMAL(15,2),
    balance_due DECIMAL(15,2),
    payment_count INTEGER,
    last_payment_date DATE,
    payment_status TEXT,
    percent_paid DECIMAL(5,1)
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ips.invoice_total,
        ips.amount_paid,
        ips.balance_due,
        ips.payment_count::INTEGER,
        ips.last_payment_date,
        ips.payment_status,
        ips.percent_paid
    FROM invoice_payment_summary ips
    WHERE ips.document_id = p_invoice_document_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- STEP 3: Create function to get all receipts for an invoice
-- ============================================================================

CREATE OR REPLACE FUNCTION get_invoice_receipts(p_invoice_id UUID)
RETURNS TABLE (
    receipt_id UUID,
    document_id UUID,
    document_number TEXT,
    amount DECIMAL(15,2),
    receipt_date DATE,
    payment_method TEXT,
    payer_name TEXT,
    status TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.id AS receipt_id,
        rd.id AS document_id,
        rd.document_number,
        rd.amount,
        r.receipt_date,
        r.payment_method,
        r.payer_name,
        rd.status
    FROM receipts r
    JOIN documents rd ON r.document_id = rd.id
    WHERE r.linked_invoice_id = p_invoice_id
      AND rd.deleted_at IS NULL
    ORDER BY r.receipt_date DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- STEP 4: Add comments for documentation
-- ============================================================================

COMMENT ON VIEW invoice_payment_summary IS
'Provides a summary of payment status for each invoice including:
- Total invoice amount
- Amount paid (sum of linked receipts)
- Balance due (remaining amount)
- Payment count and last payment date
- Payment status (unpaid, partially_paid, fully_paid)
- Percentage paid (for progress bars)

Automatically excludes soft-deleted invoices and receipts.';

COMMENT ON FUNCTION get_invoice_payment_status(UUID) IS
'Returns payment status for a single invoice by its document_id.
Use this when you need payment details for a specific invoice.';

COMMENT ON FUNCTION get_invoice_receipts(UUID) IS
'Returns all receipts linked to an invoice.
Use this to show payment history for an invoice.';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify the view exists
SELECT
    'invoice_payment_summary view created' as check_name,
    CASE
        WHEN EXISTS (
            SELECT 1 FROM pg_views WHERE viewname = 'invoice_payment_summary'
        ) THEN '✓ PASS'
        ELSE '✗ FAIL'
    END as status;

-- Verify the functions exist
SELECT
    'get_invoice_payment_status function created' as check_name,
    CASE
        WHEN EXISTS (
            SELECT 1 FROM pg_proc WHERE proname = 'get_invoice_payment_status'
        ) THEN '✓ PASS'
        ELSE '✗ FAIL'
    END as status;

SELECT
    'get_invoice_receipts function created' as check_name,
    CASE
        WHEN EXISTS (
            SELECT 1 FROM pg_proc WHERE proname = 'get_invoice_receipts'
        ) THEN '✓ PASS'
        ELSE '✗ FAIL'
    END as status;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
