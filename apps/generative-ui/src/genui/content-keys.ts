/**
 * Pairs each item of a list the model sent with a React key. The model's lists
 * have no ids, so the key comes from the item's content; a repeated item gets a
 * count so its key stays unique.
 */
export function withContentKeys<T>(
  items: readonly T[],
  keyOf: (item: T) => string,
): Array<{ key: string; item: T }> {
  const seen = new Map<string, number>();
  return items.map((item) => {
    const base = keyOf(item);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return { key: count === 0 ? base : `${base}#${count}`, item };
  });
}
