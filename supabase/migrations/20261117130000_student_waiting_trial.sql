alter type public.student_status add value if not exists 'waiting';

-- the student came to a trial session
alter table public.students add column if not exists trial_done boolean not null default false;
