import {
  getDatabaseMode,
  getMssqlConfig,
  isDualDatabaseMode,
  usesCloudPostgres,
  usesLocalSqlServer,
} from "./config.js";
import { MssqlBackend } from "./mssqlBackend.js";
import { PostgresBackend } from "./postgresBackend.js";
import type { DatabaseBackend } from "./backend.js";
import {
  hasUserAppData,
  loadAppStateFrom,
  saveAppStateTo,
  type AppStatePayload,
} from "./appStateStore.js";
import { countCloudOnlyAdded, hasInboundCloudChanges, mergeAppStates } from "./syncMerge.js";

let primaryBackend: DatabaseBackend | null = null;
let cloudBackend: DatabaseBackend | null = null;
let reconnectHandler: (() => void) | null = null;
let cloudReconnectPending = false;

const CLOUD_RETRY_MS = 12_000;

let persistenceChain: Promise<unknown> = Promise.resolve();

function runPersistence<T>(fn: () => Promise<T>): Promise<T> {
  const run = persistenceChain.then(fn, fn);
  persistenceChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export type SaveAppStateResult = {
  cloudSynced: boolean;
  cloudError?: string;
  merged?: boolean;
  state?: AppStatePayload;
  addedFromCloud?: {
    products: number;
    transactions: number;
    appointments: number;
    stockMovements: number;
    wholesaleClients: number;
  };
};

export function setDatabaseReconnectHandler(handler: () => void) {
  reconnectHandler = handler;
}

export function getPrimaryBackend() {
  if (!primaryBackend?.ready) {
    throw new Error(getConnectingMessage());
  }
  return primaryBackend;
}

export function getCloudBackend() {
  return cloudBackend?.ready ? cloudBackend : null;
}

export function isDatabaseReady() {
  return primaryBackend?.ready === true;
}

export function isCloudDatabaseReady() {
  return cloudBackend?.ready === true;
}

export function getDatabaseLabel() {
  return primaryBackend?.label ?? "Base de datos";
}

export function getDatabaseModeLabel() {
  return getDatabaseMode();
}

export function getConnectingMessage() {
  if (isDualDatabaseMode()) {
    return "Conectando con SQL Server local...";
  }
  if (usesLocalSqlServer()) {
    return "Conectando con SQL Server...";
  }
  return "Conectando con Supabase...";
}

function scheduleCloudReconnect() {
  if (cloudReconnectPending || !reconnectHandler || !usesCloudPostgres()) return;
  cloudReconnectPending = true;
  reconnectHandler();
}

async function initCloudBackend() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    if (getDatabaseMode() === "cloud") {
      throw new Error("DATABASE_URL no esta configurada. Revisa tu archivo .env");
    }
    return null;
  }

  const backend = new PostgresBackend(connectionString);
  const now = await backend.init();
  cloudBackend = backend;
  cloudReconnectPending = false;
  console.log(`[cloud] ${backend.label} conectado: ${now}`);
  return backend;
}

async function initPrimaryBackend() {
  if (usesLocalSqlServer()) {
    const backend = new MssqlBackend();
    const now = await backend.init();
    primaryBackend = backend;
    console.log(`[local] ${backend.label} conectado: ${now}`);
    return backend;
  }

  const cloud = await initCloudBackend();
  primaryBackend = cloud;
  return cloud;
}

export type ImportFromCloudResult = {
  imported: boolean;
  products: number;
  transactions: number;
  users: number;
  message: string;
};

