alter table public.students add column if not exists portal_token text;
alter table public.teachers add column if not exists portal_token text;

update public.students
set portal_token = replace(gen_random_uuid()::text, '-', '')
where portal_token is null;

update public.teachers
set portal_token = replace(gen_random_uuid()::text, '-', '')
where portal_token is null;

create unique index if not exists students_portal_token_idx on public.students (portal_token);
create unique index if not exists teachers_portal_token_idx on public.teachers (portal_token);

alter table public.students alter column portal_token set default replace(gen_random_uuid()::text, '-', '');
alter table public.teachers alter column portal_token set default replace(gen_random_uuid()::text, '-', '');
