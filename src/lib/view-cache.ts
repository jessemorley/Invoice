// Last-seen view data, kept on the device in IndexedDB so the app can show it
// on launch before (or without) a network fetch. Best-effort: any storage
// failure (private mode, eviction, quota) falls back to an empty cache.
//
// Keys: "owner" → the user ID the data belongs to, plus one key per view.

type Store = {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  clear(): Promise<void>;
};

let db: Promise<IDBDatabase> | undefined;

function openDb(): Promise<IDBDatabase> {
  return (db ??= new Promise((resolve, reject) => {
    const req = indexedDB.open("invoicing-view-cache", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("views");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      db = undefined;
      reject(req.error);
    };
  }));
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const conn = await openDb();
  return new Promise((resolve, reject) => {
    const req = fn(conn.transaction("views", mode).objectStore("views"));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const idbStore: Store = {
  get: (key) => run("readonly", (s) => s.get(key)),
  set: (key, value) => run("readwrite", (s) => s.put(value, key)).then(() => {}),
  clear: () => run("readwrite", (s) => s.clear()).then(() => {}),
};

// Returns the saved data for `views` if it belongs to `userId`. If it belongs
// to anyone else (or no one), wipes it and claims the cache for `userId`.
export async function readCache<V extends string>(
  userId: string,
  views: readonly V[],
  store: Store = idbStore
): Promise<Partial<Record<V, unknown>>> {
  try {
    if ((await store.get("owner")) !== userId) {
      await store.clear();
      await store.set("owner", userId);
      return {};
    }
    const values = await Promise.all(views.map((v) => store.get(v)));
    const out: Partial<Record<V, unknown>> = {};
    views.forEach((v, i) => {
      if (values[i] !== undefined) out[v] = values[i];
    });
    return out;
  } catch {
    return {};
  }
}

export async function writeCache(view: string, data: unknown, store: Store = idbStore): Promise<void> {
  try {
    await store.set(view, data);
  } catch {
    // best-effort
  }
}

// The service worker's cached HTML for "/" (public/sw.js) carries the user's
// identity, so it goes when the user does. Scripts are kept.
export async function clearCachedPages(): Promise<void> {
  try {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith("pages-")).map((k) => caches.delete(k)));
  } catch {
    // best-effort
  }
}

export async function clearCache(store: Store = idbStore): Promise<void> {
  try {
    await store.clear();
  } catch {
    // best-effort
  }
}
