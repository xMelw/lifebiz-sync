
-- Fix search_path on the trigger helper
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Revoke public execute, grant only to authenticated
revoke execute on function public.is_workspace_member(uuid, uuid) from public, anon;
revoke execute on function public.workspace_role(uuid, uuid) from public, anon;
revoke execute on function public.has_workspace_access(uuid, uuid, text) from public, anon;
revoke execute on function public.can_write(uuid, uuid, text) from public, anon;
revoke execute on function public.can_manage(uuid, uuid, text) from public, anon;
revoke execute on function public.is_workspace_admin(uuid, uuid) from public, anon;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.tg_set_updated_at() from public, anon, authenticated;

grant execute on function public.is_workspace_member(uuid, uuid) to authenticated;
grant execute on function public.workspace_role(uuid, uuid) to authenticated;
grant execute on function public.has_workspace_access(uuid, uuid, text) to authenticated;
grant execute on function public.can_write(uuid, uuid, text) to authenticated;
grant execute on function public.can_manage(uuid, uuid, text) to authenticated;
grant execute on function public.is_workspace_admin(uuid, uuid) to authenticated;
