-- KNS Inventory System Database Schema
-- Run this in your Supabase SQL Editor

-- ============================================
-- 1. USERS TABLE (Extended Profile)
-- ============================================
CREATE TABLE IF NOT EXISTS public.users (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 2. INVENTORY ITEMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.inventory_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    item_name TEXT NOT NULL,
    category TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    unit TEXT NOT NULL,
    condition TEXT CHECK (condition IN ('new', 'good', 'fair', 'poor')),
    location TEXT,
    min_stock_level INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 3. STOCK MOVEMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.stock_movements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    item_id UUID REFERENCES public.inventory_items(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id),
    movement_type TEXT NOT NULL CHECK (movement_type IN ('in', 'out', 'adjustment')),
    quantity INTEGER NOT NULL,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 4. REQUESTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id),
    item_id UUID REFERENCES public.inventory_items(id),
    quantity INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'fulfilled')),
    reason TEXT,
    admin_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_inventory_category ON public.inventory_items(category);
CREATE INDEX IF NOT EXISTS idx_inventory_quantity ON public.inventory_items(quantity);
CREATE INDEX IF NOT EXISTS idx_stock_movements_item ON public.stock_movements(item_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_user ON public.stock_movements(user_id);
CREATE INDEX IF NOT EXISTS idx_requests_user ON public.requests(user_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON public.requests(status);

-- ============================================
-- TRIGGER: Update updated_at timestamp
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_inventory_items_updated_at
    BEFORE UPDATE ON public.inventory_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_requests_updated_at
    BEFORE UPDATE ON public.requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;

-- USERS TABLE POLICIES
CREATE POLICY "Users can view their own profile"
    ON public.users FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Admins can view all users"
    ON public.users FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Users can update their own profile"
    ON public.users FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Admins can update any user"
    ON public.users FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- INVENTORY ITEMS POLICIES
CREATE POLICY "Anyone authenticated can view inventory"
    ON public.inventory_items FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Only admins can insert inventory items"
    ON public.inventory_items FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Only admins can update inventory items"
    ON public.inventory_items FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Only admins can delete inventory items"
    ON public.inventory_items FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- STOCK MOVEMENTS POLICIES
CREATE POLICY "Anyone authenticated can view stock movements"
    ON public.stock_movements FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Only admins can insert stock movements"
    ON public.stock_movements FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- REQUESTS POLICIES
CREATE POLICY "Users can view their own requests"
    ON public.requests FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all requests"
    ON public.requests FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Users can create their own requests"
    ON public.requests FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Only admins can update requests"
    ON public.requests FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- ============================================
-- FUNCTION: Get Low Stock Items
-- ============================================
CREATE OR REPLACE FUNCTION get_low_stock_items()
RETURNS TABLE (
    id UUID,
    item_name TEXT,
    category TEXT,
    quantity INTEGER,
    min_stock_level INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        i.id,
        i.item_name,
        i.category,
        i.quantity,
        i.min_stock_level
    FROM public.inventory_items i
    WHERE i.quantity <= i.min_stock_level
    ORDER BY i.quantity ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION: Fulfill Request (Update inventory)
-- ============================================
CREATE OR REPLACE FUNCTION fulfill_request(request_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    req_item_id UUID;
    req_quantity INTEGER;
    current_quantity INTEGER;
BEGIN
    -- Get request details
    SELECT item_id, quantity INTO req_item_id, req_quantity
    FROM public.requests
    WHERE id = request_id AND status = 'approved';
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Request not found or not approved';
    END IF;
    
    -- Get current inventory quantity
    SELECT quantity INTO current_quantity
    FROM public.inventory_items
    WHERE id = req_item_id;
    
    -- Check if enough stock
    IF current_quantity < req_quantity THEN
        RAISE EXCEPTION 'Insufficient stock';
    END IF;
    
    -- Update inventory
    UPDATE public.inventory_items
    SET quantity = quantity - req_quantity
    WHERE id = req_item_id;
    
    -- Update request status
    UPDATE public.requests
    SET status = 'fulfilled', updated_at = NOW()
    WHERE id = request_id;
    
    -- Record stock movement
    INSERT INTO public.stock_movements (item_id, user_id, movement_type, quantity, reason)
    SELECT req_item_id, user_id, 'out', req_quantity, 'Request fulfilled'
    FROM public.requests
    WHERE id = request_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
