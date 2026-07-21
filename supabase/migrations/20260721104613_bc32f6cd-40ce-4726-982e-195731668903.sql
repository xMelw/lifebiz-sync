
-- Fix mutable search_path on remaining functions
ALTER FUNCTION private.order_reserves_stock(order_status) SET search_path = public;
ALTER FUNCTION private.tg_set_updated_at() SET search_path = public;

-- Lock down EXECUTE on public SECURITY DEFINER functions.
-- Revoke default PUBLIC execute, then grant only to the roles that need it.
REVOKE EXECUTE ON FUNCTION public.apply_weekly_consumption(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_weekly_consumption(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.convert_order_to_sale(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.convert_order_to_sale(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.generate_order_public_link(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_order_public_link(uuid) TO authenticated;

-- verify_order_pin and submit_client_action are the intentional public (anon) client-action interface;
-- they validate the token+PIN internally. Keep anon EXECUTE but revoke PUBLIC default and re-grant explicitly.
REVOKE EXECUTE ON FUNCTION public.verify_order_pin(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_order_pin(text, text) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.submit_client_action(text, text, text, text, timestamptz, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_client_action(text, text, text, text, timestamptz, text, text) TO anon, authenticated;

-- Explicit deny of direct writes on order_client_actions.
-- All inserts must go through public.submit_client_action (SECURITY DEFINER).
CREATE POLICY "no_direct_insert_client_actions" ON public.order_client_actions
  FOR INSERT TO authenticated, anon WITH CHECK (false);
CREATE POLICY "no_direct_update_client_actions" ON public.order_client_actions
  FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false);
CREATE POLICY "no_direct_delete_client_actions" ON public.order_client_actions
  FOR DELETE TO authenticated, anon USING (false);
