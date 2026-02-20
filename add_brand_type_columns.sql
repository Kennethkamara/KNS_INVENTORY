-- Add Brand, Type, and Last Repair Date columns
ALTER TABLE public.inventory_items 
ADD COLUMN IF NOT EXISTS brand TEXT,
ADD COLUMN IF NOT EXISTS type TEXT,
ADD COLUMN IF NOT EXISTS last_repair_date TIMESTAMPTZ;

-- Add comment
COMMENT ON COLUMN public.inventory_items.brand IS 'Brand of the item (e.g. HP, Dell)';
COMMENT ON COLUMN public.inventory_items.type IS 'Type of the item (e.g. Laptop, Desktop)';
COMMENT ON COLUMN public.inventory_items.last_repair_date IS 'Date when the item was last repaired';
