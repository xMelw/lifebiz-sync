
-- Allow gestor (manager) to DELETE in addition to admin, on all CRUD tables.

-- Casa
DROP POLICY IF EXISTS "Admin deletes stock" ON public.home_stock_items;
CREATE POLICY "Managers delete stock" ON public.home_stock_items
  FOR DELETE USING (public.can_manage(auth.uid(), workspace_id, 'casa'));

DROP POLICY IF EXISTS "Admin deletes home expenses" ON public.home_expenses;
CREATE POLICY "Managers delete home expenses" ON public.home_expenses
  FOR DELETE USING (public.can_manage(auth.uid(), workspace_id, 'casa'));

-- Negócio
DROP POLICY IF EXISTS "Admin deletes business expenses" ON public.business_expenses;
CREATE POLICY "Managers delete business expenses" ON public.business_expenses
  FOR DELETE USING (public.can_manage(auth.uid(), workspace_id, 'negocio'));

DROP POLICY IF EXISTS "Admin deletes customers" ON public.customers;
CREATE POLICY "Managers delete customers" ON public.customers
  FOR DELETE USING (public.can_manage(auth.uid(), workspace_id, 'negocio'));

-- Products (if admin-only delete exists)
DROP POLICY IF EXISTS "Admin deletes products" ON public.products;
CREATE POLICY "Managers delete products" ON public.products
  FOR DELETE USING (public.can_manage(auth.uid(), workspace_id, 'negocio'));

-- Sales
DROP POLICY IF EXISTS "Admin deletes sales" ON public.sales;
CREATE POLICY "Managers delete sales" ON public.sales
  FOR DELETE USING (public.can_manage(auth.uid(), workspace_id, 'negocio'));

DROP POLICY IF EXISTS "Admin deletes sale items" ON public.sale_items;
CREATE POLICY "Managers delete sale items" ON public.sale_items
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM public.sales s
    WHERE s.id = sale_items.sale_id
      AND public.can_manage(auth.uid(), s.workspace_id, 'negocio')
  ));

-- Orders: ensure managers can delete (orders/order_items already use can_write for delete; widen explicitly)
DROP POLICY IF EXISTS "orders_delete" ON public.orders;
CREATE POLICY "orders_delete" ON public.orders
  FOR DELETE USING (public.can_manage(auth.uid(), workspace_id, 'negocio'));

DROP POLICY IF EXISTS "order_items_delete" ON public.order_items;
CREATE POLICY "order_items_delete" ON public.order_items
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
      AND public.can_manage(auth.uid(), o.workspace_id, 'negocio')
  ));
