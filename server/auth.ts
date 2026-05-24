import bcrypt from "bcryptjs";
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { AuthUser, UserRole } from "../src/config/auth.js";
import { getPool } from "./db.js";

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
    active: row.active === true || row.active === 1,
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

export async function loginUser(username: string, password: string) {
  const result = await getPool().query(`
    SELECT * FROM users
    WHERE username = $1 AND active = TRUE
  `, [username.trim()]);

  const row = result.rows[0] as Record<string, unknown> | undefined;
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

export async function listUsers() {
  const result = await getPool().query("SELECT * FROM users ORDER BY display_name");
  return result.rows.map((row) => rowToAuthUser(row as Record<string, unknown>));
}

export async function createUser(input: {
  username: string;
  password: string;
  displayName: string;
  role: UserRole;
}) {
  const username = input.username.trim();
  const displayName = input.displayName.trim();
  const password = input.password.trim();

  const exists = await getPool().query("SELECT id FROM users WHERE username = $1", [username]);
  if (exists.rowCount && exists.rowCount > 0) {
    return { ok: false as const, error: "Ese nombre de usuario ya existe." };
  }

  const id = `user-${Date.now()}`;
  await getPool().query(`
    INSERT INTO users (id, username, password, password_hash, display_name, role, active)
    VALUES ($1, $2, $3, $4, $5, $6, TRUE)
  `, [
    id,
    username,
    password,
    bcrypt.hashSync(password, 10),
    displayName,
    input.role,
  ]);

  const created = await getPool().query("SELECT * FROM users WHERE id = $1", [id]);
  return {
    ok: true as const,
    user: rowToAuthUser(created.rows[0] as Record<string, unknown>),
  };
}

export async function updateUserPassword(userId: string, password: string) {
  const nextPassword = password.trim();
  if (!nextPassword) {
    return { ok: false as const, error: "La contrasena no puede estar vacia." };
  }

  const result = await getPool().query(`
    UPDATE users SET password = $1, password_hash = $2 WHERE id = $3
  `, [nextPassword, bcrypt.hashSync(nextPassword, 10), userId]);

  if (!result.rowCount) {
    return { ok: false as const, error: "Usuario no encontrado." };
  }

  return { ok: true as const };
}

export async function updateUserDetails(
  userId: string,
  input: { displayName: string; role: UserRole; active: boolean },
) {
  const displayName = input.displayName.trim();
  if (!displayName) {
    return { ok: false as const, error: "El nombre es obligatorio." };
  }

  const targetResult = await getPool().query("SELECT * FROM users WHERE id = $1", [userId]);
  const target = targetResult.rows[0] as Record<string, unknown> | undefined;
  if (!target) {
    return { ok: false as const, error: "Usuario no encontrado." };
  }

  if (!input.active && target.role === "admin") {
    const adminCount = await getPool().query(`
      SELECT COUNT(*)::int AS count FROM users WHERE role = 'admin' AND active = TRUE
    `);
    if ((adminCount.rows[0]?.count as number) <= 1) {
      return { ok: false as const, error: "Debe quedar al menos un administrador activo." };
    }
  }

  await getPool().query(`
    UPDATE users SET display_name = $1, role = $2, active = $3 WHERE id = $4
  `, [displayName, input.role, input.active, userId]);

  const updated = await getPool().query("SELECT * FROM users WHERE id = $1", [userId]);
  return {
    ok: true as const,
    user: rowToAuthUser(updated.rows[0] as Record<string, unknown>),
  };
}
