-- ============================================
-- 0. SCHEMA UPDATES (Safe Additions)
-- ============================================

-- Ensure stock_movements has from/to location columns
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stock_movements' AND column_name='from_location') THEN
        ALTER TABLE public.stock_movements ADD COLUMN from_location TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stock_movements' AND column_name='to_location') THEN
        ALTER TABLE public.stock_movements ADD COLUMN to_location TEXT;
    END IF;
END $$;

-- Ensure inventory_items has assigned_to and status
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory_items' AND column_name='assigned_to') THEN
        ALTER TABLE public.inventory_items ADD COLUMN assigned_to UUID REFERENCES public.users(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory_items' AND column_name='status') THEN
        ALTER TABLE public.inventory_items ADD COLUMN status TEXT DEFAULT 'available';
    END IF;
END $$;

-- ============================================
-- 1. Update update_inventory_quantity RPC
-- Handles automatic status and assignment syncing
-- ============================================

DROP FUNCTION IF EXISTS public.update_inventory_quantity(uuid, integer);
DROP FUNCTION IF EXISTS public.update_inventory_quantity(text, integer);
DROP FUNCTION IF EXISTS public.update_inventory_quantity(text, integer, uuid);

CREATE OR REPLACE FUNCTION update_inventory_quantity(
    p_item_id TEXT, 
    p_quantity_change INTEGER,
    p_assigned_to UUID DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    current_qty INTEGER;
    current_status TEXT;
BEGIN
    -- Get current state
    SELECT quantity, status INTO current_qty, current_status
    FROM public.inventory_items
    WHERE id::text = p_item_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Item not found: %', p_item_id;
    END IF;

    -- 1. Prevent negative quantities
    IF (current_qty + p_quantity_change) < 0 THEN
        RAISE EXCEPTION 'Insufficient stock. Current: %, Requested change: %', current_qty, p_quantity_change;
    END IF;

    -- 2. Prevent issuing an already issued item
    IF p_quantity_change < 0 AND current_status = 'issued' THEN
        RAISE EXCEPTION 'Item is already issued and cannot be issued again until returned.';
    END IF;

    -- 3. Perform update
    UPDATE public.inventory_items
    SET 
        quantity = quantity + p_quantity_change,
        status = CASE 
            WHEN (quantity + p_quantity_change) = 0 THEN 'issued'
            ELSE 'available'
        END,
        assigned_to = CASE 
            WHEN p_quantity_change < 0 THEN p_assigned_to
            ELSE NULL
        END,
        updated_at = NOW()
    WHERE id::text = p_item_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 2. Update fulfill_request RPC
-- Uses the updated logic to ensure consistency
-- ============================================

DROP FUNCTION IF EXISTS public.fulfill_request(uuid);

CREATE OR REPLACE FUNCTION fulfill_request(p_request_id UUID)
RETURNS JSON AS $$
DECLARE
    req_record RECORD;
    output JSON;
BEGIN
    -- Get request details
    SELECT * INTO req_record
    FROM public.requests
    WHERE id = p_request_id;

    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Request not found');
    END IF;

    IF req_record.status = 'fulfilled' THEN
        RETURN json_build_object('error', 'Request already fulfilled');
    END IF;

    -- Call updated quantity function (implicitly handles checks)
    BEGIN
        PERFORM update_inventory_quantity(
            req_record.item_id::text, 
            -req_record.quantity, 
            req_record.user_id
        );
    EXCEPTION WHEN OTHERS THEN
        RETURN json_build_object('error', SQLERRM);
    END;

    -- Update Request Status
    UPDATE public.requests
    SET status = 'fulfilled', updated_at = NOW()
    WHERE id = p_request_id;

    -- Record Stock Movement
    INSERT INTO public.stock_movements (item_id, user_id, movement_type, quantity, reason, to_location)
    VALUES (req_record.item_id, req_record.user_id, 'out', req_record.quantity, 'Request Fulfilled', 'User');

    RETURN json_build_object('success', true, 'item_id', req_record.item_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
