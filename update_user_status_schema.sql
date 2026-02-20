-- ADD STATUS COLUMN TO USERS TABLE

-- 1. Add column with default 'pending'
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

-- 2. Update existing users to 'approved' so current users aren't locked out
UPDATE public.users SET status = 'approved' WHERE status IS NULL OR status = 'pending';

-- 3. Ensure admins are always approved
UPDATE public.users SET status = 'approved' WHERE LOWER(role) = 'admin';

-- 4. Verify
SELECT id, email, role, status FROM public.users LIMIT 10;
