-- ============================================================
-- ENCOMENDAS UPGRADE: novos estados, campos, link público/PIN
-- ============================================================

-- 1. Adicionar novos valores ao enum order_status
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'rascunho';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'pendente_aprovacao';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'alteracoes_pedidas';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'aprovada_envio';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'enviada_cliente';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'vista_pelo_cliente';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'em_negociacao';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'convertida_venda';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'arquivada';

-- 2. Migrar registos existentes para novos estados
UPDATE public.orders SET status = 'rascunho' WHERE status = 'pendente';
UPDATE public.orders SET status = 'aprovada_envio' WHERE status = 'pronta';
UPDATE public.orders SET status = 'convertida_venda' WHERE status = 'entregue';
-- confirmada e cancelada permanecem iguais

-- 3. Adicionar colunas à tabela orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_number TEXT,
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'urgente')),
  ADD COLUMN IF NOT EXISTS responsible_id UUID,
  ADD COLUMN IF NOT EXISTS event_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS duration_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS internal_notes TEXT,
  ADD COLUMN IF NOT EXISTS client_notes TEXT,
  ADD COLUMN IF NOT EXISTS signal_amount NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS public_token TEXT,
  ADD COLUMN IF NOT EXISTS public_pin TEXT,
  ADD COLUMN IF NOT EXISTS public_token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS public_pin_attempts INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS public_pin_locked_until TIMESTAMPTZ;

-- Índice único no token público
CREATE UNIQUE INDEX IF NOT EXISTS orders_public_token_idx ON public.orders(public_token) WHERE public_token IS NOT NULL;

-- 4. Função para gerar número de encomenda
CREATE OR REPLACE FUNCTION public.generate_order_number(_workspace_id uuid)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  prefix TEXT;
  seq INTEGER;
BEGIN
  prefix := 'ORD-' || to_char(now(), 'YYYYMM') || '-';
  SELECT COUNT(*) + 1 INTO seq
  FROM public.orders
  WHERE workspace_id = _workspace_id
    AND order_number LIKE prefix || '%';
  RETURN prefix || LPAD(seq::TEXT, 3, '0');
END;
$$;

-- 5. Trigger para gerar número de encomenda automaticamente
CREATE OR REPLACE FUNCTION public.tg_set_order_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    NEW.order_number := public.generate_order_number(NEW.workspace_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_set_number ON public.orders;
CREATE TRIGGER orders_set_number
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_order_number();

-- Preencher números em encomendas existentes
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id, workspace_id FROM public.orders WHERE order_number IS NULL ORDER BY created_at LOOP
    UPDATE public.orders SET order_number = public.generate_order_number(r.workspace_id) WHERE id = r.id;
  END LOOP;
END;
$$;

-- 6. Tabela de ações do cliente (sem autenticação)
CREATE TABLE IF NOT EXISTS public.order_client_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  comment TEXT,
  proposed_date TIMESTAMPTZ,
  proposed_location TEXT,
  client_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.order_client_actions ENABLE ROW LEVEL SECURITY;

-- Membros do workspace podem ver
CREATE POLICY "members_select_client_actions" ON public.order_client_actions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_id
    AND public.has_workspace_access(auth.uid(), o.workspace_id, 'negocio')
  ));

-- Acesso anónimo pode inserir (via RPC)
GRANT SELECT, INSERT ON public.order_client_actions TO anon, authenticated;
GRANT ALL ON public.order_client_actions TO service_role;

-- 7. Função RPC: gerar link público e PIN
CREATE OR REPLACE FUNCTION public.generate_order_public_link(_order_id uuid)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  o RECORD;
  new_token TEXT;
  new_pin TEXT;
  result JSON;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Encomenda não encontrada'; END IF;
  IF NOT public.can_manage(auth.uid(), o.workspace_id, 'negocio') THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  new_token := gen_random_uuid()::TEXT;
  new_pin := LPAD((floor(random() * 9000 + 1000)::INTEGER)::TEXT, 4, '0');

  UPDATE public.orders SET
    public_token = new_token,
    public_pin = md5(new_pin),
    public_token_expires_at = now() + interval '7 days',
    public_pin_attempts = 0,
    public_pin_locked_until = NULL
  WHERE id = _order_id;

  result := json_build_object(
    'token', new_token,
    'pin', new_pin,
    'expires_at', (now() + interval '7 days')::TEXT
  );
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_order_public_link(uuid) TO authenticated;

-- 8. Função RPC: verificar PIN (anon + authenticated)
CREATE OR REPLACE FUNCTION public.verify_order_pin(_token text, _pin text)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  o RECORD;
  w RECORD;
  is_locked BOOLEAN;
