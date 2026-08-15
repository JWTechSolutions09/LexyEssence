import bcrypt from "bcryptjs";
import sql from "mssql";
import { seedProducts, seedUsers } from "../seed.js";
import { getMssqlConfig } from "./config.js";
import { buildMssqlConnectionConfig, createMssqlPool, formatMssqlConnectionLog } from "./mssqlConnect.js";
import type { DatabaseBackend, QueryResult } from "./backend.js";

function toPgStyleParams(text: string, params: unknown[], prefix: string) {
  const normalized = text.replace(/\$(\d+)/g, (_, number) => `@${prefix}p${number}`);
  return { text: normalized, params };
}

function bindParams(request: sql.Request, params: unknown[], prefix: string) {
  params.forEach((value, index) => {
    const name = `${prefix}p${index + 1}`;
    if (value === null || value === undefined) {
      request.input(name, sql.NVarChar, null);
      return;
    }
    if (typeof value === "boolean") {
      request.input(name, sql.Bit, value);
      return;
    }
    if (typeof value === "number") {
      if (Number.isInteger(value)) {
        request.input(name, sql.Int, value);
      } else {
        request.input(name, sql.Decimal(12, 2), value);
      }
      return;
    }
    if (value instanceof Date) {
      request.input(name, sql.DateTime2, value);
      return;
    }
    request.input(name, sql.NVarChar(sql.MAX), String(value));
  });
}

export class MssqlBackend implements DatabaseBackend {
  readonly label: string;
  ready = false;
  private pool?: sql.ConnectionPool;
  private transaction?: sql.Transaction;
  private request?: sql.Request;
  private querySeq = 0;

  constructor() {
    const { server, database } = getMssqlConfig();
    this.label = `SQL Server (${database} @ ${server})`;
  }

  async init() {
    if (this.pool?.connected) {
      return this.ping();
    }

    await this.reset();
    const connectionConfig = buildMssqlConnectionConfig();
    console.log(`[local] Conectando SQL Server: ${formatMssqlConnectionLog(connectionConfig)}`);
    const pool = await createMssqlPool();
    await pool.connect();
    await this.ensureSchema(pool);
    this.pool = pool;
    this.ready = true;
    const result = await this.query("SELECT SYSDATETIME() AS now");
    return String(result.rows[0]?.now ?? "");
  }

  async ping() {
    const result = await this.query("SELECT SYSDATETIME() AS now");
    return String(result.rows[0]?.now ?? "");
  }

  async reset() {
    this.ready = false;
    if (this.transaction) {
      await this.transaction.rollback().catch(() => undefined);
      this.transaction = undefined;
      this.request = undefined;
    }
    if (this.pool) {
      await this.pool.close().catch(() => undefined);
      this.pool = undefined;
    }
  }

  async query(text: string, params: unknown[] = []): Promise<QueryResult> {
    const executor = this.request
      ?? (this.transaction ? new sql.Request(this.transaction) : undefined)
      ?? (this.pool ? this.pool.request() : undefined);

    if (!executor) {
      throw new Error("SQL Server no esta conectado.");
    }

    const prefix = `q${++this.querySeq}_`;
    const { text: normalized, params: bound } = toPgStyleParams(text, params, prefix);
    bindParams(executor, bound, prefix);
    const result = await executor.query(normalized);
    const recordset = (result.recordset ?? []) as Record<string, unknown>[];
    return {
      rows: recordset,
      rowCount: result.rowsAffected?.[0] ?? recordset.length,
    };
  }

