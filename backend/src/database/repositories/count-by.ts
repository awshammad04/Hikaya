/**
 * Group a list into per-key counts.
 *
 * The in-memory repositories use this to produce the same shape the PostgreSQL
 * ones get from `GROUP BY`, so the service layer above cannot tell them apart.
 */
export function countBy<T>(
  items: T[],
  key: (item: T) => string,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const value = key(item);
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}
