-- ADD DELETE POLICY FOR STOCK MOVEMENTS
-- This allows admins to use the "Reset History" button in the Reports section

DROP POLICY IF EXISTS "Only admins can delete stock movements" ON public.stock_movements;

CREATE POLICY "Only admins can delete stock movements"
    ON public.stock_movements FOR DELETE
    USING (public.is_admin());

-- Also add for requests if needed, though not required for this specific fix
DROP POLICY IF EXISTS "Only admins can delete requests" ON public.requests;
CREATE POLICY "Only admins can delete requests"
    ON public.requests FOR DELETE
    USING (public.is_admin());
