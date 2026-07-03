CREATE TABLE IF NOT EXISTS public.approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('criar_venda','editar_venda','criar_despesa','editar_despesa','criar_encomenda','editar_encomenda','editar_stock','arquivar_registo')),
  description TEXT NOT NULL,
  proposed_data JSONB,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal','urgente')),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','recusado','precisa_alteracoes','cancelado')),
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  reviewer_comment TEXT,
  reference_id UUID,
  reference_table TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.approval_requests TO authenticated;
GRANT ALL ON public.approval_requests TO service_role;

ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "approvals_select" ON public.approval_requests FOR SELECT TO authenticated
  USING (private.has_workspace_access(auth.uid(), workspace_id, 'negocio'));
CREATE POLICY "approvals_insert" ON public.approval_requests FOR INSERT TO authenticated
  WITH CHECK (private.can_write(auth.uid(), workspace_id, 'negocio') AND created_by = auth.uid());
CREATE POLICY "approvals_update" ON public.approval_requests FOR UPDATE TO authenticated
  USING (private.can_manage(auth.uid(), workspace_id, 'negocio') OR created_by = auth.uid());
CREATE POLICY "approvals_delete" ON public.approval_requests FOR DELETE TO authenticated
  USING (private.can_manage(auth.uid(), workspace_id, 'negocio'));

CREATE TRIGGER approval_requests_updated_at
  BEFORE UPDATE ON public.approval_requests
  FOR EACH ROW EXECUTE FUNCTION private.tg_set_updated_at();

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info','warning','error','success','urgente')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal','urgente')),
  read BOOLEAN NOT NULL DEFAULT false,
  action_url TEXT,
  origin_type TEXT,
  origin_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notif_select" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notif_update" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notif_insert" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (private.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "notif_delete" ON public.notifications FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION private.notify_managers(_workspace_id uuid, _title text, _body text, _type text, _priority text, _action_url text, _origin_type text, _origin_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (workspace_id, user_id, title, body, type, priority, action_url, origin_type, origin_id)
  SELECT _workspace_id, user_id, _title, _body, _type, _priority, _action_url, _origin_type, _origin_id
  FROM public.workspace_members
  WHERE workspace_id = _workspace_id AND role IN ('admin', 'gestor') AND status = 'active';
END;
$$;
