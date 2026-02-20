-- ============================================
-- FINAL FIX FOR "FAILED TO FETCH" / CORS ERRORS
-- ============================================

-- 1. Normalize all user roles to lowercase
-- This ensures 'Admin', 'ADMIN' become 'admin'
UPDATE public.users 
SET role = LOWER(role);

-- 2. Drop existing policies to start fresh
DROP POLICY IF EXISTS "Allow UPDATE for admins" ON public.inventory_items;
DROP POLICY IF EXISTS "Allow INSERT for admins" ON public.inventory_items;
DROP POLICY IF EXISTS "Allow DELETE for admins" ON public.inventory_items;
DROP POLICY IF EXISTS "Allow SELECT for authenticated users" ON public.inventory_items;

-- 3. Create Case-Insensitive RLS Policies
-- Use LOWER(role) to be extra safe

-- SELECT: Allow everyone logged in
CREATE POLICY "Allow SELECT for all logged in"
ON public.inventory_items FOR SELECT
TO authenticated
USING (true);

-- UPDATE: Allow admins (case-insensitive check)
CREATE POLICY "Allow UPDATE for admins"
ON public.inventory_items FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() AND LOWER(role) = 'admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() AND LOWER(role) = 'admin'
    )
);

-- INSERT: Allow admins
CREATE POLICY "Allow INSERT for admins"
ON public.inventory_items FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() AND LOWER(role) = 'admin'
    )
);

-- DELETE: Allow admins
CREATE POLICY "Allow DELETE for admins"
ON public.inventory_items FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() AND LOWER(role) = 'admin'
    )
);

-- 4. Verify the fix
-- Check if your user has the correct role
SELECT id, email, role FROM public.users WHERE role = 'admin' LIMIT 5;

-- 5. Force Schema Refresh (just in case)
NOTIFY pgrst, 'reload schema';
