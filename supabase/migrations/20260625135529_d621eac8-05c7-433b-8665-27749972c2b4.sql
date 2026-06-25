
-- ============================================================
-- ENUMS
-- ============================================================
create type public.app_role as enum ('admin', 'gestor', 'colaborador', 'visualizador');
create type public.member_status as enum ('active', 'pending', 'inactive');
create type public.record_status as enum ('active', 'archived');
create type public.stock_unit as enum ('unidade', 'kg', 'g', 'L', 'ml', 'pacote', 'caixa');
create type public.home_location as enum ('despensa', 'frigorifico', 'congelador', 'casa_de_banho', 'outro');
create type public.preferred_channel as enum ('whatsapp', 'telefone', 'email', 'instagram', 'outro');
create type public.sale_origin as enum ('manual', 'encomenda');
create type public.sale_status as enum ('pendente', 'confirmada', 'cancelada');

-- ============================================================
-- UPDATED_AT helper
-- ============================================================
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- PROFILES (mirrors auth.users)
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;

alter table public.profiles enable row level security;

create policy "Profiles readable by authenticated"
  on public.profiles for select to authenticated using (true);

create policy "Users update own profile"
  on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.tg_set_updated_at();

-- ============================================================
-- WORKSPACES
-- ============================================================
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.workspaces to authenticated;
grant all on public.workspaces to service_role;

alter table public.workspaces enable row level security;

create trigger workspaces_updated_at
  before update on public.workspaces
  for each row execute function public.tg_set_updated_at();

-- ============================================================
-- WORKSPACE MEMBERS
-- ============================================================
create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null default 'colaborador',
  access_casa boolean not null default false,
  access_negocio boolean not null default false,
  status public.member_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

grant select, insert, update, delete on public.workspace_members to authenticated;
grant all on public.workspace_members to service_role;

alter table public.workspace_members enable row level security;

create trigger workspace_members_updated_at
  before update on public.workspace_members
  for each row execute function public.tg_set_updated_at();

create index on public.workspace_members (user_id);
create index on public.workspace_members (workspace_id);

-- ============================================================
-- SECURITY DEFINER helpers (avoid RLS recursion)
-- ============================================================
create or replace function public.is_workspace_member(_user uuid, _workspace uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members
    where user_id = _user and workspace_id = _workspace and status = 'active'
  );
$$;

create or replace function public.workspace_role(_user uuid, _workspace uuid)
returns public.app_role
language sql stable security definer set search_path = public
as $$
  select role from public.workspace_members
  where user_id = _user and workspace_id = _workspace and status = 'active'
  limit 1;
$$;

create or replace function public.has_workspace_access(_user uuid, _workspace uuid, _mode text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members
    where user_id = _user
      and workspace_id = _workspace
      and status = 'active'
      and case _mode
        when 'casa' then access_casa
        when 'negocio' then access_negocio
        else false
      end
  );
$$;

create or replace function public.can_write(_user uuid, _workspace uuid, _mode text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members
    where user_id = _user
      and workspace_id = _workspace
      and status = 'active'
      and role in ('admin','gestor','colaborador')
      and case _mode
        when 'casa' then access_casa
        when 'negocio' then access_negocio
        else false
      end
  );
$$;

create or replace function public.can_manage(_user uuid, _workspace uuid, _mode text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members
    where user_id = _user
      and workspace_id = _workspace
      and status = 'active'
      and role in ('admin','gestor')
      and case _mode
        when 'casa' then access_casa
        when 'negocio' then access_negocio
        else false
      end
  );
$$;

create or replace function public.is_workspace_admin(_user uuid, _workspace uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members
    where user_id = _user and workspace_id = _workspace
      and status = 'active' and role = 'admin'
  );
$$;

-- ============================================================
-- RLS for workspaces / members (uses helpers)
-- ============================================================
create policy "Members read workspace"
  on public.workspaces for select to authenticated
  using (public.is_workspace_member(auth.uid(), id));

create policy "Admin updates workspace"
  on public.workspaces for update to authenticated
  using (public.is_workspace_admin(auth.uid(), id))
  with check (public.is_workspace_admin(auth.uid(), id));

create policy "Authenticated creates workspace"
  on public.workspaces for insert to authenticated
  with check (created_by = auth.uid());

create policy "Admin deletes workspace"
  on public.workspaces for delete to authenticated
  using (public.is_workspace_admin(auth.uid(), id));

create policy "Members read own membership rows"
  on public.workspace_members for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_workspace_member(auth.uid(), workspace_id)
  );

create policy "Admin manages members"
  on public.workspace_members for insert to authenticated
  with check (public.is_workspace_admin(auth.uid(), workspace_id));

