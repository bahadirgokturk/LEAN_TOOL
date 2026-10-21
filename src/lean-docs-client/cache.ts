type RecordPayload = Record<string, unknown>;
type CacheStorage = Pick<Storage, "getItem" | "setItem">;

/** A disposable UI cache. The API/database remains the source of truth. */
export function createRecordCache(getStorage: () => CacheStorage) {
  const records = new Map<string, RecordPayload[]>();
  return {
    get(key: string): RecordPayload[] {
      const cached = records.get(key);
      if (cached) return structuredClone(cached);
      try {
        const parsed: unknown = JSON.parse(getStorage().getItem(`lean_${key}`) || "[]");
        if (Array.isArray(parsed)) {
          records.set(key, parsed);
          return structuredClone(parsed);
        }
      } catch {
        // Storage can be unavailable or full; it must never block a server save.
      }
      return [];
    },
    set(key: string, value: RecordPayload[]) {
      records.set(key, structuredClone(value));
      try {
        getStorage().setItem(`lean_${key}`, JSON.stringify(value));
      } catch {
        // Keep the confirmed records in memory. Reload hydrates from the API.
        // Do not delete older browser data to make room.
      }
    },
  };
}