export async function syncUsersFromCloudToLocal(force = false) {
  if (!primaryBackend?.ready || !cloudBackend?.ready) return 0;

  const localCountResult = await primaryBackend.query("SELECT COUNT(*) AS count FROM users");
  const localCount = Number(localCountResult.rows[0]?.count ?? 0);
  if (!force && localCount > 0) return localCount;

  const result = await cloudBackend.query("SELECT * FROM users ORDER BY display_name");
  const rows = result.rows;
  if (rows.length === 0) {
    console.warn("[sync] Supabase no tiene usuarios para copiar al login local.");
    return 0;
  }

  await primaryBackend.withTransaction(async (tx) => {
    await tx.query("DELETE FROM users");
    for (const row of rows) {
      await tx.query(`
        INSERT INTO users (id, username, password, password_hash, display_name, role, active)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        row.id,
        row.username,
        row.password,
        row.password_hash,
        row.display_name,
        row.role,
        row.active === true || row.active === 1,
      ]);
    }
  });

  console.log(`[sync] ${rows.length} usuario(s) de login copiados a SQL Server local.`);
  return rows.length;
}

async function ensureLocalUsersFromCloud() {
  if (!isDualDatabaseMode()) return 0;
  try {
    await ensureCloudBackendConnected();
    return await syncUsersFromCloudToLocal(false);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("[sync] Usuarios locales no sincronizados:", message);
    return 0;
  }
}

export async function importCloudStateToLocal(force = false): Promise<ImportFromCloudResult> {
  if (!isDualDatabaseMode()) {
    throw new Error("La importacion desde la nube solo aplica en DATABASE_MODE=dual.");
  }
  if (!primaryBackend?.ready || !cloudBackend?.ready) {
    throw new Error("SQL Server local y Supabase deben estar conectados.");
  }

  const localState = await loadAppStateFrom(primaryBackend);
  if (!force && (hasUserAppData(localState) || localState.products.length > 0)) {
    return {
      imported: false,
      products: localState.products.length,
      transactions: localState.transactions.length,
      users: 0,
      message: "La base local ya tiene datos. Usa force=true para sobrescribir con la nube.",
    };
  }

  const cloudState = await loadAppStateFrom(cloudBackend);
  if (!hasUserAppData(cloudState) && cloudState.products.length === 0) {
    return {
      imported: false,
      products: 0,
      transactions: 0,
      users: 0,
      message: "Supabase no tiene datos para importar.",
    };
  }

  await saveAppStateTo(primaryBackend, cloudState);
  const users = await syncUsersFromCloudToLocal();

  const message = `Importados ${cloudState.products.length} producto(s), `
    + `${cloudState.transactions.length} venta(s) y ${users} usuario(s) desde Supabase.`;
  console.log(`[sync] ${message}`);

  return {
    imported: true,
    products: cloudState.products.length,
    transactions: cloudState.transactions.length,
    users,
    message,
  };
}

async function bootstrapLocalFromCloudIfNeeded() {
  if (!isDualDatabaseMode() || !primaryBackend?.ready || !cloudBackend?.ready) return;

  try {
    const result = await importCloudStateToLocal(false);
    if (result.imported) {
      console.log(`[sync] ${result.message}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("[sync] No se pudo importar datos desde Supabase:", message);
  }
}

export async function initDatabase() {
  const mode = getDatabaseMode();
  console.log(`[db] Modo configurado: ${mode}`);

  primaryBackend = null;

  if (usesLocalSqlServer()) {
    try {
      await initPrimaryBackend();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[local] Error SQL Server (${getMssqlConfig().server} / ${getMssqlConfig().database}): ${message}`);
      throw new Error(
        mode === "dual"
          ? `No se pudo conectar a SQL Server local. Verifica que el servicio este iniciado y la base LexyLocal exista. Detalle: ${message}`
          : message,
      );
    }
  }

  if (usesCloudPostgres()) {
    try {
      if (!cloudBackend?.ready) {
        await initCloudBackend();
      }
    } catch (error) {
      if (mode === "cloud") {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[cloud] Supabase no disponible (modo ${mode}): ${message}`);
    }
  }

  if (!primaryBackend?.ready && cloudBackend?.ready && mode === "cloud") {
    primaryBackend = cloudBackend;
  }

  if (!primaryBackend?.ready) {
    if (mode === "dual") {
      throw new Error(
        "Modo dual requiere SQL Server local. Revisa DATABASE_MODE=dual y MSSQL_* en .env, "
        + "y que SQL Server Express este en ejecucion.",
      );
    }
    throw new Error("No hay base de datos principal disponible.");
  }

  await bootstrapLocalFromCloudIfNeeded();
  await ensureLocalUsersFromCloud();
  return primaryBackend.ping();
}

export async function resetDatabase() {
  await primaryBackend?.reset();
  await cloudBackend?.reset();
  primaryBackend = null;
  cloudBackend = null;
  cloudReconnectPending = false;
}

export async function pingDatabase() {
  return getPrimaryBackend().ping();
}

export async function loadAppState(): Promise<AppStatePayload> {
  return loadAppStateFrom(getPrimaryBackend());
}

async function ensureCloudBackendConnected() {
  if (cloudBackend?.ready) return true;

  if (!usesCloudPostgres()) return false;

  try {
    await initCloudBackend();
    return cloudBackend?.ready === true;
  } catch {
    return false;
  }
}

export async function syncDualDatabases(localBaseline?: AppStatePayload): Promise<SaveAppStateResult> {
  if (!isDualDatabaseMode() || !primaryBackend?.ready) {
    return { cloudSynced: !isDualDatabaseMode() };
  }

  return runPersistence(() => syncDualDatabasesInternal(localBaseline));
}

function queueCloudSync(localBaseline?: AppStatePayload) {
  if (!isDualDatabaseMode() || !primaryBackend?.ready) return;

  void runPersistence(() => syncDualDatabasesInternal(localBaseline)).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("[sync] Envio a nube en segundo plano fallido:", message);
  });
}

