-- ============================================
-- ADD DEPARTMENT COLUMN TO INVENTORY_ITEMS
-- ============================================

-- 1. Add department column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='inventory_items' AND column_name='department') THEN
        ALTER TABLE public.inventory_items ADD COLUMN department TEXT;
    END IF;
END $$;

-- 2. Migrate existing data from location to department
-- Only update if department is NULL and location is NOT NULL
UPDATE public.inventory_items 
SET department = location 
WHERE department IS NULL AND location IS NOT NULL;

-- 3. Set default for new items if needed (optional)
-- ALTER TABLE public.inventory_items ALTER COLUMN department SET DEFAULT 'General';

-- 4. Verify columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'inventory_items' 
AND column_name IN ('location', 'department');
