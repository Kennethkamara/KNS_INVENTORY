-- ============================================
-- FIX UPDATE PERMISSIONS AFTER ID MIGRATION
-- ============================================

-- Ensure RLS is enabled
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Anyone can view inventory items" ON public.inventory_items;
DROP POLICY IF EXISTS "Admins can insert inventory items" ON public.inventory_items;
DROP POLICY IF EXISTS "Admins can update inventory items" ON public.inventory_items;
DROP POLICY IF EXISTS "Admins can delete inventory items" ON public.inventory_items;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.inventory_items;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.inventory_items;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.inventory_items;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.inventory_items;

-- Create new simplified policies
CREATE POLICY "Allow SELECT for authenticated users"
ON public.inventory_items FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow INSERT for admins"
ON public.inventory_items FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

CREATE POLICY "Allow UPDATE for admins"
ON public.inventory_items FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() AND role = 'admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

CREATE POLICY "Allow DELETE for admins"
ON public.inventory_items FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- Grant table permissions
GRANT ALL ON public.inventory_items TO authenticated;
GRANT SELECT ON public.inventory_items TO anon;

-- Verify policies are active
SELECT schemaname, tablename, policyname, permissive, roles, cmd 
FROM pg_policies 
WHERE tablename = 'inventory_items';

