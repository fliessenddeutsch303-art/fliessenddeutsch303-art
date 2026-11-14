type PageResult<T> = { data: T[] | null; error: { message: string } | null };

/**
 * PostgREST caps responses at 1000 rows, silently truncating larger tables.
 * Pages through the full result. `build` must apply a stable `order()`.
 */
export async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<PageResult<T>>, pageSize = 1000): Promise<PageResult<T>> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await build(from, from + pageSize - 1);
    if (error) return { data: rows, error };
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) return { data: rows, error: null };
  }
}
