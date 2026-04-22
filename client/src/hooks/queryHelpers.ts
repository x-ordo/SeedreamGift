/**
 * Extracts an array from API response envelopes.
 *
 * The server wraps responses in `{ success, data }` via TransformInterceptor,
 * and paginated endpoints use `{ items, meta }`. This helper normalises all
 * three shapes so every list-query hook can share one extraction path.
 */
export function extractListData<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.items)) return obj.items as T[];
    if (Array.isArray(obj.data)) return obj.data as T[];
  }
  return [];
}
