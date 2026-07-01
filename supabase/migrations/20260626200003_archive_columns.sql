-- Adicionar coluna status onde ainda não existe para suportar arquivamento

ALTER TABLE public.home_expenses ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE public.business_expenses ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Verificar se orders tem delivery_date (usado no verify_order_pin)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_date DATE;

-- Índice para token lookup
CREATE INDEX IF NOT EXISTS orders_status_idx ON public.orders(workspace_id, status);
CREATE INDEX IF NOT EXISTS orders_priority_idx ON public.orders(workspace_id, priority);
CREATE INDEX IF NOT EXISTS calendar_events_date_idx ON public.calendar_events(workspace_id, event_date);
CREATE INDEX IF NOT EXISTS approval_requests_status_idx ON public.approval_requests(workspace_id, status);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON public.notifications(user_id, read);
