const values = new Map<string, { expires: number; promise: Promise<unknown> }>();
export async function liveValue<T>(key: string, load: () => Promise<T>, ttl = 10000): Promise<T> {
  const current = values.get(key);
  if (current && current.expires > Date.now()) return current.promise as Promise<T>;
  const entry = { expires: Infinity, promise: Promise.resolve().then(load) };
  values.set(key, entry);
  try { const result = await entry.promise; entry.expires = Date.now() + ttl; return result; }
  catch (e) { if (values.get(key) === entry) values.delete(key); throw e; }
}
export function clearLiveCache() { values.clear(); }
