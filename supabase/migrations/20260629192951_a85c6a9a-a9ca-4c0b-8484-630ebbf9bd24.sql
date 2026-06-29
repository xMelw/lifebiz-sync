
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

-- Move SECURITY DEFINER helpers and triggers out of public
ALTER FUNCTION public.is_workspace_member(uuid, uuid) SET SCHEMA private;
ALTER FUNCTION public.is_workspace_admin(uuid, uuid) SET SCHEMA private;
ALTER FUNCTION public.workspace_role(uuid, uuid) SET SCHEMA private;
ALTER FUNCTION public.has_workspace_access(uuid, uuid, text) SET SCHEMA private;
ALTER FUNCTION public.can_write(uuid, uuid, text) SET SCHEMA private;
ALTER FUNCTION public.can_manage(uuid, uuid, text) SET SCHEMA private;
ALTER FUNCTION public.handle_new_user() SET SCHEMA private;
ALTER FUNCTION public.tg_set_updated_at() SET SCHEMA private;
ALTER FUNCTION public.tg_order_items_reserve() SET SCHEMA private;
ALTER FUNCTION public.tg_orders_status_reserve() SET SCHEMA private;
ALTER FUNCTION public.tg_orders_recalc_total() SET SCHEMA private;
ALTER FUNCTION public.recalc_order_total(uuid) SET SCHEMA private;
ALTER FUNCTION public.order_reserves_stock(public.order_status) SET SCHEMA private;

-- Update search_path on moved functions so they still resolve public types/tables
ALTER FUNCTION private.is_workspace_member(uuid, uuid) SET search_path = public;
ALTER FUNCTION private.is_workspace_admin(uuid, uuid) SET search_path = public;
ALTER FUNCTION private.workspace_role(uuid, uuid) SET search_path = public;
ALTER FUNCTION private.has_workspace_access(uuid, uuid, text) SET search_path = public;
ALTER FUNCTION private.can_write(uuid, uuid, text) SET search_path = public;
ALTER FUNCTION private.can_manage(uuid, uuid, text) SET search_path = public;
ALTER FUNCTION private.handle_new_user() SET search_path = public;
ALTER FUNCTION private.tg_set_updated_at() SET search_path = public;
ALTER FUNCTION private.tg_order_items_reserve() SET search_path = public;
ALTER FUNCTION private.tg_orders_status_reserve() SET search_path = public;
ALTER FUNCTION private.tg_orders_recalc_total() SET search_path = public;
ALTER FUNCTION private.recalc_order_total(uuid) SET search_path = public;
ALTER FUNCTION private.order_reserves_stock(public.order_status) SET search_path = public;

