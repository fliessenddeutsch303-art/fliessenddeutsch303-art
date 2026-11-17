-- length of one session, used for teacher hours
alter table public.classes add column if not exists session_hours numeric(4,2)
  check (session_hours is null or (session_hours > 0 and session_hours <= 12));

-- classes taught that day. class_hours is the total at save time, null = use check-in/out
alter table public.teacher_attendance add column if not exists class_ids uuid[] not null default '{}';
alter table public.teacher_attendance add column if not exists class_hours numeric(5,2)
  check (class_hours is null or class_hours >= 0);
