-- deleting a student keeps the lead, it just loses the link
alter table public.leads drop constraint if exists leads_converted_to_student_id_fkey;
alter table public.leads add constraint leads_converted_to_student_id_fkey
  foreign key (converted_to_student_id) references public.students(id) on delete set null;
