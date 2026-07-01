-- ============================================================
-- AGENDA: módulo de eventos/agenda do negócio
-- ============================================================

CREATE TABLE IF NOT EXISTS public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'lembrete' CHECK (type IN ('venda_marcada','entrega','lembrete','compra_stock','encomenda')),
  event_date DATE NOT NULL,
  event_time TIME,
  duration_minutes INTEGER,
  location TEXT,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','confirmado','concluido','cancelado')),
  responsible_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_events TO authenticated;
GRANT ALL ON public.calendar_events TO service_role;

CREATE POLICY "events_select" ON public.calendar_events FOR SELECT TO authenticated
  USING (public.has_workspace_access(auth.uid(), workspace_id, 'negocio'));
CREATE POLICY "events_insert" ON public.calendar_events FOR INSERT TO authenticated
  WITH CHECK (public.can_write(auth.uid(), workspace_id, 'negocio') AND created_by = auth.uid());
CREATE POLICY "events_update" ON public.calendar_events FOR UPDATE TO authenticated
  USING (public.can_write(auth.uid(), workspace_id, 'negocio'));
CREATE POLICY "events_delete" ON public.calendar_events FOR DELETE TO authenticated
  USING (public.can_manage(auth.uid(), workspace_id, 'negocio'));

CREATE TRIGGER calendar_events_updated_at
  BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
