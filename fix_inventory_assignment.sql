-- FIX INVENTORY ASSIGNMENT (Run in Supabase SQL Editor)
-- This tracks who is assigned to each inventory item.

-- 1. Add assigned_to column to inventory_items
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory_items' AND column_name='assigned_to') THEN
        ALTER TABLE public.inventory_items ADD COLUMN assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 2. Update Fulfill Request RPC to include assignment
-- This overwrites the previous version to ensure assigned_to is set
DROP FUNCTION IF EXISTS public.fulfill_request(uuid);

CREATE OR REPLACE FUNCTION public.fulfill_request(request_id uuid)
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

  -- Update Inventory (Mark as assigned to the user)
  UPDATE public.inventory_items
  SET quantity = quantity - req_record.quantity,
      assigned_to = req_record.user_id,
      status = 'assigned',
      updated_at = now()
  WHERE id = req_record.item_id;

  -- Update Request Status
  UPDATE public.requests
  SET status = 'fulfilled', updated_at = now()
  WHERE id = request_id;

  -- Record Movement (Auto-log the fulfillment)
  INSERT INTO public.stock_movements (item_id, user_id, movement_type, quantity, reason, to_location)
  VALUES (req_record.item_id, req_record.user_id, 'out', req_record.quantity, 'Request Fulfilled & Assigned', 'User');

  RETURN json_build_object('success', true);
END;
$$;
