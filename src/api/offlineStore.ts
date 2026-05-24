import type { AppStatePayload } from "./client";

const DB_NAME = "lexy-offline-v1";
const STORE_NAME = "snapshots";
const CURRENT_KEY = "current";

export type OfflineSnapshot = {
  key: string;
  payload: AppStatePayload;
  savedAt: string;
  pendingCloudSync: boolean;
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onerror = () => reject(request.error ?? new Error("No se pudo abrir IndexedDB."));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
  });
}

function runTransaction<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDatabase().then((db) => new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    const request = run(store);

    request.onerror = () => reject(request.error ?? new Error("Error en IndexedDB."));
    request.onsuccess = () => resolve(request.result);

    transaction.oncomplete = () => db.close();
    transaction.onerror = () => reject(transaction.error ?? new Error("Transaccion IndexedDB fallida."));
  }));
}

export async function saveOfflineSnapshot(
  payload: AppStatePayload,
  pendingCloudSync: boolean,
): Promise<void> {
  const record: OfflineSnapshot = {
    key: CURRENT_KEY,
    payload,
    savedAt: new Date().toISOString(),
    pendingCloudSync,
  };

  await runTransaction("readwrite", (store) => store.put(record));
}

export async function loadOfflineSnapshot(): Promise<OfflineSnapshot | null> {
  const record = await runTransaction<OfflineSnapshot | undefined>(
    "readonly",
    (store) => store.get(CURRENT_KEY),
  );
  return record ?? null;
}

export async function clearOfflinePendingSync(payload: AppStatePayload): Promise<void> {
  await saveOfflineSnapshot(payload, false);
}

export function isNetworkFailure(error: unknown) {
  if (error instanceof TypeError) return true;
  if (error instanceof DOMException && error.name === "AbortError") return true;
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return message.includes("failed to fetch")
      || message.includes("network")
      || message.includes("load failed");
  }
  return false;
}

export function isRecoverableLoadFailure(error: unknown) {
  if (isNetworkFailure(error)) return true;

  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return message.includes("ehostunreach")
    || message.includes("enotfound")
    || message.includes("econnrefused")
    || message.includes("etimedout")
    || message.includes("connect")
    || message.includes("network")
    || message.includes("fetch failed")
    || message.includes("servidor api")
    || message.includes("conectando con supabase")
    || message.includes("http 503");
}

export async function checkApiReachable() {
  try {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 4000);
    const response = await fetch(`${import.meta.env.VITE_API_URL ?? ""}/api/health`, {
      signal: controller.signal,
    });
    window.clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}
