alter type public.student_status add value if not exists 'trial';

-- trial session: which class and when
alter table public.students add column if not exists trial_class_id uuid references public.classes(id) on delete set null;
alter table public.students add column if not exists trial_date date;

-- waiting list: since when and for which class
alter table public.students add column if not exists waiting_since date;
alter table public.students add column if not exists waiting_class_id uuid references public.classes(id) on delete set null;
