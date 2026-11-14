-- books given to students
create table if not exists public.student_books (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  textbook_id uuid references public.textbook_inventory(id) on delete set null,
  title text not null check (length(trim(title)) > 0),
  received_at date not null default ((now() at time zone 'Africa/Cairo')::date),
  price numeric(12,2) not null default 0 check (price >= 0),
  payment_status text not null default 'unpaid' check (payment_status in ('paid', 'unpaid', 'arranged')),
  payment_due_date date,
  paid_at date,
  notes text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_books_arranged_needs_date check (payment_status <> 'arranged' or payment_due_date is not null)
);

create index if not exists student_books_student_idx on public.student_books(student_id, received_at desc);
create index if not exists student_books_due_idx on public.student_books(payment_due_date) where payment_status <> 'paid';

alter table public.student_books enable row level security;
drop policy if exists "admin and reception manage student books" on public.student_books;
create policy "admin and reception manage student books" on public.student_books for all to authenticated
  using (public.current_role() in ('admin', 'reception'))
  with check (public.current_role() in ('admin', 'reception'));
grant select, insert, update, delete on public.student_books to authenticated;

-- reception picks from the inventory
drop policy if exists "reception read textbook inventory" on public.textbook_inventory;
create policy "reception read textbook inventory" on public.textbook_inventory for select to authenticated
  using (public.current_role() = 'reception');

-- stock goes down when a book is handed out and back up on delete.
-- definer because reception can't update the inventory
create or replace function public.student_books_adjust_stock() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    new.updated_at := now();
    if old.textbook_id is not distinct from new.textbook_id then return new; end if;
  end if;
  if tg_op in ('UPDATE', 'DELETE') and old.textbook_id is not null then
    update public.textbook_inventory set quantity_on_hand = quantity_on_hand + 1, updated_at = now() where id = old.textbook_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.textbook_id is not null then
    update public.textbook_inventory set quantity_on_hand = greatest(quantity_on_hand - 1, 0), updated_at = now() where id = new.textbook_id;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists student_books_stock on public.student_books;
create trigger student_books_stock before insert or update or delete on public.student_books
  for each row execute function public.student_books_adjust_stock();

drop trigger if exists audit_student_books_changes on public.student_books;
create trigger audit_student_books_changes after insert or update or delete on public.student_books
  for each row execute function public.write_audit_log();
