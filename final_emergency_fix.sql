-- EMERGENCY FIX SCRIPT
-- Copy and run this in Supabase SQL Editor to resolve "Failed to Fetch" and "Permission Denied" errors.

-- 1. Ensure all necessary columns exist (Safe to run multiple times)
DO $$
BEGIN
    ALTER TABLE public.inventory_items ADD COLUMN supplier text DEFAULT '';
EXCEPTION
    WHEN duplicate_column THEN RAISE NOTICE 'column supplier already exists';
END $$;

DO $$
BEGIN
    ALTER TABLE public.inventory_items ADD COLUMN brand text DEFAULT '';
EXCEPTION
    WHEN duplicate_column THEN RAISE NOTICE 'column brand already exists';
END $$;

DO $$
BEGIN
    ALTER TABLE public.inventory_items ADD COLUMN type text DEFAULT '';
EXCEPTION
    WHEN duplicate_column THEN RAISE NOTICE 'column type already exists';
END $$;

DO $$
BEGIN
    ALTER TABLE public.inventory_items ADD COLUMN image_url text DEFAULT '';
EXCEPTION
    WHEN duplicate_column THEN RAISE NOTICE 'column image_url already exists';
END $$;

DO $$
BEGIN
    ALTER TABLE public.inventory_items ADD COLUMN min_stock_level integer DEFAULT 5;
EXCEPTION
    WHEN duplicate_column THEN RAISE NOTICE 'column min_stock_level already exists';
END $$;

DO $$
BEGIN
    ALTER TABLE public.inventory_items ADD COLUMN location text DEFAULT 'General';
EXCEPTION
    WHEN duplicate_column THEN RAISE NOTICE 'column location already exists';
END $$;

-- 2. Reset Permissions completely
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

-- Drop all restrictive policies
DROP POLICY IF EXISTS "Access All" ON public.inventory_items;
DROP POLICY IF EXISTS "Allow All" ON public.inventory_items;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.inventory_items;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.inventory_items;
DROP POLICY IF EXISTS "Enable update for all users" ON public.inventory_items;
DROP POLICY IF EXISTS "Enable delete for all users" ON public.inventory_items;
DROP POLICY IF EXISTS "Public Read" ON public.inventory_items;
DROP POLICY IF EXISTS "Public Write" ON public.inventory_items;

-- Create ONE permissive policy for everyone
CREATE POLICY "Allow All Operations"
ON public.inventory_items
FOR ALL
USING (true)
WITH CHECK (true);

-- Grant privileges to roles
GRANT ALL ON TABLE public.inventory_items TO anon;
GRANT ALL ON TABLE public.inventory_items TO authenticated;
GRANT ALL ON TABLE public.inventory_items TO service_role;
