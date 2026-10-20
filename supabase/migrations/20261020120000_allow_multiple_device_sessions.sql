-- Allow one employee account to stay signed in on multiple devices/browsers.
alter table public.account_active_sessions
  add column if not exists id uuid default gen_random_uuid();

update public.account_active_sessions
set id = gen_random_uuid()
where id is null;

alter table public.account_active_sessions
  alter column id set not null;

alter table public.account_active_sessions
  drop constraint if exists account_active_sessions_pkey;

alter table public.account_active_sessions
  add constraint account_active_sessions_pkey primary key (id);

create unique index if not exists account_active_sessions_user_session_idx
  on public.account_active_sessions(user_id, session_key);