create policy "Admin updates members"
  on public.workspace_members for update to authenticated
  using (public.is_workspace_admin(auth.uid(), workspace_id))
  with check (public.is_workspace_admin(auth.uid(), workspace_id));

create policy "Admin removes members"
  on public.workspace_members for delete to authenticated
  using (public.is_workspace_admin(auth.uid(), workspace_id));

-- ============================================================
-- HOME: stock + expenses
-- ============================================================
create table public.home_stock_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  category text,
  quantity numeric not null default 0,
  unit public.stock_unit not null default 'unidade',
  min_stock numeric not null default 0,
  location public.home_location not null default 'despensa',
  expiry_date date,
  status public.record_status not null default 'active',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.home_stock_items to authenticated;
grant all on public.home_stock_items to service_role;
alter table public.home_stock_items enable row level security;
create trigger home_stock_items_updated_at before update on public.home_stock_items
  for each row execute function public.tg_set_updated_at();
create index on public.home_stock_items (workspace_id);

create policy "Casa members read stock"
  on public.home_stock_items for select to authenticated
  using (public.has_workspace_access(auth.uid(), workspace_id, 'casa'));
create policy "Casa writers create stock"
  on public.home_stock_items for insert to authenticated
  with check (public.can_write(auth.uid(), workspace_id, 'casa') and created_by = auth.uid());
create policy "Casa managers update stock"
  on public.home_stock_items for update to authenticated
  using (public.can_manage(auth.uid(), workspace_id, 'casa'))
  with check (public.can_manage(auth.uid(), workspace_id, 'casa'));
create policy "Admin deletes stock"
  on public.home_stock_items for delete to authenticated
  using (public.is_workspace_admin(auth.uid(), workspace_id));

create table public.home_expenses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  date date not null default current_date,
  amount numeric not null check (amount >= 0),
  category text not null,
  description text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.home_expenses to authenticated;
grant all on public.home_expenses to service_role;
alter table public.home_expenses enable row level security;
create trigger home_expenses_updated_at before update on public.home_expenses
  for each row execute function public.tg_set_updated_at();
create index on public.home_expenses (workspace_id, date desc);

create policy "Casa members read expenses"
  on public.home_expenses for select to authenticated
  using (public.has_workspace_access(auth.uid(), workspace_id, 'casa'));
create policy "Casa writers create expenses"
  on public.home_expenses for insert to authenticated
  with check (public.can_write(auth.uid(), workspace_id, 'casa') and created_by = auth.uid());
create policy "Casa managers update expenses"
  on public.home_expenses for update to authenticated
  using (public.can_manage(auth.uid(), workspace_id, 'casa'))
  with check (public.can_manage(auth.uid(), workspace_id, 'casa'));
create policy "Admin deletes home expenses"
  on public.home_expenses for delete to authenticated
  using (public.is_workspace_admin(auth.uid(), workspace_id));

