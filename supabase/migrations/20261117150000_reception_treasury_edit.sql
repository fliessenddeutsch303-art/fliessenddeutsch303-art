-- reception can see and fix the entries it made (shared login, so all reception entries)
drop policy if exists "reception read own treasury entries" on public.treasury_records;
create policy "reception read own treasury entries" on public.treasury_records for select to authenticated
  using (public.current_role() = 'reception' and created_by = (select auth.uid()));
drop policy if exists "reception update own treasury entries" on public.treasury_records;
create policy "reception update own treasury entries" on public.treasury_records for update to authenticated
  using (public.current_role() = 'reception' and created_by = (select auth.uid()))
  with check (public.current_role() = 'reception' and created_by = (select auth.uid()));
