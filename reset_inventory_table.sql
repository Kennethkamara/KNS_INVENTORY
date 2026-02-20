-- ============================================
-- RESET INVENTORY TABLE (Resolves all schema/ID type conflicts)
-- WARNING: This will DELETE all existing inventory items!
-- ============================================

-- 1. Drop existing table and dependent objects
DROP TABLE IF EXISTS public.inventory_items CASCADE;

-- 2. Create table with correct schema (TEXT ID for custom IDs like PC-001)
CREATE TABLE public.inventory_items (
    id TEXT PRIMARY KEY,
    item_name TEXT NOT NULL,
    category TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    unit TEXT NOT NULL DEFAULT 'pcs',
    condition TEXT DEFAULT 'good',
    location TEXT,
    min_stock_level INTEGER DEFAULT 5,
    unit_price NUMERIC DEFAULT 0,
    description TEXT,
    image_url TEXT,
    supplier TEXT,
    brand TEXT,
    type TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Enable Security Policies
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to do everything
CREATE POLICY "Enable all for authenticated users" 
ON public.inventory_items FOR ALL 
USING (auth.role() = 'authenticated') 
WITH CHECK (auth.role() = 'authenticated');

-- 4. Create Index for performance
CREATE INDEX IF NOT EXISTS idx_inventory_category ON public.inventory_items(category);

-- 5. Force Schema Refresh
NOTIFY pgrst, 'reload schema';
