// ---------------------------------------------------------------------------
// Client-side blob cache (IndexedDB). Previews store the downloaded image/PDF
// here keyed by a stable `${connId}:${s3Key}` string, so the next view is served
// from the user's own disk with zero network. Bounded by MAX_BYTES with LRU
// eviction. Browser-only — every entry point no-ops on the server.
// ---------------------------------------------------------------------------

const DB_NAME = "s3v-file-cache";
const DB_VERSION = 1;
const STORE = "objects";
const META = "meta";
const TOTAL_KEY = "totalSize";

// Keep the whole cache under ~2 GB, and never let a single huge file dominate it.
export const MAX_BYTES = 2 * 1024 ** 3;
const MAX_ITEM_BYTES = 512 * 1024 ** 2;

interface CacheRecord {
  key: string;
  blob: Blob;
  size: number;
  lastAccess: number;
}

function available(): boolean {
  return typeof indexedDB !== "undefined";
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: "key" });
          store.createIndex("lastAccess", "lastAccess");
        }
        if (!db.objectStoreNames.contains(META)) {
          db.createObjectStore(META);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function promisify<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** Look up a cached blob and bump its last-access time (LRU). */
export async function getBlob(key: string): Promise<Blob | null> {
  if (!available()) return null;
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const rec = (await promisify(store.get(key))) as CacheRecord | undefined;
    if (!rec) return null;
    rec.lastAccess = Date.now();
    store.put(rec);
    await txDone(tx);
    return rec.blob;
  } catch {
    return null;
  }
}

/** Store a blob, update the running total, then evict LRU entries over budget. */
export async function putBlob(key: string, blob: Blob): Promise<void> {
  if (!available() || blob.size > MAX_ITEM_BYTES) return;
  try {
    const db = await openDb();
    const tx = db.transaction([STORE, META], "readwrite");
    const store = tx.objectStore(STORE);
    const meta = tx.objectStore(META);

    const prev = (await promisify(store.get(key))) as CacheRecord | undefined;
    const total = ((await promisify(meta.get(TOTAL_KEY))) as number | undefined) ?? 0;

    const rec: CacheRecord = { key, blob, size: blob.size, lastAccess: Date.now() };
    store.put(rec);
    meta.put(total - (prev?.size ?? 0) + blob.size, TOTAL_KEY);
    await txDone(tx);

    await evictLRU();
  } catch {
    // QuotaExceededError or similar — best-effort cache, so just skip.
  }
}

/** Remove a single entry (used by "Fetch from remote"). */
export async function remove(key: string): Promise<void> {
  if (!available()) return;
  try {
    const db = await openDb();
    const tx = db.transaction([STORE, META], "readwrite");
    const store = tx.objectStore(STORE);
    const meta = tx.objectStore(META);
    const prev = (await promisify(store.get(key))) as CacheRecord | undefined;
    if (prev) {
      store.delete(key);
      const total = ((await promisify(meta.get(TOTAL_KEY))) as number | undefined) ?? 0;
      meta.put(Math.max(0, total - prev.size), TOTAL_KEY);
    }
    await txDone(tx);
  } catch {
    // ignore
  }
}

/** Delete oldest-accessed entries until the total is within MAX_BYTES. */
async function evictLRU(): Promise<void> {
  if (!available()) return;
  try {
    const db = await openDb();
    const tx = db.transaction([STORE, META], "readwrite");
    const store = tx.objectStore(STORE);
    const meta = tx.objectStore(META);
    let total = ((await promisify(meta.get(TOTAL_KEY))) as number | undefined) ?? 0;
    if (total <= MAX_BYTES) return;

    // Walk the lastAccess index oldest-first, deleting until under budget.
    await new Promise<void>((resolve, reject) => {
      const cursorReq = store.index("lastAccess").openCursor();
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (!cursor || total <= MAX_BYTES) {
          resolve();
          return;
        }
        const rec = cursor.value as CacheRecord;
        total -= rec.size;
        cursor.delete();
        cursor.continue();
      };
      cursorReq.onerror = () => reject(cursorReq.error);
    });

    meta.put(Math.max(0, total), TOTAL_KEY);
    await txDone(tx);
  } catch {
    // ignore
  }
}
