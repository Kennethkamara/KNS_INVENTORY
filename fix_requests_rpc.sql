-- FIX REQUEST APPROVAL (Run in Supabase SQL Editor)
-- This uses RPC (Database Functions) which use POST instead of PATCH, bypassing CORS issues.

-- 1. Ensure department column exists in requests
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='requests' AND column_name='department') THEN
        ALTER TABLE public.requests ADD COLUMN department TEXT;
    END IF;
END $$;

-- 2. Update existing requests to have user's department as default if null
UPDATE public.requests r
SET department = u.department
FROM public.users u
WHERE r.user_id = u.id AND r.department IS NULL;

-- 3. Create RPC for updating request status
CREATE OR REPLACE FUNCTION public.update_request_status(
    p_request_id UUID, 
    p_status TEXT, 
    p_admin_notes TEXT DEFAULT ''
)
RETURNS VOID AS $$
BEGIN
    UPDATE public.requests 
    SET status = p_status, 
        admin_notes = p_admin_notes,
        updated_at = NOW()
    WHERE id = p_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
