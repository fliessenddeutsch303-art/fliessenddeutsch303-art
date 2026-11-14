-- Fixes found during the 2026-10-31 audit. Safe to re-run.

-- 1. The exam manager stores quiz and main-test rows; the enum only allowed
--    placement/osd/internal, so every exam-row save failed.
alter type public.exam_type add value if not exists 'quiz';
alter type public.exam_type add value if not exists 'main';

-- 2. Shared department logins have several employee profiles. Attendance was
--    unique per login account per day, so the second person on a shared login
--    could never be checked in. Attendance is now unique per profile per day.
do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.employee_attendance'::regclass
      and c.contype = 'u'
      and pg_get_constraintdef(c.oid) ilike '%(user_id, date)%'
  loop
    execute format('alter table public.employee_attendance drop constraint %I', constraint_name);
  end loop;
end $$;

create unique index if not exists employee_attendance_profile_date_key
  on public.employee_attendance(employee_profile_id, date);
-- Legacy rows without a profile keep one row per account per day.
create unique index if not exists employee_attendance_account_date_legacy_key
  on public.employee_attendance(user_id, date) where employee_profile_id is null;

-- 3. Teachers can be paid per session. Account Center stores the rate in hourly_rate.
alter table public.users drop constraint if exists users_payroll_type_check;
alter table public.users
  add constraint users_payroll_type_check
  check (payroll_type in ('monthly_salary', 'monthly_wage', 'hourly', 'per_session'));

-- 4. Deleting an employee failed with a foreign-key error once they had created
--    any record. Keep the history and clear the reference instead.
do $$
declare
  fk record;
begin
  for fk in
    select c.conname, t.relname as table_name, a.attname as column_name
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f'
      and c.confrelid = 'public.users'::regclass
      and n.nspname = 'public'
      and array_length(c.conkey, 1) = 1
      and c.confdeltype = 'a'
      and not a.attnotnull
      and t.relname <> 'employee_profiles'
  loop
    execute format('alter table public.%I drop constraint %I', fk.table_name, fk.conname);
    execute format(
      'alter table public.%I add constraint %I foreign key (%I) references public.users(id) on delete set null',
      fk.table_name, fk.conname, fk.column_name
    );
  end loop;
end $$;

-- 5. Bookings were counted by the lead's creation date, so a lead created last
--    month and booked today never appeared in today's numbers.
alter table public.leads add column if not exists booked_at timestamptz;
update public.leads set booked_at = created_at where status = 'booked' and booked_at is null;
create index if not exists leads_booked_at_idx on public.leads(booked_at) where booked_at is not null;

create or replace function public.set_lead_booked_at() returns trigger
language plpgsql as $$
begin
  if new.status = 'booked' and (tg_op = 'INSERT' or old.status is distinct from 'booked') then
    new.booked_at := coalesce(new.booked_at, now());
  elsif new.status <> 'booked' then
    new.booked_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists leads_set_booked_at on public.leads;
create trigger leads_set_booked_at before insert or update of status on public.leads
  for each row execute function public.set_lead_booked_at();

-- 6. Indexes for the date-scoped dashboard/report queries.
create index if not exists student_attendance_date_idx on public.student_attendance(date);
create index if not exists teacher_attendance_date_idx on public.teacher_attendance(date);
create index if not exists employee_attendance_date_idx on public.employee_attendance(date);
create index if not exists treasury_records_date_idx on public.treasury_records(date);
create index if not exists lead_interactions_created_at_idx on public.lead_interactions(created_at);

-- 7. The role helpers read public.users from inside policies on public.users.
--    As invoker functions they were re-checked by RLS on every row (and can
--    recurse through "admin all users"). Run them as definer with a fixed
--    search_path; auth.uid() still identifies the caller.
create or replace function public.current_role() returns public.user_role
language sql stable security definer set search_path = public as $$
  select role from public.users where id = (select auth.uid()) and is_active = true
$$;

create or replace function public.current_permissions() returns jsonb
language sql stable security definer set search_path = public as $$
  select permissions from public.users where id = (select auth.uid()) and is_active = true
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select public.current_role() = 'admin'
$$;

-- 8. A lead with no file (for example a student moved to the waiting list)
--    was invisible to the sales user it was assigned to.
drop policy if exists "sales assigned leads" on public.leads;
create policy "sales assigned leads" on public.leads for all to authenticated
  using (
    public.current_role() = 'sales'
    and assigned_to = (select auth.uid())
    and (
      file_id is null
      or file_id::text in (select jsonb_array_elements_text(coalesce(public.current_permissions()->'assigned_files', '[]'::jsonb)))
    )
  )
  with check (public.current_role() = 'sales' and assigned_to = (select auth.uid()));

-- 9. Teacher screens no longer show payments; do not leave the data readable through the API.
drop policy if exists "teacher read own student accounts" on public.student_account_records;

-- 10. Employee profiles carry pay rates. Only reception (staff check-in) and
--     the login that owns a profile need to read them besides admins.
drop policy if exists "staff read employee profiles" on public.employee_profiles;
create policy "staff read employee profiles" on public.employee_profiles
  for select to authenticated
  using (public.current_role() = 'reception' or account_user_id = (select auth.uid()));

-- 11. Audit rows must carry the real caller; any signed-in user could insert
--     rows in someone else's name. (Server routes use the service role, which bypasses RLS.)
drop policy if exists "Authenticated users can write audit logs" on public.audit_logs;
create policy "Authenticated users can write audit logs" on public.audit_logs
  for insert to authenticated with check (actor_user_id = (select auth.uid()));

-- Changes made by server routes (no end-user session) were logged as "Unknown user".
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
    coalesce(actor.full_name, case when auth.uid() is null then 'System' else 'Unknown user' end),
    actor.email,
    lower(tg_op),
    tg_table_name,
    changed_id,
    jsonb_build_object('old', old_data, 'new', new_data)
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

-- 12. Tables created after the initial "grant ... on all tables" rely on
--     default privileges; make the grants explicit. RLS still decides access.
grant select, insert on public.audit_logs to authenticated;
grant select, insert, update, delete on public.textbook_inventory to authenticated;
grant select, insert, update, delete on public.lead_reminders to authenticated;
