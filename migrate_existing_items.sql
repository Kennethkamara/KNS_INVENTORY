-- ============================================
-- MIGRATE EXISTING ITEMS TO CUSTOM ID FORMAT
-- !! IMPORTANT: Run this AFTER schema_custom_ids.sql !!
-- ============================================

-- This script converts all existing inventory items from UUID to custom IDs
-- and updates all foreign key references in stock_movements and requests tables

-- ============================================
-- BACKUP REMINDER
-- ============================================
-- Before running this migration:
-- 1. Go to Supabase Dashboard > Database > Backups
-- 2. Take a manual backup (or ensure auto-backup is recent)
-- 3. This migration is IRREVERSIBLE without a backup

-- ============================================
-- STEP 1: Create temporary mapping table
-- ============================================
CREATE TEMP TABLE id_mapping (
    old_id TEXT,
    new_id TEXT,
    category TEXT
);

-- ============================================
-- STEP 2: Generate new custom IDs for all existing items
-- ============================================
-- This inserts mappings of old UUID -> new custom ID
INSERT INTO id_mapping (old_id, new_id, category)
SELECT 
    id AS old_id,
    generate_inventory_id(category) AS new_id,
    category
FROM public.inventory_items
ORDER BY created_at ASC; -- Process oldest items first to maintain sequence

-- ============================================
-- STEP 3: Drop foreign key constraints FIRST
-- ============================================
-- Must drop these before we can modify the primary key
ALTER TABLE public.stock_movements DROP CONSTRAINT IF EXISTS stock_movements_item_id_fkey;
ALTER TABLE public.requests DROP CONSTRAINT IF EXISTS requests_item_id_fkey;

-- ============================================
-- STEP 4: Update foreign key references with new IDs
-- ============================================

-- Update stock_movements table
UPDATE public.stock_movements sm
SET item_id = im.new_id
FROM id_mapping im
WHERE sm.item_id = im.old_id;

-- Update requests table
UPDATE public.requests r
SET item_id = im.new_id
FROM id_mapping im
WHERE r.item_id = im.old_id;

-- ============================================
-- STEP 5: Update inventory_items table with new IDs
-- ============================================
-- We need to use a temporary column to avoid constraint violations
ALTER TABLE public.inventory_items ADD COLUMN new_id TEXT;

-- Populate the new_id column
UPDATE public.inventory_items ii
SET new_id = im.new_id
FROM id_mapping im
WHERE ii.id = im.old_id;

-- Drop the old primary key constraint (now safe since FKs are dropped)
ALTER TABLE public.inventory_items DROP CONSTRAINT IF EXISTS inventory_items_pkey;

-- Update the id column with new values
UPDATE public.inventory_items
SET id = new_id
WHERE new_id IS NOT NULL;

-- Drop the temporary column
ALTER TABLE public.inventory_items DROP COLUMN new_id;

-- Recreate the primary key constraint
ALTER TABLE public.inventory_items ADD PRIMARY KEY (id);

-- ============================================
-- STEP 6: Recreate foreign key constraints
-- ============================================
ALTER TABLE public.stock_movements 
    ADD CONSTRAINT stock_movements_item_id_fkey 
    FOREIGN KEY (item_id) 
    REFERENCES public.inventory_items(id) 
    ON DELETE CASCADE;

ALTER TABLE public.requests 
    ADD CONSTRAINT requests_item_id_fkey 
    FOREIGN KEY (item_id) 
    REFERENCES public.inventory_items(id) 
    ON DELETE CASCADE;

-- ============================================
-- STEP 5: Verify migration
-- ============================================
-- Check that all items have custom IDs (not UUIDs)
-- UUIDs have 36 chars with dashes, custom IDs are shorter
DO $$
DECLARE
    uuid_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO uuid_count
    FROM public.inventory_items
    WHERE LENGTH(id) = 36 AND id ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$';
    
    IF uuid_count > 0 THEN
        RAISE NOTICE 'WARNING: % items still have UUID format', uuid_count;
    ELSE
        RAISE NOTICE 'SUCCESS: All items migrated to custom ID format!';
    END IF;
END $$;

-- Display sample of new IDs
SELECT 
    id AS new_custom_id,
    item_name,
    category
FROM public.inventory_items
ORDER BY category, id
LIMIT 10;

-- Show ID counter status
SELECT 
    category AS prefix,
    last_number AS count,
    category || '-' || LPAD(last_number::TEXT, 3, '0') AS last_id_generated
FROM public.inventory_id_counters
ORDER BY category;

-- ============================================
-- MIGRATION COMPLETE!
-- ============================================
-- Your inventory items now use custom IDs like:
-- PC-001, PC-002 for computers
-- CHR-001, CHR-002 for chairs
-- TBL-001, TBL-002 for tables
-- etc.
