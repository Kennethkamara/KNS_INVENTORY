-- ============================================
-- REFRESH SUPABASE API SCHEMA CACHE
-- This forces Supabase to recognize the new TEXT ID format
-- ============================================

-- Notify Supabase to refresh the API schema
NOTIFY pgrst, 'reload schema';

-- Alternative: Update table comment to trigger schema refresh
COMMENT ON TABLE public.inventory_items IS 'Inventory items with custom TEXT IDs (updated)';

-- Verify the table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'inventory_items'
ORDER BY ordinal_position;
