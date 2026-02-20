-- FIX USER APPROVAL (Run in Supabase SQL Editor)
-- This uses RPC (Database Functions) which use POST instead of PATCH, bypassing CORS issues.

-- 1. Create Approve User Function
CREATE OR REPLACE FUNCTION public.approve_user(target_user_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.users 
    SET status = 'approved' 
    WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create Reject User Function
CREATE OR REPLACE FUNCTION public.reject_user(target_user_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.users 
    SET status = 'rejected' 
    WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Ensure RLS is correct but RPCs with SECURITY DEFINER will bypass it for the update itself
-- We just want to make sure the users can still be viewed
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
CREATE POLICY "Admins can view all users"
    ON public.users FOR SELECT
    USING (public.is_admin());

-- 4. Verify existing status column exists
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='status') THEN
        ALTER TABLE public.users ADD COLUMN status TEXT DEFAULT 'pending';
    END IF;
END $$;
