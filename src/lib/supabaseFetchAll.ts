/**
 * Fetch every row of a query, paging past PostgREST's ~1000-row response cap
 * (a plain `.select()` silently truncates at 1000 rows otherwise).
 * `runPage` must return a fresh query for the given [from, to] range.
 */
export async function fetchAllRows<T>(
  runPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<{ data: T[]; error: { message: string } | null }> {
  const pageSize = 1000;
  const all: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await runPage(from, from + pageSize - 1);
    if (error) return { data: all, error };
    if (!data) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return { data: all, error: null };
}
