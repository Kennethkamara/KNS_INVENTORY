-- FIX REPORTS AND TRACKING (Run in Supabase SQL Editor)

-- 1. Fix "Invalid UUID" error by changing item_id to TEXT in related tables
-- This allows custom IDs like "PC-001" to be stored in movements and requests

-- Drop foreign key constraints first (if they exist) to allow type change
ALTER TABLE public.stock_movements DROP CONSTRAINT IF EXISTS stock_movements_item_id_fkey;
ALTER TABLE public.requests DROP CONSTRAINT IF EXISTS requests_item_id_fkey;

-- Change columns to TEXT
ALTER TABLE public.stock_movements ALTER COLUMN item_id TYPE text;
ALTER TABLE public.requests ALTER COLUMN item_id TYPE text;

-- Re-add Foreign Keys (referencing inventory_items.id which should also be text/uuid compatible)
-- We use ON DELETE SET NULL to keep history even if item is deleted
ALTER TABLE public.stock_movements 
    ADD CONSTRAINT stock_movements_item_id_fkey 
    FOREIGN KEY (item_id) REFERENCES public.inventory_items(id) ON DELETE SET NULL;

ALTER TABLE public.requests 
    ADD CONSTRAINT requests_item_id_fkey 
    FOREIGN KEY (item_id) REFERENCES public.inventory_items(id) ON DELETE SET NULL;



-- 2. Create Missing RPCs for Reports

-- RPC: Get Low Stock Items
DROP FUNCTION IF EXISTS get_low_stock_items();

CREATE OR REPLACE FUNCTION get_low_stock_items()
RETURNS SETOF public.inventory_items 
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT * FROM public.inventory_items 
  WHERE quantity <= min_stock_level
  ORDER BY quantity ASC;
$$;

-- RPC: Update Inventory Quantity (Safe decrement/increment)
-- Drop potential old versions with UUID or Text
DROP FUNCTION IF EXISTS update_inventory_quantity(uuid, int);
DROP FUNCTION IF EXISTS update_inventory_quantity(text, int);

CREATE OR REPLACE FUNCTION update_inventory_quantity(item_id text, quantity_change int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.inventory_items
  SET quantity = quantity + quantity_change
  WHERE id = item_id;
END;
$$;

-- RPC: Fulfill Request
-- Updates request status to 'fulfilled' and decrements inventory
DROP FUNCTION IF EXISTS fulfill_request(uuid);

CREATE OR REPLACE FUNCTION fulfill_request(request_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  req_record record;
  current_qty int;
BEGIN
  -- Get request details
  SELECT * INTO req_record FROM public.requests WHERE id = request_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  IF req_record.status = 'fulfilled' THEN
    RAISE EXCEPTION 'Request already fulfilled';
  END IF;

  -- Check inventory
  SELECT quantity INTO current_qty FROM public.inventory_items WHERE id = req_record.item_id;
  
  IF current_qty < req_record.quantity THEN
    RAISE EXCEPTION 'Insufficient stock to fulfill request';
  END IF;

  -- Update Inventory
  UPDATE public.inventory_items
  SET quantity = quantity - req_record.quantity
  WHERE id = req_record.item_id;

  -- Update Request Status
  UPDATE public.requests
  SET status = 'fulfilled', updated_at = now()
  WHERE id = request_id;

  -- Record Movement (Auto-log the fulfillment)
  INSERT INTO public.stock_movements (item_id, user_id, movement_type, quantity, reason, to_location)
  VALUES (req_record.item_id, req_record.user_id, 'out', req_record.quantity, 'Request Fulfilled', 'User');

  RETURN json_build_object('success', true);
END;
$$;
