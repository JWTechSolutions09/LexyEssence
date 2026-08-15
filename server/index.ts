import type { NextFunction, Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadAppState, saveAppState, shouldMigrateLocalState, type AppStatePayload } from "./appState.js";
import {
  createUser,
  listUsers,
  loginUser,
  requireAdmin,
  requireAuth,
  updateUserDetails,
  updateUserPassword,
  type AuthenticatedRequest,
} from "./auth.js";
import {
  getConnectingMessage,
  getCloudBackend,
  getDatabaseLabel,
  getDatabaseModeLabel,
  initDatabase,
  isCloudDatabaseReady,
  isDatabaseReady,
  pingDatabase,
  importCloudStateToLocal,
  pushLocalStateToCloud,
  reconnectCloudDatabase,
  resetDatabase,
  setDatabaseReconnectHandler,
  startBackgroundCloudSync,
  syncDualDatabases,
  syncUsersFromCloudToLocal,
} from "./db.js";
import { isDualDatabaseMode } from "./database/config.js";

dotenv.config();

const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? "127.0.0.1";
const SERVE_STATIC = process.env.SERVE_STATIC === "1";
const distPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../dist");
const canServeStatic = SERVE_STATIC && fs.existsSync(path.join(distPath, "index.html"));

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

function requireDatabase(_req: Request, res: Response, next: NextFunction) {
  if (!isDatabaseReady()) {
    res.status(503).json({ error: `${getConnectingMessage()} Intenta en unos segundos.` });
    return;
  }
  next();
}

app.get("/api/health", async (_req, res) => {
  if (!isDatabaseReady()) {
    res.status(503).json({ ok: false, error: getConnectingMessage() });
    return;
  }

  try {
    const now = await pingDatabase();
    const cloud = getCloudBackend();
    let cloudTime: string | null = null;

    if (cloud) {
      try {
        cloudTime = await cloud.ping();
      } catch {
        cloudTime = null;
      }
    }

    res.json({
      ok: true,
      mode: getDatabaseModeLabel(),
      database: getDatabaseLabel(),
      time: now,
      cloud: cloud
        ? {
            label: cloud.label,
            ok: isCloudDatabaseReady() && cloudTime != null,
            time: cloudTime,
          }
        : null,
    });
  } catch (error) {
    res.status(503).json({
      ok: false,
      error: error instanceof Error ? error.message : "Error de base de datos.",
    });
  }
});

app.post("/api/sync/users", requireAuth, requireAdmin, requireDatabase, async (_req, res) => {
  if (!isDualDatabaseMode()) {
    res.status(400).json({ error: "Solo aplica en modo dual." });
    return;
  }

  try {
    const count = await syncUsersFromCloudToLocal(true);
    res.json({
      ok: true,
      users: count,
      message: count > 0
        ? `${count} usuario(s) sincronizados desde Supabase.`
        : "No hay usuarios en Supabase para copiar.",
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Error al sincronizar usuarios.",
    });
  }
});

app.post("/api/sync/run", requireAuth, requireDatabase, async (_req, res) => {
  if (!isDualDatabaseMode()) {
    res.json({ ok: true, cloudSynced: true, merged: false, state: await loadAppState() });
    return;
  }

  try {
    const result = await syncDualDatabases();
    const state = result.state ?? await loadAppState();
    res.json({ ok: true, ...result, state });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Error al sincronizar.",
    });
  }
});

app.post("/api/sync/from-cloud", requireAuth, requireAdmin, requireDatabase, async (req, res) => {
  if (!isDualDatabaseMode()) {
    res.status(400).json({ error: "La importacion desde la nube solo aplica en modo dual." });
    return;
  }

  if (!isCloudDatabaseReady()) {
    res.status(503).json({ error: "Supabase no esta conectado. Verifica internet y DATABASE_URL." });
    return;
  }

  const force = req.body?.force === true || req.query.force === "1";

  try {
    const result = await importCloudStateToLocal(force);
    if (!result.imported) {
      res.status(409).json(result);
      return;
    }
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Error al importar desde Supabase.",
    });
  }
});

