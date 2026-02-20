-- Fix for CORS/Patch error on Inventory Items

-- 1. Ensure columns exist (Missing columns cause 400 errors masked as CORS)
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS brand TEXT;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS type TEXT;

-- 2. Reset RLS Policies to ensure UPDATE is allowed
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies to avoid conflicts
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.inventory_items;
DROP POLICY IF EXISTS "Allow read access for all users" ON public.inventory_items;
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON public.inventory_items;
DROP POLICY IF EXISTS "Allow update for authenticated users" ON public.inventory_items;
DROP POLICY IF EXISTS "Allow delete for authenticated users" ON public.inventory_items;

-- Create a single permissive policy for authenticated users
CREATE POLICY "Enable all for authenticated users"
ON public.inventory_items
FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Verify public access for read-only (optional, if needed for non-logged in users)
-- CREATE POLICY "Enable read access for all users" ON public.inventory_items FOR SELECT USING (true);