  async withTransaction<T>(fn: (tx: DatabaseBackend) => Promise<T>): Promise<T> {
    if (!this.pool) {
      throw new Error("SQL Server no esta conectado.");
    }

    const transaction = new sql.Transaction(this.pool);
    await transaction.begin();

    let txQuerySeq = 0;
    const tx: DatabaseBackend = {
      label: this.label,
      ready: true,
      init: async () => "",
      ping: async () => "",
      reset: async () => undefined,
      query: async (text, params = []) => {
        const prefix = `q${++txQuerySeq}_`;
        const request = new sql.Request(transaction);
        const { text: normalized, params: bound } = toPgStyleParams(text, params, prefix);
        bindParams(request, bound, prefix);
        const result = await request.query(normalized);
        const recordset = (result.recordset ?? []) as Record<string, unknown>[];
        return {
          rows: recordset,
          rowCount: result.rowsAffected?.[0] ?? recordset.length,
        };
      },
      withTransaction: (inner) => inner(tx),
    };

    try {
      const value = await fn(tx);
      await transaction.commit();
      return value;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  private async ensureSchema(pool: sql.ConnectionPool) {
    const request = pool.request();

    await request.query(`
      IF OBJECT_ID('dbo.wholesale_clients', 'U') IS NULL
      CREATE TABLE dbo.wholesale_clients (
        id NVARCHAR(64) NOT NULL PRIMARY KEY,
        cedula NVARCHAR(32) NOT NULL UNIQUE,
        salon NVARCHAR(200) NOT NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
      );

      IF OBJECT_ID('dbo.users', 'U') IS NULL
      CREATE TABLE dbo.users (
        id NVARCHAR(64) NOT NULL PRIMARY KEY,
        username NVARCHAR(80) NOT NULL UNIQUE,
        password NVARCHAR(200) NOT NULL,
        password_hash NVARCHAR(200) NOT NULL,
        display_name NVARCHAR(120) NOT NULL,
        role NVARCHAR(20) NOT NULL,
        active BIT NOT NULL DEFAULT 1
      );

      IF OBJECT_ID('dbo.products', 'U') IS NULL
      CREATE TABLE dbo.products (
        id NVARCHAR(64) NOT NULL PRIMARY KEY,
        nombre NVARCHAR(200) NOT NULL,
        marca NVARCHAR(120) NOT NULL,
        descripcion NVARCHAR(MAX) NOT NULL DEFAULT '',
        categoria NVARCHAR(80) NOT NULL,
        costo DECIMAL(12,2) NOT NULL DEFAULT 0,
        precio DECIMAL(12,2) NOT NULL DEFAULT 0,
        precio_mayorista DECIMAL(12,2) NOT NULL DEFAULT 0,
        stock INT NOT NULL DEFAULT 0,
        stock_minimo INT NOT NULL DEFAULT 0,
        es_ampolla BIT NOT NULL DEFAULT 0,
        unidades_por_caja INT NOT NULL DEFAULT 1,
        costo_caja DECIMAL(12,2) NULL,
        costo_unidad DECIMAL(12,2) NULL,
        precio_caja DECIMAL(12,2) NULL,
        precio_unidad DECIMAL(12,2) NULL,
        codigo_barra_caja NVARCHAR(64) NULL
      );
      IF COL_LENGTH('dbo.products', 'costo_caja') IS NULL
        ALTER TABLE dbo.products ADD costo_caja DECIMAL(12,2) NULL;
      IF COL_LENGTH('dbo.products', 'costo_unidad') IS NULL
        ALTER TABLE dbo.products ADD costo_unidad DECIMAL(12,2) NULL;
      UPDATE dbo.products
      SET
        costo_unidad = COALESCE(costo_unidad, costo),
        costo_caja = COALESCE(costo_caja, ROUND(costo * CASE WHEN unidades_por_caja > 0 THEN unidades_por_caja ELSE 1 END, 2))
      WHERE es_ampolla = 1;

      IF OBJECT_ID('dbo.transactions', 'U') IS NULL
      CREATE TABLE dbo.transactions (
        id NVARCHAR(64) NOT NULL PRIMARY KEY,
        cliente NVARCHAR(200) NOT NULL,
        monto DECIMAL(12,2) NOT NULL,
        metodo NVARCHAR(40) NOT NULL,
        estado NVARCHAR(40) NOT NULL,
        sold_at DATETIME2 NULL,
        items_json NVARCHAR(MAX) NULL,
        sale_details_json NVARCHAR(MAX) NULL
      );

      IF OBJECT_ID('dbo.appointments', 'U') IS NULL
      CREATE TABLE dbo.appointments (
        id NVARCHAR(64) NOT NULL PRIMARY KEY,
        date NVARCHAR(20) NOT NULL,
        hora NVARCHAR(20) NOT NULL,
        cliente NVARCHAR(200) NOT NULL,
        servicios_json NVARCHAR(MAX) NOT NULL,
        total DECIMAL(12,2) NOT NULL
      );

      IF OBJECT_ID('dbo.stock_movements', 'U') IS NULL
      CREATE TABLE dbo.stock_movements (
        id NVARCHAR(64) NOT NULL PRIMARY KEY,
        tipo NVARCHAR(40) NOT NULL,
        product_id NVARCHAR(64) NOT NULL,
        nombre NVARCHAR(200) NOT NULL,
        cantidad INT NOT NULL,
        motivo NVARCHAR(300) NOT NULL,
        fecha DATETIME2 NOT NULL,
        referencia NVARCHAR(120) NULL
      );

      IF OBJECT_ID('dbo.cash_sessions', 'U') IS NULL
      CREATE TABLE dbo.cash_sessions (
        id NVARCHAR(64) NOT NULL PRIMARY KEY,
        opened_at DATETIME2 NOT NULL,
        closed_at DATETIME2 NULL,
        opening_amount DECIMAL(12,2) NOT NULL,
        close_summary_json NVARCHAR(MAX) NULL,
        is_current BIT NOT NULL DEFAULT 0
      );
    `);

    const userCountResult = await pool.request().query("SELECT COUNT(*) AS count FROM dbo.users");
    const userCount = Number((userCountResult.recordset[0] as { count?: number })?.count ?? 0);
    if (userCount === 0) {
      for (const user of seedUsers) {
        await pool.request()
          .input("id", sql.NVarChar, user.id)
          .input("username", sql.NVarChar, user.username)
          .input("password", sql.NVarChar, user.password)
          .input("password_hash", sql.NVarChar, bcrypt.hashSync(user.password, 10))
          .input("display_name", sql.NVarChar, user.displayName)
          .input("role", sql.NVarChar, user.role)
          .query(`
            IF NOT EXISTS (SELECT 1 FROM dbo.users WHERE id = @id)
            INSERT INTO dbo.users (id, username, password, password_hash, display_name, role, active)
            VALUES (@id, @username, @password, @password_hash, @display_name, @role, 1)
          `);
      }
      console.log(`[mssql] Usuarios iniciales insertados: ${seedUsers.length}`);
    }

    const count = await pool.request().query("SELECT COUNT(*) AS count FROM dbo.products");
    const productCount = Number((count.recordset[0] as { count?: number })?.count ?? 0);
    if (productCount > 0) return;

    for (const product of seedProducts) {
      await pool.request()
        .input("id", sql.NVarChar, product.id)
        .input("nombre", sql.NVarChar, product.nombre)
        .input("marca", sql.NVarChar, product.marca)
        .input("descripcion", sql.NVarChar, product.descripcion)
        .input("categoria", sql.NVarChar, product.categoria)
        .input("costo", sql.Decimal(12, 2), product.costo)
        .input("precio", sql.Decimal(12, 2), product.precio)
        .input("precio_mayorista", sql.Decimal(12, 2), product.precioMayorista)
        .input("stock", sql.Int, product.stock)
        .input("stock_minimo", sql.Int, product.stockMinimo)
        .query(`
          IF NOT EXISTS (SELECT 1 FROM dbo.products WHERE id = @id)
          INSERT INTO dbo.products (
            id, nombre, marca, descripcion, categoria, costo, precio, precio_mayorista, stock, stock_minimo
          ) VALUES (
            @id, @nombre, @marca, @descripcion, @categoria, @costo, @precio, @precio_mayorista, @stock, @stock_minimo
          )
        `);
    }

    console.log(`[mssql] Productos iniciales insertados: ${seedProducts.length}`);
  }
}
