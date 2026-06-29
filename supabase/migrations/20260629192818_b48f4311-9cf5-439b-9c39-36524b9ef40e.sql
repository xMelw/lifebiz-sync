
-- 1. Fix mutable search_path
ALTER FUNCTION public.order_reserves_stock(public.order_status) SET search_path = public;

-- 2. Lock down SECURITY DEFINER functions: revoke from public/anon; keep authenticated only where RLS/RPC needs it
REVOKE ALL ON FUNCTION public.is_workspace_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_workspace_admin(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.workspace_role(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_workspace_access(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_write(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_manage(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.order_reserves_stock(public.order_status) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.convert_order_to_sale(uuid) FROM PUBLIC, anon;

-- Trigger-only functions: not meant to be invoked by API users
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_order_items_reserve() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_orders_status_reserve() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_orders_recalc_total() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recalc_order_total(uuid) FROM PUBLIC, anon, authenticated;

-- 3. Recreate DELETE policies scoped to authenticated only
DROP POLICY IF EXISTS "Managers delete business expenses" ON public.business_expenses;
CREATE POLICY "Managers delete business expenses" ON public.business_expenses FOR DELETE TO authenticated
  USING (public.can_manage(auth.uid(), workspace_id, 'negocio'));

DROP POLICY IF EXISTS "Managers delete customers" ON public.customers;
CREATE POLICY "Managers delete customers" ON public.customers FOR DELETE TO authenticated
  USING (public.can_manage(auth.uid(), workspace_id, 'negocio'));

DROP POLICY IF EXISTS "Managers delete home expenses" ON public.home_expenses;
CREATE POLICY "Managers delete home expenses" ON public.home_expenses FOR DELETE TO authenticated
  USING (public.can_manage(auth.uid(), workspace_id, 'casa'));

DROP POLICY IF EXISTS "Managers delete stock" ON public.home_stock_items;
CREATE POLICY "Managers delete stock" ON public.home_stock_items FOR DELETE TO authenticated
  USING (public.can_manage(auth.uid(), workspace_id, 'casa'));

DROP POLICY IF EXISTS "order_items_delete" ON public.order_items;
CREATE POLICY "order_items_delete" ON public.order_items FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND public.can_manage(auth.uid(), o.workspace_id, 'negocio')));

DROP POLICY IF EXISTS "orders_delete" ON public.orders;
CREATE POLICY "orders_delete" ON public.orders FOR DELETE TO authenticated
  USING (public.can_manage(auth.uid(), workspace_id, 'negocio'));

DROP POLICY IF EXISTS "Managers delete products" ON public.products;
CREATE POLICY "Managers delete products" ON public.products FOR DELETE TO authenticated
  USING (public.can_manage(auth.uid(), workspace_id, 'negocio'));

DROP POLICY IF EXISTS "Managers delete sales" ON public.sales;
CREATE POLICY "Managers delete sales" ON public.sales FOR DELETE TO authenticated
  USING (public.can_manage(auth.uid(), workspace_id, 'negocio'));

DROP POLICY IF EXISTS "Managers delete sale items" ON public.sale_items;
CREATE POLICY "Managers delete sale items" ON public.sale_items FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_items.sale_id AND public.can_manage(auth.uid(), s.workspace_id, 'negocio')));

-- 4. Restrict profiles SELECT to self + shared-workspace members
DROP POLICY IF EXISTS "Profiles readable by authenticated" ON public.profiles;
CREATE POLICY "Profiles readable by self or workspace peers" ON public.profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.workspace_members wm1
      JOIN public.workspace_members wm2 ON wm1.workspace_id = wm2.workspace_id
      WHERE wm1.user_id = auth.uid() AND wm1.status = 'active'
        AND wm2.user_id = profiles.id AND wm2.status = 'active'
    )
  );
