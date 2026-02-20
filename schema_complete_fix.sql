-- COMPLETE FIX FOR RLS INFINITE RECURSION
-- Run this ENTIRE file in Supabase SQL Editor

-- ============================================
-- STEP 1: Drop all existing policies
-- ============================================
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can update any user" ON public.users;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can delete users" ON public.users;
DROP POLICY IF EXISTS "Anyone authenticated can view inventory" ON public.inventory_items;
DROP POLICY IF EXISTS "Only admins can insert inventory items" ON public.inventory_items;
DROP POLICY IF EXISTS "Only admins can update inventory items" ON public.inventory_items;
DROP POLICY IF EXISTS "Only admins can delete inventory items" ON public.inventory_items;
DROP POLICY IF EXISTS "Anyone authenticated can view stock movements" ON public.stock_movements;
DROP POLICY IF EXISTS "Only admins can insert stock movements" ON public.stock_movements;
DROP POLICY IF EXISTS "Users can view their own requests" ON public.requests;
DROP POLICY IF EXISTS "Admins can view all requests" ON public.requests;
DROP POLICY IF EXISTS "Users can create their own requests" ON public.requests;
DROP POLICY IF EXISTS "Only admins can update requests" ON public.requests;

-- ============================================
-- STEP 2: Create helper function to check admin role
-- This bypasses RLS to avoid recursion
-- ============================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        SELECT role = 'admin' 
        FROM public.users 
        WHERE id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- STEP 3: USERS TABLE POLICIES
-- ============================================

-- Allow users to INSERT during signup
CREATE POLICY "Users can insert their own profile"
    ON public.users FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Allow users to SELECT their own profile
CREATE POLICY "Users can view their own profile"
    ON public.users FOR SELECT
    USING (auth.uid() = id);

-- Allow admins to SELECT all users
CREATE POLICY "Admins can view all users"
    ON public.users FOR SELECT
    USING (public.is_admin());

-- Allow users to UPDATE their own profile
CREATE POLICY "Users can update their own profile"
    ON public.users FOR UPDATE
    USING (auth.uid() = id);

-- Allow admins to UPDATE any user
CREATE POLICY "Admins can update any user"
    ON public.users FOR UPDATE
    USING (public.is_admin());

-- Allow admins to DELETE users
CREATE POLICY "Admins can delete users"
    ON public.users FOR DELETE
    USING (public.is_admin());

-- ============================================
-- STEP 4: INVENTORY ITEMS POLICIES
-- ============================================

CREATE POLICY "Anyone authenticated can view inventory"
    ON public.inventory_items FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Only admins can insert inventory items"
    ON public.inventory_items FOR INSERT
    WITH CHECK (public.is_admin());

CREATE POLICY "Only admins can update inventory items"
    ON public.inventory_items FOR UPDATE
    USING (public.is_admin());

CREATE POLICY "Only admins can delete inventory items"
    ON public.inventory_items FOR DELETE
    USING (public.is_admin());

-- ============================================
-- STEP 5: STOCK MOVEMENTS POLICIES
-- ============================================

CREATE POLICY "Anyone authenticated can view stock movements"
    ON public.stock_movements FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Only admins can insert stock movements"
    ON public.stock_movements FOR INSERT
    WITH CHECK (public.is_admin());

-- ============================================
-- STEP 6: REQUESTS POLICIES
-- ============================================

CREATE POLICY "Users can view their own requests"
    ON public.requests FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all requests"
    ON public.requests FOR SELECT
    USING (public.is_admin());

CREATE POLICY "Users can create their own requests"
    ON public.requests FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Only admins can update requests"
    ON public.requests FOR UPDATE
    USING (public.is_admin());
