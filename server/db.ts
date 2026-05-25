import dns from "node:dns";
import dotenv from "dotenv";
import pg from "pg";
import { seedProducts } from "./seed.js";

dotenv.config();
dns.setDefaultResultOrder("ipv4first");

const rawConnectionString = process.env.DATABASE_URL;

if (!rawConnectionString) {
  throw new Error("DATABASE_URL no esta configurada. Revisa tu archivo .env");
}

const CONNECTION_TIMEOUT_MS = 10_000;

export let pool: pg.Pool | undefined;

let reconnectHandler: (() => void) | null = null;
let reconnectPending = false;

export function setDatabaseReconnectHandler(handler: () => void) {
  reconnectHandler = handler;
}

export function isDatabaseReady() {
  return pool !== undefined;
}

export function getPool() {
  if (!pool) {
    throw new Error("Conectando con Supabase...");
  }
  return pool;
}

function getHostname() {
  try {
    const url = new URL(rawConnectionString.replace("postgresql://", "http://"));
    return url.hostname;
  } catch {
    return "Supabase";
  }
}

function schedulePoolReconnect() {
  if (reconnectPending || !reconnectHandler) return;
  reconnectPending = true;
  reconnectHandler();
}

async function closePool() {
  if (!pool) return;
  const current = pool;
  pool = undefined;
  await current.end().catch(() => undefined);
}

function attachPoolErrorHandler(activePool: pg.Pool) {
  activePool.on("error", (error) => {
    console.error("[db] Conexion perdida:", error.message);
    void closePool().finally(() => {
      reconnectPending = false;
      schedulePoolReconnect();
    });
  });
}

async function ensureSchema(activePool: pg.Pool) {
  await activePool.query(`
    CREATE TABLE IF NOT EXISTS wholesale_clients (
      id TEXT PRIMARY KEY,
      cedula TEXT NOT NULL UNIQUE,
      salon TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await activePool.query(`
    ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS sale_details_json JSONB
  `);

  await activePool.query(`
    ALTER TABLE products
    ADD COLUMN IF NOT EXISTS es_ampolla BOOLEAN DEFAULT FALSE
  `);
  await activePool.query(`
    ALTER TABLE products
    ADD COLUMN IF NOT EXISTS unidades_por_caja INTEGER DEFAULT 1
  `);
  await activePool.query(`
    ALTER TABLE products
    ADD COLUMN IF NOT EXISTS precio_caja NUMERIC(10,2)
  `);
  await activePool.query(`
    ALTER TABLE products
    ADD COLUMN IF NOT EXISTS precio_unidad NUMERIC(10,2)
  `);
  await activePool.query(`
    ALTER TABLE products
    ADD COLUMN IF NOT EXISTS codigo_barra_caja TEXT
  `);

  const count = await activePool.query("SELECT COUNT(*)::int AS count FROM products");
  if ((count.rows[0]?.count as number) > 0) return;

  for (const product of seedProducts) {
    await activePool.query(`
      INSERT INTO products (
        id, nombre, marca, descripcion, categoria, costo, precio, precio_mayorista, stock, stock_minimo
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id) DO NOTHING
    `, [
      product.id,
      product.nombre,
      product.marca,
      product.descripcion,
      product.categoria,
      product.costo,
      product.precio,
      product.precioMayorista,
      product.stock,
      product.stockMinimo,
    ]);
  }

  console.log(`Productos iniciales insertados: ${seedProducts.length}`);
}

export async function initDatabase() {
  if (pool) {
    return pingDatabase();
  }

  const probe = new pg.Client({
    connectionString: rawConnectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
  });

  try {
    await probe.connect();
    const result = await probe.query("SELECT NOW() AS now");
    await probe.end();

    const activePool = new pg.Pool({
      connectionString: rawConnectionString,
      ssl: { rejectUnauthorized: false },
      max: 10,
      connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
      idleTimeoutMillis: 30_000,
    });

    attachPoolErrorHandler(activePool);
    await ensureSchema(activePool);

    pool = activePool;
    reconnectPending = false;
    console.log(`Conexion Supabase via ${getHostname()}`);
    return result.rows[0]?.now as string;
  } catch (error) {
    await probe.end().catch(() => undefined);
    await closePool();
    throw error;
  }
}

export async function resetDatabase() {
  await closePool();
  reconnectPending = false;
}

export async function pingDatabase() {
  const activePool = getPool();
  const result = await activePool.query("SELECT NOW() AS now");
  return result.rows[0]?.now as string;
}

export function getDatabaseLabel() {
  return `Supabase (${getHostname()})`;
}