app.post("/api/sync/cloud", requireAuth, requireDatabase, async (_req, res) => {
  if (!isDualDatabaseMode()) {
    res.status(400).json({ error: "La sincronizacion manual solo aplica en modo dual." });
    return;
  }

  try {
    const result = await pushLocalStateToCloud();
    if (!result.cloudSynced) {
      res.status(503).json({
        ok: false,
        cloudSynced: false,
        error: result.cloudError ?? "No se pudo sincronizar con Supabase.",
      });
      return;
    }
    res.json({ ok: true, cloudSynced: true });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Error al sincronizar con la nube.",
    });
  }
});

app.post("/api/auth/login", requireDatabase, async (req, res) => {
  const username = typeof req.body?.username === "string" ? req.body.username : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  if (!username || !password) {
    res.status(400).json({ error: "Usuario y contrasena son obligatorios." });
    return;
  }

  try {
    const result = await loginUser(username, password);
    if (!result) {
      res.status(401).json({ error: "Credenciales invalidas." });
      return;
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Error al iniciar sesion." });
  }
});

app.get("/api/auth/me", requireAuth, requireDatabase, (req: AuthenticatedRequest, res) => {
  res.json({ user: req.auth });
});

app.get("/api/users", requireAuth, requireAdmin, requireDatabase, async (_req, res) => {
  try {
    const users = await listUsers();
    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Error al listar usuarios." });
  }
});

app.post("/api/users", requireAuth, requireAdmin, requireDatabase, async (req, res) => {
  const username = typeof req.body?.username === "string" ? req.body.username : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const displayName = typeof req.body?.displayName === "string" ? req.body.displayName : "";
  const role = req.body?.role === "caja" ? "caja" : "admin";

  if (!username || !password || !displayName) {
    res.status(400).json({ error: "Completa usuario, nombre y contrasena." });
    return;
  }

  try {
    const result = await createUser({ username, password, displayName, role });
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(201).json({ user: result.user });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Error al crear usuario." });
  }
});

app.patch("/api/users/:id/password", requireAuth, requireAdmin, requireDatabase, async (req, res) => {
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  try {
    const result = await updateUserPassword(req.params.id, password);
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Error al actualizar contrasena." });
  }
});

app.patch("/api/users/:id", requireAuth, requireAdmin, requireDatabase, async (req: AuthenticatedRequest, res) => {
  const displayName = typeof req.body?.displayName === "string" ? req.body.displayName : "";
  const role = req.body?.role === "caja" ? "caja" : "admin";
  const active = req.body?.active !== false;

  if (!active && req.auth?.userId === req.params.id) {
    res.status(400).json({ error: "No puedes desactivar tu propia cuenta." });
    return;
  }

  try {
    const result = await updateUserDetails(req.params.id, { displayName, role, active });
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ user: result.user });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Error al actualizar usuario." });
  }
});

app.get("/api/app-state", requireAuth, requireDatabase, async (_req, res) => {
  try {
    const state = await loadAppState();
    res.json(state);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Error al cargar datos." });
  }
});

app.put("/api/app-state", requireAuth, requireDatabase, async (req, res) => {
  const payload = req.body as AppStatePayload;
  if (!payload || !Array.isArray(payload.products) || !Array.isArray(payload.transactions)) {
    res.status(400).json({ error: "Estado de aplicacion invalido." });
    return;
  }

  try {
    const saveResult = await saveAppState({
      products: payload.products,
      transactions: payload.transactions ?? [],
      appointments: payload.appointments ?? [],
      stockMovements: payload.stockMovements ?? [],
      currentCashSession: payload.currentCashSession ?? null,
      cashSessionHistory: payload.cashSessionHistory ?? [],
      wholesaleClients: payload.wholesaleClients ?? [],
    });
    console.log(`[save] ${payload.products.length} producto(s) guardado(s) en ${getDatabaseLabel()}`);
    res.json({
      ok: true,
      mode: getDatabaseModeLabel(),
      cloudSynced: saveResult.cloudSynced,
      cloudError: saveResult.cloudError,
      merged: saveResult.merged,
      addedFromCloud: saveResult.addedFromCloud,
      state: saveResult.state,
    });
  } catch (error) {
    console.error("[save] error:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Error al guardar datos." });
  }
});

