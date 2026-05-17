import bcrypt from "bcryptjs";
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { AuthUser, UserRole } from "../src/config/auth.js";
import { db } from "./db.js";

const JWT_SECRET = process.env.LEXY_JWT_SECRET ?? "lexy-essence-dev-secret-change-in-production";
const TOKEN_TTL = "7d";

export type AuthTokenPayload = {
  userId: string;
  username: string;
  displayName: string;
  role: UserRole;
};

export type AuthenticatedRequest = Request & {
  auth?: AuthTokenPayload;
};

function rowToAuthUser(row: Record<string, unknown>): AuthUser {
  return {
    id: String(row.id),
    username: String(row.username),
    password: String(row.password),
    displayName: String(row.display_name),
    role: row.role === "caja" ? "caja" : "admin",
    active: Number(row.active) === 1,
  };
}

export function signToken(payload: AuthTokenPayload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

export function verifyToken(token: string) {
  return jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "No autorizado." });
    return;
  }

  try {
    req.auth = verifyToken(header.slice(7));
    next();
  } catch {
    res.status(401).json({ error: "Sesion invalida o expirada." });
  }
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (req.auth?.role !== "admin") {
    res.status(403).json({ error: "Acceso solo para administradores." });
    return;
  }
  next();
}

export function loginUser(username: string, password: string) {
  const row = db.prepare(`
    SELECT * FROM users
    WHERE username = ? AND active = 1
  `).get(username.trim()) as Record<string, unknown> | undefined;

  if (!row) return null;

  const valid = bcrypt.compareSync(password, String(row.password_hash));
  if (!valid) return null;

  return {
    token: signToken({
      userId: String(row.id),
      username: String(row.username),
      displayName: String(row.display_name),
      role: row.role === "caja" ? "caja" : "admin",
    }),
    user: {
      username: String(row.username),
      displayName: String(row.display_name),
      role: row.role === "caja" ? "caja" : "admin",
    },
  };
}

export function listUsers() {
  return (db.prepare("SELECT * FROM users ORDER BY display_name").all() as Record<string, unknown>[])
    .map(rowToAuthUser);
}

export function createUser(input: {
  username: string;
  password: string;
  displayName: string;
  role: UserRole;
}) {
  const username = input.username.trim();
  const displayName = input.displayName.trim();
  const password = input.password.trim();

  const exists = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
  if (exists) {
    return { ok: false as const, error: "Ese nombre de usuario ya existe." };
  }

  const id = `user-${Date.now()}`;
  db.prepare(`
    INSERT INTO users (id, username, password, password_hash, display_name, role, active)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `).run(
    id,
    username,
    password,
    bcrypt.hashSync(password, 10),
    displayName,
    input.role,
  );

  return { ok: true as const, user: rowToAuthUser(db.prepare("SELECT * FROM users WHERE id = ?").get(id) as Record<string, unknown>) };
}

export function updateUserPassword(userId: string, password: string) {
  const nextPassword = password.trim();
  if (!nextPassword) {
    return { ok: false as const, error: "La contrasena no puede estar vacia." };
  }

  const result = db.prepare(`
    UPDATE users SET password = ?, password_hash = ? WHERE id = ?
  `).run(nextPassword, bcrypt.hashSync(nextPassword, 10), userId);

  if (result.changes === 0) {
    return { ok: false as const, error: "Usuario no encontrado." };
  }

  return { ok: true as const };
}

export function updateUserDetails(
  userId: string,
  input: { displayName: string; role: UserRole; active: boolean },
) {
  const displayName = input.displayName.trim();
  if (!displayName) {
    return { ok: false as const, error: "El nombre es obligatorio." };
  }

  const target = db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as Record<string, unknown> | undefined;
  if (!target) {
    return { ok: false as const, error: "Usuario no encontrado." };
  }

  if (!input.active && target.role === "admin") {
    const adminCount = db.prepare(`
      SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND active = 1
    `).get() as { count: number };
    if (adminCount.count <= 1) {
      return { ok: false as const, error: "Debe quedar al menos un administrador activo." };
    }
  }

  db.prepare(`
    UPDATE users SET display_name = ?, role = ?, active = ? WHERE id = ?
  `).run(displayName, input.role, input.active ? 1 : 0, userId);

  return { ok: true as const, user: rowToAuthUser(db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as Record<string, unknown>) };
}

export function countActiveAdmins() {
  const row = db.prepare(`
    SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND active = 1
  `).get() as { count: number };
  return row.count;
}
