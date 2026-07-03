-- 1. Enum values
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'rascunho';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'pendente_aprovacao';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'alteracoes_pedidas';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'aprovada_envio';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'enviada_cliente';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'vista_pelo_cliente';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'em_negociacao';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'convertida_venda';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'arquivada';
