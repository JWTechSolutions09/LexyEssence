import dns from "node:dns";
import pg from "pg";
import { seedProducts } from "../seed.js";
import type { DatabaseBackend, QueryResult } from "./backend.js";

dns.setDefaultResultOrder("ipv4first");

const CONNECTION_TIMEOUT_MS = 10_000;

export class PostgresBackend implements DatabaseBackend {
  readonly label: string;
  ready = false;
  private pool?: pg.Pool;
  private client?: pg.PoolClient;
  private readonly connectionString: string;

  constructor(connectionString: string) {
    this.connectionString = connectionString;
    try {
      const url = new URL(connectionString.replace("postgresql://", "http://"));
      this.label = `Supabase (${url.hostname})`;
    } catch {
      this.label = "Supabase";
    }
  }

  async init() {
    if (this.pool) {
      return this.ping();
    }

    const probe = new pg.Client({
      connectionString: this.connectionString,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
    });

    try {
      await probe.connect();
      const result = await probe.query("SELECT NOW() AS now");
      await probe.end();

      const activePool = new pg.Pool({
        connectionString: this.connectionString,
        ssl: { rejectUnauthorized: false },
        max: 10,
        connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
        idleTimeoutMillis: 30_000,
      });

      activePool.on("error", (error) => {
        console.error("[postgres] Conexion perdida:", error.message);
        this.ready = false;
        void this.reset();
      });

      await this.ensureSchema(activePool);
      this.pool = activePool;
      this.ready = true;
      return String(result.rows[0]?.now ?? "");
    } catch (error) {
      await probe.end().catch(() => undefined);
      await this.reset();
      throw error;
    }
  }

  async ping() {
    const result = await this.query("SELECT NOW() AS now");
    return String(result.rows[0]?.now ?? "");
  }

  async reset() {
    this.ready = false;
    if (this.client) {
      await this.client.release().catch(() => undefined);
      this.client = undefined;
    }
    if (this.pool) {
      const current = this.pool;
      this.pool = undefined;
      await current.end().catch(() => undefined);
    }
  }

  async query(text: string, params: unknown[] = []): Promise<QueryResult> {
    const executor = this.client ?? this.pool;
    if (!executor) {
      throw new Error("PostgreSQL no esta conectado.");
    }

    const result = await executor.query(text, params);
    return {
      rows: result.rows as Record<string, unknown>[],
      rowCount: result.rowCount ?? 0,
    };
  }

  async withTransaction<T>(fn: (tx: DatabaseBackend) => Promise<T>): Promise<T> {
    if (!this.pool) {
      throw new Error("PostgreSQL no esta conectado.");
    }

    const client = await this.pool.connect();
    const tx: DatabaseBackend = {
      label: this.label,
      ready: true,
      init: async () => "",
      ping: async () => "",
      reset: async () => undefined,
      query: (text, params = []) => client.query(text, params).then((result) => ({
        rows: result.rows as Record<string, unknown>[],
        rowCount: result.rowCount ?? 0,
      })),
      withTransaction: (inner) => inner(tx),
    };

    try {
      await client.query("BEGIN");
      const value = await fn(tx);
      await client.query("COMMIT");
      return value;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async ensureSchema(activePool: pg.Pool) {
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

    await activePool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS es_ampolla BOOLEAN DEFAULT FALSE`);
    await activePool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS unidades_por_caja INTEGER DEFAULT 1`);
    await activePool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS costo_caja NUMERIC(10,2)`);
    await activePool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS costo_unidad NUMERIC(10,2)`);
    await activePool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS precio_caja NUMERIC(10,2)`);
    await activePool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS precio_unidad NUMERIC(10,2)`);
    await activePool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS codigo_barra_caja TEXT`);
    await activePool.query(`
      UPDATE products
      SET
        costo_unidad = COALESCE(costo_unidad, costo),
        costo_caja = COALESCE(costo_caja, ROUND((costo * GREATEST(unidades_por_caja, 1))::numeric, 2))
      WHERE es_ampolla = TRUE
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

    console.log(`[postgres] Productos iniciales insertados: ${seedProducts.length}`);
  }
}
