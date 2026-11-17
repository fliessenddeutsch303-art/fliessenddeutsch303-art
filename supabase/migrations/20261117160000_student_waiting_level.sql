-- students wait for a level (a class for it may not exist yet)
alter table public.students add column if not exists waiting_level text;
