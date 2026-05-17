import cors from "cors";
import express from "express";
import { hasUserAppData, loadAppState, saveAppState, type AppStatePayload } from "./appState.js";
import {
  countActiveAdmins,
  createUser,
  listUsers,
  loginUser,
  requireAdmin,
  requireAuth,
  updateUserDetails,
  updateUserPassword,
  type AuthenticatedRequest,
} from "./auth.js";
import { db, initDatabase } from "./db.js";

const PORT = Number(process.env.PORT ?? 3001);

initDatabase();

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, database: db.name });
});

app.post("/api/auth/login", (req, res) => {
  const username = typeof req.body?.username === "string" ? req.body.username : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  if (!username || !password) {
    res.status(400).json({ error: "Usuario y contrasena son obligatorios." });
    return;
  }

  const result = loginUser(username, password);
  if (!result) {
    res.status(401).json({ error: "Credenciales invalidas." });
    return;
  }

  res.json(result);
});

app.get("/api/auth/me", requireAuth, (req: AuthenticatedRequest, res) => {
  res.json({ user: req.auth });
});

app.get("/api/users", requireAuth, requireAdmin, (_req, res) => {
  res.json({ users: listUsers() });
});

app.post("/api/users", requireAuth, requireAdmin, (req, res) => {
  const username = typeof req.body?.username === "string" ? req.body.username : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const displayName = typeof req.body?.displayName === "string" ? req.body.displayName : "";
  const role = req.body?.role === "caja" ? "caja" : "admin";

  if (!username || !password || !displayName) {
    res.status(400).json({ error: "Completa usuario, nombre y contrasena." });
    return;
  }

  const result = createUser({ username, password, displayName, role });
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }

  res.status(201).json({ user: result.user });
});

app.patch("/api/users/:id/password", requireAuth, requireAdmin, (req, res) => {
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const result = updateUserPassword(req.params.id, password);
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json({ ok: true });
});

app.patch("/api/users/:id", requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => {
  const displayName = typeof req.body?.displayName === "string" ? req.body.displayName : "";
  const role = req.body?.role === "caja" ? "caja" : "admin";
  const active = req.body?.active !== false;

  if (!active && req.auth?.userId === req.params.id) {
    res.status(400).json({ error: "No puedes desactivar tu propia cuenta." });
    return;
  }

  const result = updateUserDetails(req.params.id, { displayName, role, active });
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }

  res.json({ user: result.user });
});

app.get("/api/app-state", requireAuth, (_req, res) => {
  res.json(loadAppState());
});

app.put("/api/app-state", requireAuth, (req, res) => {
  const payload = req.body as AppStatePayload;
  if (!payload || !Array.isArray(payload.products) || !Array.isArray(payload.transactions)) {
    res.status(400).json({ error: "Estado de aplicacion invalido." });
    return;
  }

  saveAppState({
    products: payload.products,
    transactions: payload.transactions ?? [],
    appointments: payload.appointments ?? [],
    stockMovements: payload.stockMovements ?? [],
    currentCashSession: payload.currentCashSession ?? null,
    cashSessionHistory: payload.cashSessionHistory ?? [],
  });

  res.json({ ok: true });
});

app.post("/api/app-state/migrate", requireAuth, (req, res) => {
  const payload = req.body as AppStatePayload;
  const current = loadAppState();

  if (hasUserAppData(current)) {
    res.json({ migrated: false, state: current });
    return;
  }

  if (!payload || !Array.isArray(payload.products)) {
    res.status(400).json({ error: "No hay datos para migrar." });
    return;
  }

  saveAppState({
    products: payload.products,
    transactions: payload.transactions ?? [],
    appointments: payload.appointments ?? [],
    stockMovements: payload.stockMovements ?? [],
    currentCashSession: payload.currentCashSession ?? null,
    cashSessionHistory: payload.cashSessionHistory ?? [],
  });

  res.json({ migrated: true, state: loadAppState() });
});

app.listen(PORT, () => {
  console.log(`Lexy API escuchando en http://localhost:${PORT}`);
  console.log(`Base de datos: ${db.name}`);
});