app.post("/api/app-state/migrate", requireAuth, requireDatabase, async (req, res) => {
  const payload = req.body as AppStatePayload;

  try {
    const current = await loadAppState();

    if (!shouldMigrateLocalState(current, payload)) {
      res.json({ migrated: false, state: current });
      return;
    }

    if (!payload || !Array.isArray(payload.products)) {
      res.status(400).json({ error: "No hay datos para migrar." });
      return;
    }

    await saveAppState({
      products: payload.products,
      transactions: payload.transactions ?? [],
      appointments: payload.appointments ?? [],
      stockMovements: payload.stockMovements ?? [],
      currentCashSession: payload.currentCashSession ?? null,
      cashSessionHistory: payload.cashSessionHistory ?? [],
      wholesaleClients: payload.wholesaleClients ?? current.wholesaleClients ?? [],
    });

    const state = await loadAppState();
    res.json({ migrated: true, state });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Error al migrar datos." });
  }
});

function attachStaticFrontend() {
  if (!canServeStatic) return;

  console.log(`Sirviendo app desde ${distPath}`);

  app.use(express.static(distPath));

  app.use((req, res, next) => {
    if (req.path.startsWith("/api")) {
      next();
      return;
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      next();
      return;
    }
    res.sendFile(path.join(distPath, "index.html"), (error) => {
      if (error) next(error);
    });
  });
}

attachStaticFrontend();

const DB_RETRY_MS = 10_000;
let connecting = false;

async function connectDatabase() {
  if (connecting) return;
  connecting = true;

  console.log(getConnectingMessage());
  try {
    const now = await initDatabase();
    console.log(`Base de datos local: ${getDatabaseLabel()}`);
    console.log(`Modo: ${getDatabaseModeLabel()}`);
    console.log(`Conexion verificada: ${now}`);
    if (isDualDatabaseMode()) {
      const cloud = getCloudBackend();
      console.log(cloud?.ready
        ? `[cloud] ${cloud.label} lista para sincronizar.`
        : "[cloud] Supabase pendiente; la tienda sigue con SQL Server local.");
      startBackgroundCloudSync();
      console.log("[sync] Sincronizacion bidireccional en segundo plano activa (cada 12s).");
    }
  } catch (error) {
    await resetDatabase();
    const message = error instanceof Error ? error.message : String(error);
    console.error("No se pudo conectar a la base de datos:", message);
    console.log(`Reintentando conexion en ${DB_RETRY_MS / 1000}s...`);
    setTimeout(connectDatabase, DB_RETRY_MS);
  } finally {
    connecting = false;
  }
}

function startServer() {
  setDatabaseReconnectHandler(() => {
    console.log("[db] Reconectando servicios de base de datos...");
    setTimeout(async () => {
      await reconnectCloudDatabase();
      if (!isDatabaseReady()) {
        await connectDatabase();
      }
    }, 2000);
  });

  app.listen(PORT, HOST, () => {
    if (canServeStatic) {
      const label = HOST === "0.0.0.0" ? "localhost" : HOST;
      console.log(`Lexy Essence disponible en http://${label}:${PORT}`);
    } else {
      console.log(`Lexy API escuchando en http://${HOST}:${PORT}`);
      console.log("Modo desarrollo: usa npm run dev para frontend + API.");
    }
    void connectDatabase();
  });
}

startServer();
