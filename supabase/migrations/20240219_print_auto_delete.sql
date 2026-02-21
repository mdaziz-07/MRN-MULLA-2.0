-- Migration: Add delivered_at and files_deleted columns to print_orders
-- These are used by the cleanup-print-files Edge Function

ALTER TABLE print_orders
    ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS files_deleted BOOLEAN NOT NULL DEFAULT FALSE;

-- Index for faster cleanup queries
CREATE INDEX IF NOT EXISTS idx_print_orders_cleanup
    ON print_orders (status, files_deleted, delivered_at)
    WHERE status = 'completed' AND files_deleted = FALSE;

-- Comment for documentation
COMMENT ON COLUMN print_orders.delivered_at IS 'Timestamp when order was marked completed. Files are deleted 1 hour after this time.';
COMMENT ON COLUMN print_orders.files_deleted IS 'True when uploaded files have been deleted from storage after delivery.';
