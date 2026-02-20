-- FINAL ROBUST FIX FOR USERS TABLE RLS (Run in Supabase SQL Editor)

-- 1. Normalize roles to lowercase to avoid case-sensitivity issues
UPDATE public.users 
SET role = LOWER(TRIM(role));

-- 2. Redefine is_admin() helper to be VERY robust
-- Use SECURITY DEFINER to bypass RLS during the check
-- Use EXISTS for efficiency and case-insensitivity
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND LOWER(role) = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Reset Users Table Policies
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can update any user" ON public.users;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can insert any user" ON public.users; -- New
DROP POLICY IF EXISTS "Admins can delete users" ON public.users;

-- SELECT: User sees self, Admin sees all
CREATE POLICY "Users can view their own profile"
    ON public.users FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Admins can view all users"
    ON public.users FOR SELECT
    USING (public.is_admin());

-- INSERT: User signs up, Admin creates users
CREATE POLICY "Users can insert their own profile"
    ON public.users FOR INSERT
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can insert any user"
    ON public.users FOR INSERT
    WITH CHECK (public.is_admin());

-- UPDATE: User updates self, Admin updates anyone
-- We use a single policy or separate ones. Separate is cleaner.
CREATE POLICY "Users can update their own profile"
    ON public.users FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can update any user"
    ON public.users FOR UPDATE
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- DELETE: Only admins
CREATE POLICY "Admins can delete users"
    ON public.users FOR DELETE
    USING (public.is_admin());

-- 4. Final verification notify
NOTIFY pgrst, 'reload schema';