-- ============================================================
-- BUSINESS: products, customers, expenses, sales
-- ============================================================
create table public.products (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  sku text,
  category text,
  description text,
  unit public.stock_unit not null default 'unidade',
  stock_total numeric not null default 0,
  stock_reserved numeric not null default 0,
  stock_available numeric generated always as (stock_total - stock_reserved) stored,
  min_stock numeric not null default 0,
  cost numeric not null default 0,
  price numeric not null default 0,
  status public.record_status not null default 'active',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.products to authenticated;
grant all on public.products to service_role;
alter table public.products enable row level security;
create trigger products_updated_at before update on public.products
  for each row execute function public.tg_set_updated_at();
create index on public.products (workspace_id);

create policy "Neg members read products"
  on public.products for select to authenticated
  using (public.has_workspace_access(auth.uid(), workspace_id, 'negocio'));
create policy "Neg writers create products"
  on public.products for insert to authenticated
  with check (public.can_write(auth.uid(), workspace_id, 'negocio') and created_by = auth.uid());
create policy "Neg managers update products"
  on public.products for update to authenticated
  using (public.can_manage(auth.uid(), workspace_id, 'negocio'))
  with check (public.can_manage(auth.uid(), workspace_id, 'negocio'));
create policy "Admin deletes products"
  on public.products for delete to authenticated
  using (public.is_workspace_admin(auth.uid(), workspace_id));

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  address text,
  notes text,
  preferred_channel public.preferred_channel,
  status public.record_status not null default 'active',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.customers to authenticated;
grant all on public.customers to service_role;
alter table public.customers enable row level security;
create trigger customers_updated_at before update on public.customers
  for each row execute function public.tg_set_updated_at();
create index on public.customers (workspace_id);

create policy "Neg members read customers"
  on public.customers for select to authenticated
  using (public.has_workspace_access(auth.uid(), workspace_id, 'negocio'));
create policy "Neg writers create customers"
  on public.customers for insert to authenticated
  with check (public.can_write(auth.uid(), workspace_id, 'negocio') and created_by = auth.uid());
create policy "Neg managers update customers"
  on public.customers for update to authenticated
  using (public.can_manage(auth.uid(), workspace_id, 'negocio'))
  with check (public.can_manage(auth.uid(), workspace_id, 'negocio'));
create policy "Admin deletes customers"
  on public.customers for delete to authenticated
  using (public.is_workspace_admin(auth.uid(), workspace_id));

create table public.business_expenses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  date date not null default current_date,
  amount numeric not null check (amount >= 0),
  category text not null,
  description text,
  receipt_url text,
  status public.record_status not null default 'active',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.business_expenses to authenticated;
grant all on public.business_expenses to service_role;
alter table public.business_expenses enable row level security;
create trigger business_expenses_updated_at before update on public.business_expenses
  for each row execute function public.tg_set_updated_at();
create index on public.business_expenses (workspace_id, date desc);

create policy "Neg members read business expenses"
  on public.business_expenses for select to authenticated
  using (public.has_workspace_access(auth.uid(), workspace_id, 'negocio'));
create policy "Neg writers create business expenses"
  on public.business_expenses for insert to authenticated
  with check (public.can_write(auth.uid(), workspace_id, 'negocio') and created_by = auth.uid());
create policy "Neg managers update business expenses"
  on public.business_expenses for update to authenticated
  using (public.can_manage(auth.uid(), workspace_id, 'negocio'))
  with check (public.can_manage(auth.uid(), workspace_id, 'negocio'));
create policy "Admin deletes business expenses"
  on public.business_expenses for delete to authenticated
  using (public.is_workspace_admin(auth.uid(), workspace_id));

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  date date not null default current_date,
  customer_id uuid references public.customers(id) on delete set null,
  discount numeric not null default 0,
  total numeric not null default 0,
  origin public.sale_origin not null default 'manual',
  status public.sale_status not null default 'confirmada',
  notes text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.sales to authenticated;
grant all on public.sales to service_role;
alter table public.sales enable row level security;
create trigger sales_updated_at before update on public.sales
  for each row execute function public.tg_set_updated_at();
create index on public.sales (workspace_id, date desc);

create policy "Neg members read sales"
  on public.sales for select to authenticated
  using (public.has_workspace_access(auth.uid(), workspace_id, 'negocio'));
create policy "Neg writers create sales"
  on public.sales for insert to authenticated
  with check (public.can_write(auth.uid(), workspace_id, 'negocio') and created_by = auth.uid());
create policy "Neg managers update sales"
  on public.sales for update to authenticated
  using (public.can_manage(auth.uid(), workspace_id, 'negocio'))
  with check (public.can_manage(auth.uid(), workspace_id, 'negocio'));
create policy "Admin deletes sales"
  on public.sales for delete to authenticated
  using (public.is_workspace_admin(auth.uid(), workspace_id));

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  custom_name text,
  quantity numeric not null default 1,
  unit_price numeric not null default 0,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.sale_items to authenticated;
grant all on public.sale_items to service_role;
alter table public.sale_items enable row level security;
create index on public.sale_items (sale_id);

create policy "Read sale items via sale"
  on public.sale_items for select to authenticated
  using (exists (
    select 1 from public.sales s
    where s.id = sale_id
      and public.has_workspace_access(auth.uid(), s.workspace_id, 'negocio')
  ));
create policy "Write sale items via sale"
  on public.sale_items for insert to authenticated
  with check (exists (
    select 1 from public.sales s
    where s.id = sale_id
      and public.can_write(auth.uid(), s.workspace_id, 'negocio')
  ));
create policy "Update sale items via sale"
  on public.sale_items for update to authenticated
  using (exists (
    select 1 from public.sales s
    where s.id = sale_id
      and public.can_manage(auth.uid(), s.workspace_id, 'negocio')
  ));
create policy "Delete sale items via sale"
  on public.sale_items for delete to authenticated
  using (exists (
    select 1 from public.sales s
    where s.id = sale_id
      and public.is_workspace_admin(auth.uid(), s.workspace_id)
  ));

-- ============================================================
-- AUTO PROFILE + WORKSPACE ON SIGNUP
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  new_ws uuid;
  display text;
begin
  display := coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1));

  insert into public.profiles (id, display_name, email)
  values (new.id, display, new.email);

  insert into public.workspaces (name, created_by)
  values (coalesce(display, 'O meu workspace'), new.id)
  returning id into new_ws;

  insert into public.workspace_members (workspace_id, user_id, role, access_casa, access_negocio, status)
  values (new_ws, new.id, 'admin', true, true, 'active');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