-- Make convert_order_to_sale SECURITY INVOKER (caller's RLS applies) and reference helpers via private schema
CREATE OR REPLACE FUNCTION public.convert_order_to_sale(_order_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path = public
AS $function$
DECLARE
  o RECORD;
  new_sale_id uuid;
  it RECORD;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF NOT private.can_write(auth.uid(), o.workspace_id, 'negocio') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF o.sale_id IS NOT NULL THEN RETURN o.sale_id; END IF;
  IF o.status = 'cancelada' THEN RAISE EXCEPTION 'Cannot convert cancelled order'; END IF;

  INSERT INTO public.sales (workspace_id, customer_id, created_by, date, discount, total, origin, status, notes)
  VALUES (o.workspace_id, o.customer_id, auth.uid(), CURRENT_DATE, o.discount, o.total, 'encomenda', 'confirmada', o.notes)
  RETURNING id INTO new_sale_id;

  FOR it IN SELECT product_id, custom_name, quantity, unit_price FROM public.order_items WHERE order_id = _order_id LOOP
    INSERT INTO public.sale_items (sale_id, product_id, custom_name, quantity, unit_price)
    VALUES (new_sale_id, it.product_id, it.custom_name, it.quantity, it.unit_price);
    IF it.product_id IS NOT NULL THEN
      UPDATE public.products
        SET stock_reserved = GREATEST(stock_reserved - it.quantity, 0),
            stock_total = GREATEST(stock_total - it.quantity, 0)
        WHERE id = it.product_id;
    END IF;
  END LOOP;

  UPDATE public.orders SET status = 'entregue', sale_id = new_sale_id WHERE id = _order_id;
  RETURN new_sale_id;
END;
$function$;

-- Update all RLS policies that referenced public.<helper> to private.<helper>
-- workspaces
DROP POLICY IF EXISTS "Workspace members can read" ON public.workspaces;
DROP POLICY IF EXISTS "Admin updates workspace" ON public.workspaces;
DROP POLICY IF EXISTS "Admin deletes workspace" ON public.workspaces;
DROP POLICY IF EXISTS "Owner inserts workspace" ON public.workspaces;

-- workspace_members
DROP POLICY IF EXISTS "Members read membership" ON public.workspace_members;
DROP POLICY IF EXISTS "Admin manages members insert" ON public.workspace_members;
DROP POLICY IF EXISTS "Admin manages members update" ON public.workspace_members;
DROP POLICY IF EXISTS "Admin removes members" ON public.workspace_members;

-- home_stock_items
DROP POLICY IF EXISTS "Members read stock" ON public.home_stock_items;
DROP POLICY IF EXISTS "Writers insert stock" ON public.home_stock_items;
DROP POLICY IF EXISTS "Writers update stock" ON public.home_stock_items;
DROP POLICY IF EXISTS "Managers delete stock" ON public.home_stock_items;

-- home_expenses
DROP POLICY IF EXISTS "Members read home expenses" ON public.home_expenses;
DROP POLICY IF EXISTS "Writers insert home expenses" ON public.home_expenses;
DROP POLICY IF EXISTS "Writers update home expenses" ON public.home_expenses;
DROP POLICY IF EXISTS "Managers delete home expenses" ON public.home_expenses;

-- products
DROP POLICY IF EXISTS "Members read products" ON public.products;
DROP POLICY IF EXISTS "Writers insert products" ON public.products;
DROP POLICY IF EXISTS "Writers update products" ON public.products;
DROP POLICY IF EXISTS "Managers delete products" ON public.products;

-- customers
DROP POLICY IF EXISTS "Members read customers" ON public.customers;
DROP POLICY IF EXISTS "Writers insert customers" ON public.customers;
DROP POLICY IF EXISTS "Writers update customers" ON public.customers;
DROP POLICY IF EXISTS "Managers delete customers" ON public.customers;

-- business_expenses
DROP POLICY IF EXISTS "Members read business expenses" ON public.business_expenses;
DROP POLICY IF EXISTS "Writers insert business expenses" ON public.business_expenses;
DROP POLICY IF EXISTS "Writers update business expenses" ON public.business_expenses;
DROP POLICY IF EXISTS "Managers delete business expenses" ON public.business_expenses;

-- sales
DROP POLICY IF EXISTS "Members read sales" ON public.sales;
DROP POLICY IF EXISTS "Writers insert sales" ON public.sales;
DROP POLICY IF EXISTS "Writers update sales" ON public.sales;
DROP POLICY IF EXISTS "Managers delete sales" ON public.sales;

-- sale_items
DROP POLICY IF EXISTS "Read sale items via sale" ON public.sale_items;
DROP POLICY IF EXISTS "Insert sale items via sale" ON public.sale_items;
DROP POLICY IF EXISTS "Update sale items via sale" ON public.sale_items;
DROP POLICY IF EXISTS "Delete sale items via sale" ON public.sale_items;
DROP POLICY IF EXISTS "Managers delete sale items" ON public.sale_items;

-- orders
DROP POLICY IF EXISTS "orders_select" ON public.orders;
DROP POLICY IF EXISTS "orders_insert" ON public.orders;
DROP POLICY IF EXISTS "orders_update" ON public.orders;
DROP POLICY IF EXISTS "orders_delete" ON public.orders;

-- order_items
DROP POLICY IF EXISTS "order_items_select" ON public.order_items;
DROP POLICY IF EXISTS "order_items_insert" ON public.order_items;
DROP POLICY IF EXISTS "order_items_update" ON public.order_items;
DROP POLICY IF EXISTS "order_items_delete" ON public.order_items;

-- Recreate using private.* helpers, scoped to authenticated
-- workspaces
CREATE POLICY "Workspace members can read" ON public.workspaces FOR SELECT TO authenticated USING (private.is_workspace_member(auth.uid(), id));
CREATE POLICY "Owner inserts workspace" ON public.workspaces FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Admin updates workspace" ON public.workspaces FOR UPDATE TO authenticated USING (private.is_workspace_admin(auth.uid(), id)) WITH CHECK (private.is_workspace_admin(auth.uid(), id));
CREATE POLICY "Admin deletes workspace" ON public.workspaces FOR DELETE TO authenticated USING (private.is_workspace_admin(auth.uid(), id));

-- workspace_members
CREATE POLICY "Members read membership" ON public.workspace_members FOR SELECT TO authenticated USING (private.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Admin manages members insert" ON public.workspace_members FOR INSERT TO authenticated WITH CHECK (private.is_workspace_admin(auth.uid(), workspace_id));
CREATE POLICY "Admin manages members update" ON public.workspace_members FOR UPDATE TO authenticated USING (private.is_workspace_admin(auth.uid(), workspace_id)) WITH CHECK (private.is_workspace_admin(auth.uid(), workspace_id));
CREATE POLICY "Admin removes members" ON public.workspace_members FOR DELETE TO authenticated USING (private.is_workspace_admin(auth.uid(), workspace_id));

-- home_stock_items
CREATE POLICY "Members read stock" ON public.home_stock_items FOR SELECT TO authenticated USING (private.has_workspace_access(auth.uid(), workspace_id, 'casa'));
CREATE POLICY "Writers insert stock" ON public.home_stock_items FOR INSERT TO authenticated WITH CHECK (private.can_write(auth.uid(), workspace_id, 'casa'));
CREATE POLICY "Writers update stock" ON public.home_stock_items FOR UPDATE TO authenticated USING (private.can_write(auth.uid(), workspace_id, 'casa')) WITH CHECK (private.can_write(auth.uid(), workspace_id, 'casa'));
CREATE POLICY "Managers delete stock" ON public.home_stock_items FOR DELETE TO authenticated USING (private.can_manage(auth.uid(), workspace_id, 'casa'));

-- home_expenses
CREATE POLICY "Members read home expenses" ON public.home_expenses FOR SELECT TO authenticated USING (private.has_workspace_access(auth.uid(), workspace_id, 'casa'));
CREATE POLICY "Writers insert home expenses" ON public.home_expenses FOR INSERT TO authenticated WITH CHECK (private.can_write(auth.uid(), workspace_id, 'casa'));
CREATE POLICY "Writers update home expenses" ON public.home_expenses FOR UPDATE TO authenticated USING (private.can_write(auth.uid(), workspace_id, 'casa')) WITH CHECK (private.can_write(auth.uid(), workspace_id, 'casa'));
CREATE POLICY "Managers delete home expenses" ON public.home_expenses FOR DELETE TO authenticated USING (private.can_manage(auth.uid(), workspace_id, 'casa'));

-- products
CREATE POLICY "Members read products" ON public.products FOR SELECT TO authenticated USING (private.has_workspace_access(auth.uid(), workspace_id, 'negocio'));
CREATE POLICY "Writers insert products" ON public.products FOR INSERT TO authenticated WITH CHECK (private.can_write(auth.uid(), workspace_id, 'negocio'));
CREATE POLICY "Writers update products" ON public.products FOR UPDATE TO authenticated USING (private.can_write(auth.uid(), workspace_id, 'negocio')) WITH CHECK (private.can_write(auth.uid(), workspace_id, 'negocio'));
CREATE POLICY "Managers delete products" ON public.products FOR DELETE TO authenticated USING (private.can_manage(auth.uid(), workspace_id, 'negocio'));

-- customers
CREATE POLICY "Members read customers" ON public.customers FOR SELECT TO authenticated USING (private.has_workspace_access(auth.uid(), workspace_id, 'negocio'));
CREATE POLICY "Writers insert customers" ON public.customers FOR INSERT TO authenticated WITH CHECK (private.can_write(auth.uid(), workspace_id, 'negocio'));
CREATE POLICY "Writers update customers" ON public.customers FOR UPDATE TO authenticated USING (private.can_write(auth.uid(), workspace_id, 'negocio')) WITH CHECK (private.can_write(auth.uid(), workspace_id, 'negocio'));
CREATE POLICY "Managers delete customers" ON public.customers FOR DELETE TO authenticated USING (private.can_manage(auth.uid(), workspace_id, 'negocio'));

-- business_expenses
CREATE POLICY "Members read business expenses" ON public.business_expenses FOR SELECT TO authenticated USING (private.has_workspace_access(auth.uid(), workspace_id, 'negocio'));
CREATE POLICY "Writers insert business expenses" ON public.business_expenses FOR INSERT TO authenticated WITH CHECK (private.can_write(auth.uid(), workspace_id, 'negocio'));
CREATE POLICY "Writers update business expenses" ON public.business_expenses FOR UPDATE TO authenticated USING (private.can_write(auth.uid(), workspace_id, 'negocio')) WITH CHECK (private.can_write(auth.uid(), workspace_id, 'negocio'));
CREATE POLICY "Managers delete business expenses" ON public.business_expenses FOR DELETE TO authenticated USING (private.can_manage(auth.uid(), workspace_id, 'negocio'));

-- sales
CREATE POLICY "Members read sales" ON public.sales FOR SELECT TO authenticated USING (private.has_workspace_access(auth.uid(), workspace_id, 'negocio'));
CREATE POLICY "Writers insert sales" ON public.sales FOR INSERT TO authenticated WITH CHECK (private.can_write(auth.uid(), workspace_id, 'negocio'));
CREATE POLICY "Writers update sales" ON public.sales FOR UPDATE TO authenticated USING (private.can_write(auth.uid(), workspace_id, 'negocio')) WITH CHECK (private.can_write(auth.uid(), workspace_id, 'negocio'));
CREATE POLICY "Managers delete sales" ON public.sales FOR DELETE TO authenticated USING (private.can_manage(auth.uid(), workspace_id, 'negocio'));

-- sale_items
CREATE POLICY "Read sale items via sale" ON public.sale_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_items.sale_id AND private.has_workspace_access(auth.uid(), s.workspace_id, 'negocio')));
CREATE POLICY "Insert sale items via sale" ON public.sale_items FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_items.sale_id AND private.can_write(auth.uid(), s.workspace_id, 'negocio')));
CREATE POLICY "Update sale items via sale" ON public.sale_items FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_items.sale_id AND private.can_write(auth.uid(), s.workspace_id, 'negocio'))) WITH CHECK (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_items.sale_id AND private.can_write(auth.uid(), s.workspace_id, 'negocio')));
CREATE POLICY "Managers delete sale items" ON public.sale_items FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_items.sale_id AND private.can_manage(auth.uid(), s.workspace_id, 'negocio')));

