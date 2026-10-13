create table if not exists public.manual_sheets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  columns jsonb not null default '[]'::jsonb,
  rows jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.report_snapshots (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete cascade,
  section text not null,
  rows jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, section)
);

alter table public.manual_sheets enable row level security;
alter table public.report_snapshots enable row level security;

create policy "admins manage manual sheets" on public.manual_sheets for all to authenticated
  using (public.current_role() = 'admin') with check (public.current_role() = 'admin');
create policy "sales manage own manual sheets" on public.manual_sheets for all to authenticated
  using (public.current_role() = 'sales' and owner_id = auth.uid())
  with check (public.current_role() = 'sales' and owner_id = auth.uid());
create policy "admins manage report snapshots" on public.report_snapshots for all to authenticated
  using (public.current_role() = 'admin') with check (public.current_role() = 'admin');
create policy "staff manage own report snapshots" on public.report_snapshots for all to authenticated
  using (public.current_role() in ('sales', 'reception', 'teacher') and owner_id = auth.uid())
  with check (public.current_role() in ('sales', 'reception', 'teacher') and owner_id = auth.uid());

grant select, insert, update, delete on public.manual_sheets to authenticated;
grant select, insert, update, delete on public.report_snapshots to authenticated;
create index if not exists manual_sheets_owner_idx on public.manual_sheets(owner_id, updated_at desc);
create index if not exists report_snapshots_owner_idx on public.report_snapshots(owner_id, section);
