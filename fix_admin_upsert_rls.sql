-- FIX RLS POLICIES FOR ADMIN UPSERTS
-- This script allows admins to use the "Upsert" (POST) method
-- which is the fallback for when "Update" (PATCH) is blocked by network issues.

-- 1. Grant INSERT permission to admins on the 'users' table
-- This allows admins to update (via upsert) other users' profiles
DROP POLICY IF EXISTS "Admins can insert any user profile" ON public.users;
CREATE POLICY "Admins can insert any user profile"
    ON public.users FOR INSERT
    WITH CHECK (public.is_admin());

-- 2. Grant INSERT permission to admins on the 'requests' table
-- This allows admins to update (via upsert) request statuses
DROP POLICY IF EXISTS "Admins can insert requests" ON public.requests;
CREATE POLICY "Admins can insert requests"
    ON public.requests FOR INSERT
    WITH CHECK (public.is_admin());

-- 3. Ensure admins have SELECT/UPDATE/DELETE too (redundant but safe)
-- These should already exist from previous scripts, but good to have.

-- Refresh the schema cache
NOTIFY pgrst, 'reload schema';
