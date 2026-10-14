-- Login accounts represent access groups; employee_profiles represent people.
alter table public.users
  add column if not exists account_kind text not null default 'individual';

alter table public.users
  drop constraint if exists users_account_kind_check;

alter table public.users
  add constraint users_account_kind_check
  check (account_kind in ('shared', 'individual'));

create table if not exists public.employee_profiles (
  id uuid primary key default gen_random_uuid(),
  account_user_id uuid not null references public.users(id) on delete restrict,
  full_name text not null,
  role public.user_role not null,
  phone text,
  is_active boolean not null default true,
  payroll_type text not null default 'monthly_salary'
    check (payroll_type in ('monthly_salary', 'monthly_wage', 'hourly', 'per_session')),
  monthly_salary numeric not null default 0,
  monthly_wage numeric not null default 0,
  hourly_rate numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists employee_profiles_account_user_idx on public.employee_profiles(account_user_id);
create index if not exists employee_profiles_role_active_idx on public.employee_profiles(role, is_active);

alter table public.teachers add column if not exists employee_profile_id uuid references public.employee_profiles(id) on delete set null;
alter table public.employee_attendance add column if not exists employee_profile_id uuid references public.employee_profiles(id) on delete cascade;
alter table public.employee_adjustments add column if not exists employee_profile_id uuid references public.employee_profiles(id) on delete cascade;
alter table public.employee_events add column if not exists employee_profile_id uuid references public.employee_profiles(id) on delete cascade;
alter table public.employee_attendance alter column user_id drop not null;

create index if not exists employee_attendance_profile_date_idx on public.employee_attendance(employee_profile_id, date);
create index if not exists employee_adjustments_profile_period_idx on public.employee_adjustments(employee_profile_id, period_start, period_end);
create index if not exists employee_events_profile_date_idx on public.employee_events(employee_profile_id, event_date);

alter table public.employee_profiles enable row level security;

drop policy if exists "admin all employee profiles" on public.employee_profiles;
create policy "admin all employee profiles" on public.employee_profiles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "staff read employee profiles" on public.employee_profiles;
create policy "staff read employee profiles" on public.employee_profiles
  for select to authenticated
  using (public.current_role() in ('admin', 'reception', 'sales', 'teacher'));

grant select, insert, update, delete on public.employee_profiles to authenticated;

-- Shared department accounts are unique by role. Existing individual accounts are untouched.
create unique index if not exists shared_department_account_role_idx
  on public.users(role)
  where account_kind = 'shared' and role in ('reception', 'sales');

-- One active browser/device session per login account.
create table if not exists public.account_active_sessions (
  user_id uuid primary key references public.users(id) on delete cascade,
  session_key text not null unique,
  last_seen_at timestamptz not null default now()
);

alter table public.account_active_sessions enable row level security;
create policy "users can read own active session" on public.account_active_sessions
  for select to authenticated using (user_id = (select auth.uid()));
grant select on public.account_active_sessions to authenticated;

-- Capture row-level changes for the admin log, including the real profile/account actor.
create or replace function public.write_audit_log() returns trigger
language plpgsql security invoker as $$
declare
  actor public.users%rowtype;
  changed_id text;
  old_data jsonb;
  new_data jsonb;
begin
  select * into actor from public.users where id = auth.uid();
  if tg_op = 'DELETE' then
    changed_id := coalesce(old.id::text, 'unknown');
    old_data := to_jsonb(old);
  else
    changed_id := coalesce(new.id::text, 'unknown');
    new_data := to_jsonb(new);
    if tg_op = 'UPDATE' then old_data := to_jsonb(old); end if;
  end if;
  insert into public.audit_logs(actor_user_id, actor_name, actor_email, action, entity_type, entity_id, details)
  values (
    auth.uid(),
    coalesce(actor.full_name, 'Unknown user'),
    actor.email,
    lower(tg_op),
    tg_table_name,
    changed_id,
    jsonb_build_object('old', old_data, 'new', new_data)
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists audit_students_changes on public.students;
create trigger audit_students_changes after insert or update or delete on public.students for each row execute function public.write_audit_log();
drop trigger if exists audit_classes_changes on public.classes;
create trigger audit_classes_changes after insert or update or delete on public.classes for each row execute function public.write_audit_log();
drop trigger if exists audit_treasury_changes on public.treasury_records;
create trigger audit_treasury_changes after insert or update or delete on public.treasury_records for each row execute function public.write_audit_log();
drop trigger if exists audit_employee_profiles_changes on public.employee_profiles;
create trigger audit_employee_profiles_changes after insert or update or delete on public.employee_profiles for each row execute function public.write_audit_log();
drop trigger if exists audit_employee_attendance_changes on public.employee_attendance;
create trigger audit_employee_attendance_changes after insert or update or delete on public.employee_attendance for each row execute function public.write_audit_log();
drop trigger if exists audit_leads_changes on public.leads;
create trigger audit_leads_changes after insert or update or delete on public.leads for each row execute function public.write_audit_log();