-- orders
CREATE POLICY "orders_select" ON public.orders FOR SELECT TO authenticated USING (private.has_workspace_access(auth.uid(), workspace_id, 'negocio'));
CREATE POLICY "orders_insert" ON public.orders FOR INSERT TO authenticated WITH CHECK (private.can_write(auth.uid(), workspace_id, 'negocio'));
CREATE POLICY "orders_update" ON public.orders FOR UPDATE TO authenticated USING (private.can_write(auth.uid(), workspace_id, 'negocio')) WITH CHECK (private.can_write(auth.uid(), workspace_id, 'negocio'));
CREATE POLICY "orders_delete" ON public.orders FOR DELETE TO authenticated USING (private.can_manage(auth.uid(), workspace_id, 'negocio'));

-- order_items
CREATE POLICY "order_items_select" ON public.order_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND private.has_workspace_access(auth.uid(), o.workspace_id, 'negocio')));
CREATE POLICY "order_items_insert" ON public.order_items FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND private.can_write(auth.uid(), o.workspace_id, 'negocio')));
CREATE POLICY "order_items_update" ON public.order_items FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND private.can_write(auth.uid(), o.workspace_id, 'negocio'))) WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND private.can_write(auth.uid(), o.workspace_id, 'negocio')));
CREATE POLICY "order_items_delete" ON public.order_items FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND private.can_manage(auth.uid(), o.workspace_id, 'negocio')));

-- Profiles policy: self + workspace peers via private helper-free join
DROP POLICY IF EXISTS "Profiles readable by self or workspace peers" ON public.profiles;
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
