alter table public.manual_sheets
  add column if not exists assigned_sales_ids jsonb not null default '[]'::jsonb;

drop policy if exists "sales manage own manual sheets" on public.manual_sheets;

create policy "sales read owned or assigned manual sheets" on public.manual_sheets for select to authenticated
  using (
    public.current_role() = 'sales'
    and (owner_id = auth.uid() or assigned_sales_ids @> jsonb_build_array(auth.uid()::text))
  );
create policy "sales insert manual sheets" on public.manual_sheets for insert to authenticated
  with check (public.current_role() = 'sales' and owner_id = auth.uid());
create policy "sales update owned or assigned manual sheets" on public.manual_sheets for update to authenticated
  using (
    public.current_role() = 'sales'
    and (owner_id = auth.uid() or assigned_sales_ids @> jsonb_build_array(auth.uid()::text))
  )
  with check (
    public.current_role() = 'sales'
    and (owner_id = auth.uid() or assigned_sales_ids @> jsonb_build_array(auth.uid()::text))
  );
create policy "reception read manual sheets" on public.manual_sheets for select to authenticated
  using (public.current_role() = 'reception');

create policy "sales read classes for lead transfer" on public.classes for select to authenticated
  using (public.current_role() = 'sales');
