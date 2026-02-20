-- ============================================
-- SETUP STORAGE FOR PROFILE AVATARS
-- ============================================

-- 0. Add missing columns to users table if they don't exist
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone TEXT;

-- 1. Create the 'avatars' bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Allow public access to read files
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
USING ( bucket_id = 'avatars' );

-- 3. Allow authenticated users to upload files
DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
CREATE POLICY "Authenticated Upload" 
ON storage.objects FOR INSERT 
WITH CHECK ( 
    bucket_id = 'avatars' 
    AND auth.role() = 'authenticated' 
);

-- 4. Allow users to update their own files
DROP POLICY IF EXISTS "Update Own Avatar" ON storage.objects;
CREATE POLICY "Update Own Avatar" 
ON storage.objects FOR UPDATE 
USING ( 
    bucket_id = 'avatars' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 5. Allow users to delete their own files
DROP POLICY IF EXISTS "Delete Own Avatar" ON storage.objects;
CREATE POLICY "Delete Own Avatar" 
ON storage.objects FOR DELETE 
USING ( 
    bucket_id = 'avatars' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);
