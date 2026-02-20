-- ============================================
-- CUSTOM INVENTORY ID FORMAT MIGRATION
-- Apply new format for future items only
-- ============================================

-- STEP 1: Create inventory ID counter table
-- This tracks the last used number for each category
CREATE TABLE IF NOT EXISTS public.inventory_id_counters (
    category TEXT PRIMARY KEY,
    last_number INTEGER DEFAULT 0
);

-- STEP 2: Create function to generate custom inventory IDs
-- Format: CATEGORY-NNN (e.g., PC-001, CHR-023, TBL-001)
-- Uses smart abbreviations: initials for multi-word, short codes for single words
CREATE OR REPLACE FUNCTION public.generate_inventory_id(item_category TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    prefix TEXT;
    words TEXT[];
    next_num INTEGER;
    new_id TEXT;
BEGIN
    -- Normalize: uppercase and trim
    prefix := UPPER(TRIM(item_category));
    
    -- Handle common category mappings first
    CASE prefix
        WHEN 'COMPUTERS' THEN prefix := 'PC';
        WHEN 'COMPUTER' THEN prefix := 'PC';
        WHEN 'LAPTOP' THEN prefix := 'PC';
        WHEN 'LAPTOPS' THEN prefix := 'PC';
        WHEN 'DESKTOP' THEN prefix := 'PC';
        WHEN 'DESKTOPS' THEN prefix := 'PC';
        WHEN 'CHAIRS' THEN prefix := 'CHR';
        WHEN 'CHAIR' THEN prefix := 'CHR';
        WHEN 'TABLES' THEN prefix := 'TBL';
        WHEN 'TABLE' THEN prefix := 'TBL';
        WHEN 'DESK' THEN prefix := 'DSK';
        WHEN 'DESKS' THEN prefix := 'DSK';
        WHEN 'MONITOR' THEN prefix := 'MON';
        WHEN 'MONITORS' THEN prefix := 'MON';
        WHEN 'PRINTER' THEN prefix := 'PRT';
        WHEN 'PRINTERS' THEN prefix := 'PRT';
        WHEN 'PROJECTOR' THEN prefix := 'PRJ';
        WHEN 'PROJECTORS' THEN prefix := 'PRJ';
        WHEN 'PHONE' THEN prefix := 'PHN';
        WHEN 'PHONES' THEN prefix := 'PHN';
        ELSE
            -- For unmapped categories, create abbreviation
            -- Remove special characters, keep only letters and spaces
            prefix := REGEXP_REPLACE(prefix, '[^A-Z ]', '', 'g');
            
            -- Split into words
            words := STRING_TO_ARRAY(prefix, ' ');
            
            -- If multi-word (e.g., "Office Supplies"), use initials
            IF ARRAY_LENGTH(words, 1) > 1 THEN
                prefix := '';
                FOR i IN 1..ARRAY_LENGTH(words, 1) LOOP
                    IF LENGTH(words[i]) > 0 THEN
                        prefix := prefix || LEFT(words[i], 1);
                    END IF;
                END LOOP;
            ELSE
                -- Single word: use first 3-4 characters
                prefix := LEFT(prefix, 4);
            END IF;
    END CASE;
    
    -- Ensure prefix is not empty and not too long
    IF LENGTH(prefix) = 0 THEN
        prefix := 'ITEM';
    END IF;
    prefix := LEFT(prefix, 6); -- Max 6 chars for prefix
    
    -- Get or create counter for this category
    INSERT INTO public.inventory_id_counters (category, last_number)
    VALUES (prefix, 0)
    ON CONFLICT (category) DO NOTHING;
    
    -- Increment and get next number (atomic operation)
    UPDATE public.inventory_id_counters
    SET last_number = last_number + 1
    WHERE category = prefix
    RETURNING last_number INTO next_num;
    
    -- Format: PREFIX-NNN (3 digits, zero-padded)
    new_id := prefix || '-' || LPAD(next_num::TEXT, 3, '0');
    
    RETURN new_id;
END;
$$;

-- STEP 3: Drop foreign key constraints first (to avoid type mismatch errors)
ALTER TABLE public.stock_movements DROP CONSTRAINT IF EXISTS stock_movements_item_id_fkey;
ALTER TABLE public.requests DROP CONSTRAINT IF EXISTS requests_item_id_fkey;

-- STEP 4: Modify inventory_items table to allow TEXT ids
-- Existing items keep their UUID, new items will get custom format
ALTER TABLE public.inventory_items ALTER COLUMN id TYPE TEXT;

-- STEP 5: Update foreign key columns to TEXT
ALTER TABLE public.stock_movements ALTER COLUMN item_id TYPE TEXT;
ALTER TABLE public.requests ALTER COLUMN item_id TYPE TEXT;

-- STEP 6: Recreate foreign key constraints with TEXT type
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

-- STEP 5: Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON public.inventory_id_counters TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_inventory_id(TEXT) TO anon, authenticated;

-- STEP 6: Test the function (optional - comment out after testing)
-- SELECT generate_inventory_id('Computers');  -- Should return PC-001
-- SELECT generate_inventory_id('Chairs');     -- Should return CHAIRS-001
-- SELECT generate_inventory_id('Tables');     -- Should return TABLES-001
-- SELECT generate_inventory_id('Computers');  -- Should return PC-002

-- STEP 7: View current counters (optional)
-- SELECT * FROM inventory_id_counters ORDER BY category;

-- ============================================
-- NOTES:
-- ============================================
-- 1. Existing items retain their UUID-based IDs
-- 2. New items created after this migration will get custom format
-- 3. The function is case-insensitive and handles variations
-- 4. Common categories (Computers, Laptops) are mapped to 'PC'
-- 5. Three-digit zero-padded numbering (001, 002, etc.)
-- 6. Safe to run multiple times (uses IF NOT EXISTS and ON CONFLICT)