async function syncDualDatabasesInternal(localBaseline?: AppStatePayload): Promise<SaveAppStateResult> {
  try {
    const cloudReady = await ensureCloudBackendConnected();
    if (!cloudReady || !cloudBackend?.ready) {
      scheduleCloudReconnect();
      const fallbackState = localBaseline ?? await loadAppStateFrom(primaryBackend);
      return {
        cloudSynced: false,
        cloudError: "Sin conexion con Supabase. Los datos quedaron en SQL Server local.",
        state: fallbackState,
      };
    }

    // Guardado iniciado por la app: local ya fue escrito, solo empujar a nube.
    if (localBaseline) {
      await saveAppStateTo(cloudBackend, localBaseline);
      return {
        cloudSynced: true,
        merged: false,
        state: localBaseline,
        addedFromCloud: { products: 0, transactions: 0, appointments: 0, stockMovements: 0, wholesaleClients: 0 },
      };
    }

    // Sync en segundo plano: releer local justo antes de escribir (evita carrera con borrados).
    const cloudState = await loadAppStateFrom(cloudBackend);
    let freshLocal = await loadAppStateFrom(primaryBackend);
    let merged = mergeAppStates(freshLocal, cloudState);
    merged.products = freshLocal.products;

    freshLocal = await loadAppStateFrom(primaryBackend);
    merged = mergeAppStates(freshLocal, cloudState);
    merged.products = freshLocal.products;

    const addedFromCloud = countCloudOnlyAdded(freshLocal, merged);
    const inboundCloudChanges = hasInboundCloudChanges(addedFromCloud);

    if (inboundCloudChanges) {
      await saveAppStateTo(primaryBackend, merged);
    }

    await saveAppStateTo(cloudBackend, merged);

    try {
      await ensureLocalUsersFromCloud();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn("[sync] Usuarios locales no actualizados:", message);
    }

    if (inboundCloudChanges) {
      console.log(
        "[sync] Bidireccional OK · cambios de nube aplicados en local "
        + `(+${addedFromCloud.transactions} ventas, +${addedFromCloud.appointments} citas)`,
      );
    } else {
      console.log("[sync] Bidireccional OK · inventario local enviado a nube.");
    }

    return {
      cloudSynced: true,
      merged: inboundCloudChanges,
      state: inboundCloudChanges ? { ...merged, products: freshLocal.products } : freshLocal,
      addedFromCloud,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[sync] Error bidireccional:", message);
    return {
      cloudSynced: false,
      cloudError: message,
      state: localBaseline ?? undefined,
    };
  }
}

export async function saveAppState(payload: AppStatePayload): Promise<SaveAppStateResult> {
  return runPersistence(async () => {
    await saveAppStateTo(getPrimaryBackend(), payload);

    if (!isDualDatabaseMode()) {
      return { cloudSynced: true, state: payload };
    }

    // Regla principal: confirmar guardado local inmediatamente y sincronizar nube en segundo plano.
    queueCloudSync(payload);
    return {
      cloudSynced: false,
      cloudError: "Pendiente de sincronizacion con Supabase.",
      merged: false,
      state: payload,
      addedFromCloud: { products: 0, transactions: 0, appointments: 0, stockMovements: 0, wholesaleClients: 0 },
    };
  });
}

export async function reconnectCloudDatabase() {
  if (!usesCloudPostgres() || getDatabaseMode() === "local") return;

  try {
    await cloudBackend?.reset();
    await initCloudBackend();
    cloudReconnectPending = false;

    if (isDualDatabaseMode() && primaryBackend?.ready && cloudBackend?.ready) {
      await syncDualDatabases();
    }
  } catch (error) {
    cloudReconnectPending = false;
    const message = error instanceof Error ? error.message : String(error);
    console.warn("[cloud] Reintento de conexion fallido:", message);
  }
}

export function startBackgroundCloudSync() {
  if (!isDualDatabaseMode()) return;

  setInterval(() => {
    if (!primaryBackend?.ready) return;
    void syncDualDatabases().catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      console.warn("[sync] Ciclo en segundo plano fallido:", message);
    });
  }, CLOUD_RETRY_MS);
}

export async function pushLocalStateToCloud(): Promise<SaveAppStateResult> {
  const freshLocal = await loadAppStateFrom(primaryBackend!);
  return syncDualDatabases(freshLocal);
}