BEGIN
  SELECT o.*, w.name as workspace_name INTO o
  FROM public.orders o
  JOIN public.workspaces w ON w.id = o.workspace_id
  WHERE o.public_token = _token;

  IF NOT FOUND THEN RETURN NULL; END IF;

  IF o.public_token_expires_at < now() THEN
    RETURN json_build_object('error', 'expired');
  END IF;

  is_locked := o.public_pin_locked_until IS NOT NULL AND o.public_pin_locked_until > now();
  IF is_locked THEN
    RETURN json_build_object('error', 'locked', 'locked_until', o.public_pin_locked_until::TEXT);
  END IF;

  IF o.public_pin != md5(_pin) THEN
    UPDATE public.orders SET
      public_pin_attempts = public_pin_attempts + 1,
      public_pin_locked_until = CASE WHEN public_pin_attempts + 1 >= 5 THEN now() + interval '15 minutes' ELSE public_pin_locked_until END
    WHERE id = o.id;
    RETURN json_build_object('error', 'wrong_pin');
  END IF;

  -- PIN correto: reset tentativas
  UPDATE public.orders SET public_pin_attempts = 0, public_pin_locked_until = NULL WHERE id = o.id;

  RETURN json_build_object(
    'id', o.id,
    'order_number', o.order_number,
    'status', o.status,
    'total', o.total,
    'signal_amount', o.signal_amount,
    'event_date', o.event_date,
    'location', o.location,
    'client_notes', o.client_notes,
    'delivery_date', o.delivery_date,
    'workspace_name', o.workspace_name,
    'expires_at', o.public_token_expires_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_order_pin(text, text) TO anon, authenticated;

-- 9. Função RPC: submeter ação do cliente
CREATE OR REPLACE FUNCTION public.submit_client_action(
  _token text, _pin text, _action text,
  _comment text DEFAULT NULL,
  _proposed_date timestamptz DEFAULT NULL,
  _proposed_location text DEFAULT NULL,
  _client_name text DEFAULT NULL
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  verify_result JSON;
  order_id UUID;
BEGIN
  verify_result := public.verify_order_pin(_token, _pin);
  IF verify_result IS NULL OR (verify_result->>'error') IS NOT NULL THEN
    RETURN verify_result;
  END IF;

  order_id := (verify_result->>'id')::UUID;

  INSERT INTO public.order_client_actions (order_id, action, comment, proposed_date, proposed_location, client_name)
  VALUES (order_id, _action, _comment, _proposed_date, _proposed_location, _client_name);

  -- Atualizar estado da encomenda conforme ação
  IF _action = 'confirmou' THEN
    UPDATE public.orders SET status = 'confirmada' WHERE id = order_id;
  ELSIF _action = 'cancelou' THEN
    UPDATE public.orders SET status = 'cancelada' WHERE id = order_id;
  ELSIF _action = 'pediu_alteracao' THEN
    UPDATE public.orders SET status = 'alteracoes_pedidas' WHERE id = order_id;
  END IF;

  RETURN json_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_client_action(text, text, text, text, timestamptz, text, text) TO anon, authenticated;

-- 10. Atualizar função order_reserves_stock
CREATE OR REPLACE FUNCTION public.order_reserves_stock(_status public.order_status)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT _status IN ('confirmada', 'aprovada_envio', 'enviada_cliente', 'vista_pelo_cliente', 'em_negociacao');
$$;

-- 11. Atualizar convert_order_to_sale para usar convertida_venda
CREATE OR REPLACE FUNCTION public.convert_order_to_sale(_order_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  o RECORD;
  new_sale_id uuid;
  it RECORD;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Encomenda não encontrada'; END IF;
  IF NOT public.can_write(auth.uid(), o.workspace_id, 'negocio') THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  IF o.sale_id IS NOT NULL THEN RETURN o.sale_id; END IF;
  IF o.status = 'cancelada' THEN RAISE EXCEPTION 'Não é possível converter encomenda cancelada'; END IF;

  INSERT INTO public.sales (workspace_id, customer_id, created_by, date, discount, total, origin, status, notes)
  VALUES (o.workspace_id, o.customer_id, auth.uid(), CURRENT_DATE, o.discount, o.total, 'encomenda', 'confirmada', o.client_notes)
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

  UPDATE public.orders SET status = 'convertida_venda', sale_id = new_sale_id WHERE id = _order_id;
  RETURN new_sale_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.convert_order_to_sale(uuid) TO authenticated;
