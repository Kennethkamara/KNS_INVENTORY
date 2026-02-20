-- KNS Inventory System Database Schema - FIXED RLS POLICIES
-- Run this in your Supabase SQL Editor

-- ============================================
-- FIRST: Drop existing policies if they exist
-- ============================================
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can update any user" ON public.users;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
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
-- USERS TABLE POLICIES - FIXED
-- ============================================

-- Allow users to INSERT their own profile during signup
CREATE POLICY "Users can insert their own profile"
    ON public.users FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Allow users to view their own profile
CREATE POLICY "Users can view their own profile"
    ON public.users FOR SELECT
    USING (auth.uid() = id);

-- Allow admins to view all users (using direct role check to avoid recursion)
CREATE POLICY "Admins can view all users"
    ON public.users FOR SELECT
    USING (
        (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
    );

-- Allow users to update their own profile
CREATE POLICY "Users can update their own profile"
    ON public.users FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Allow admins to update any user
CREATE POLICY "Admins can update any user"
    ON public.users FOR UPDATE
    USING (
        (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
    );

-- Allow admins to delete users
CREATE POLICY "Admins can delete users"
    ON public.users FOR DELETE
    USING (
        (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
    );

-- ============================================
-- INVENTORY ITEMS POLICIES - FIXED
-- ============================================

-- Anyone authenticated can view inventory
CREATE POLICY "Anyone authenticated can view inventory"
    ON public.inventory_items FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- Only admins can insert inventory items
CREATE POLICY "Only admins can insert inventory items"
    ON public.inventory_items FOR INSERT
    WITH CHECK (
        (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
    );

-- Only admins can update inventory items
CREATE POLICY "Only admins can update inventory items"
    ON public.inventory_items FOR UPDATE
    USING (
        (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
    );

-- Only admins can delete inventory items
CREATE POLICY "Only admins can delete inventory items"
    ON public.inventory_items FOR DELETE
    USING (
        (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
    );

-- ============================================
-- STOCK MOVEMENTS POLICIES - FIXED
-- ============================================

-- Anyone authenticated can view stock movements
CREATE POLICY "Anyone authenticated can view stock movements"
    ON public.stock_movements FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- Only admins can insert stock movements
CREATE POLICY "Only admins can insert stock movements"
    ON public.stock_movements FOR INSERT
    WITH CHECK (
        (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
    );

-- ============================================
-- REQUESTS POLICIES - FIXED
-- ============================================

-- Users can view their own requests
CREATE POLICY "Users can view their own requests"
    ON public.requests FOR SELECT
    USING (auth.uid() = user_id);

-- Admins can view all requests
CREATE POLICY "Admins can view all requests"
    ON public.requests FOR SELECT
    USING (
        (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
    );

-- Users can create their own requests
CREATE POLICY "Users can create their own requests"
    ON public.requests FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Only admins can update requests
CREATE POLICY "Only admins can update requests"
    ON public.requests FOR UPDATE
    USING (
        (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
    );
