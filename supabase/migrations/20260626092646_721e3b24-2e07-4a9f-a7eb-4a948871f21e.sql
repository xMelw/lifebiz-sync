
-- Order status enum
CREATE TYPE public.order_status AS ENUM ('pendente','confirmada','em_preparacao','pronta','entregue','cancelada');

-- Orders table
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  created_by UUID NOT NULL,
  status public.order_status NOT NULL DEFAULT 'pendente',
  channel TEXT,
  delivery_date DATE,
  notes TEXT,
  discount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  custom_name TEXT,
  quantity NUMERIC(12,3) NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Orders policies
CREATE POLICY "orders_select" ON public.orders FOR SELECT TO authenticated
  USING (public.has_workspace_access(auth.uid(), workspace_id, 'negocio'));
CREATE POLICY "orders_insert" ON public.orders FOR INSERT TO authenticated
  WITH CHECK (public.can_write(auth.uid(), workspace_id, 'negocio') AND created_by = auth.uid());
CREATE POLICY "orders_update" ON public.orders FOR UPDATE TO authenticated
  USING (public.can_write(auth.uid(), workspace_id, 'negocio'));
CREATE POLICY "orders_delete" ON public.orders FOR DELETE TO authenticated
  USING (public.can_manage(auth.uid(), workspace_id, 'negocio'));

-- Order items policies (via parent order)
CREATE POLICY "order_items_select" ON public.order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND public.has_workspace_access(auth.uid(), o.workspace_id, 'negocio')));
CREATE POLICY "order_items_insert" ON public.order_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND public.can_write(auth.uid(), o.workspace_id, 'negocio')));
CREATE POLICY "order_items_update" ON public.order_items FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND public.can_write(auth.uid(), o.workspace_id, 'negocio')));
CREATE POLICY "order_items_delete" ON public.order_items FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND public.can_write(auth.uid(), o.workspace_id, 'negocio')));

-- updated_at trigger on orders
CREATE TRIGGER orders_set_updated_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Helper: determine if an order status reserves stock
CREATE OR REPLACE FUNCTION public.order_reserves_stock(_status public.order_status)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT _status IN ('pendente','confirmada','em_preparacao','pronta');
$$;

-- Recalculate order total from items
CREATE OR REPLACE FUNCTION public.recalc_order_total(_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s NUMERIC(12,2);
  d NUMERIC(12,2);
BEGIN
  SELECT COALESCE(SUM(quantity * unit_price),0) INTO s FROM public.order_items WHERE order_id = _order_id;
  SELECT COALESCE(discount,0) INTO d FROM public.orders WHERE id = _order_id;
  UPDATE public.orders SET total = GREATEST(s - d, 0) WHERE id = _order_id;
END;
$$;

-- Trigger on order_items: adjust product reservation + recalc total
CREATE OR REPLACE FUNCTION public.tg_order_items_reserve()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  reserves boolean;
  ord_status public.order_status;
  ord_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    ord_id := NEW.order_id;
    SELECT status INTO ord_status FROM public.orders WHERE id = NEW.order_id;
    IF public.order_reserves_stock(ord_status) AND NEW.product_id IS NOT NULL THEN
      UPDATE public.products SET stock_reserved = stock_reserved + NEW.quantity WHERE id = NEW.product_id;
    END IF;
    PERFORM public.recalc_order_total(ord_id);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    ord_id := NEW.order_id;
    SELECT status INTO ord_status FROM public.orders WHERE id = NEW.order_id;
    IF public.order_reserves_stock(ord_status) THEN
      IF OLD.product_id IS NOT NULL THEN
        UPDATE public.products SET stock_reserved = GREATEST(stock_reserved - OLD.quantity, 0) WHERE id = OLD.product_id;
      END IF;
      IF NEW.product_id IS NOT NULL THEN
        UPDATE public.products SET stock_reserved = stock_reserved + NEW.quantity WHERE id = NEW.product_id;
      END IF;
    END IF;
    PERFORM public.recalc_order_total(ord_id);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    ord_id := OLD.order_id;
    SELECT status INTO ord_status FROM public.orders WHERE id = OLD.order_id;
    IF ord_status IS NOT NULL AND public.order_reserves_stock(ord_status) AND OLD.product_id IS NOT NULL THEN
      UPDATE public.products SET stock_reserved = GREATEST(stock_reserved - OLD.quantity, 0) WHERE id = OLD.product_id;
    END IF;
    PERFORM public.recalc_order_total(ord_id);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER order_items_reserve
AFTER INSERT OR UPDATE OR DELETE ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.tg_order_items_reserve();

-- Trigger on orders: adjust reservations when status changes
CREATE OR REPLACE FUNCTION public.tg_orders_status_reserve()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  was_reserving boolean;
  is_reserving boolean;
  it RECORD;
BEGIN
  was_reserving := public.order_reserves_stock(OLD.status);
  is_reserving := public.order_reserves_stock(NEW.status);
  IF was_reserving = is_reserving THEN RETURN NEW; END IF;
  FOR it IN SELECT product_id, quantity FROM public.order_items WHERE order_id = NEW.id AND product_id IS NOT NULL LOOP
    IF is_reserving AND NOT was_reserving THEN
      UPDATE public.products SET stock_reserved = stock_reserved + it.quantity WHERE id = it.product_id;
    ELSIF was_reserving AND NOT is_reserving THEN
      UPDATE public.products SET stock_reserved = GREATEST(stock_reserved - it.quantity, 0) WHERE id = it.product_id;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER orders_status_reserve
AFTER UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.tg_orders_status_reserve();

-- Recalc total when discount changes
CREATE OR REPLACE FUNCTION public.tg_orders_recalc_total()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.discount IS DISTINCT FROM OLD.discount THEN
    PERFORM public.recalc_order_total(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER orders_recalc_total
AFTER UPDATE OF discount ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.tg_orders_recalc_total();

-- Convert order to sale (releases reservation, deducts stock via sale_items if such trigger exists; otherwise we deduct here)
CREATE OR REPLACE FUNCTION public.convert_order_to_sale(_order_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  o RECORD;
  new_sale_id uuid;
  it RECORD;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF NOT public.can_write(auth.uid(), o.workspace_id, 'negocio') THEN
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
    -- Release reservation and deduct from stock_total
    IF it.product_id IS NOT NULL THEN
      UPDATE public.products
        SET stock_reserved = GREATEST(stock_reserved - it.quantity, 0),
            stock_total = GREATEST(stock_total - it.quantity, 0)
        WHERE id = it.product_id;
    END IF;
  END LOOP;

  -- Mark order as delivered + linked, without re-running reservation release (status change trigger will skip because items already deducted; reservation already zeroed above)
  UPDATE public.orders SET status = 'entregue', sale_id = new_sale_id WHERE id = _order_id;
  RETURN new_sale_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.convert_order_to_sale(uuid) TO authenticated;
