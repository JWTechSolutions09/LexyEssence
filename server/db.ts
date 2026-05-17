import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { seedProducts, seedUsers } from "./seed.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");
const dbPath = path.join(dataDir, "lexy.db");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'caja')),
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      nombre TEXT NOT NULL,
      marca TEXT NOT NULL,
      descripcion TEXT NOT NULL DEFAULT '',
      categoria TEXT NOT NULL,
      costo REAL NOT NULL DEFAULT 0,
      precio REAL NOT NULL DEFAULT 0,
      precio_mayorista REAL NOT NULL DEFAULT 0,
      stock INTEGER NOT NULL DEFAULT 0,
      stock_minimo INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      cliente TEXT NOT NULL,
      monto REAL NOT NULL,
      metodo TEXT NOT NULL,
      estado TEXT NOT NULL,
      sold_at TEXT,
      items_json TEXT
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      hora TEXT NOT NULL,
      cliente TEXT NOT NULL,
      servicios_json TEXT NOT NULL,
      total REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS stock_movements (
      id TEXT PRIMARY KEY,
      tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'salida')),
      product_id TEXT NOT NULL,
      nombre TEXT NOT NULL,
      cantidad INTEGER NOT NULL,
      motivo TEXT NOT NULL,
      fecha TEXT NOT NULL,
      referencia TEXT
    );

    CREATE TABLE IF NOT EXISTS cash_sessions (
      id TEXT PRIMARY KEY,
      opened_at TEXT NOT NULL,
      closed_at TEXT,
      opening_amount REAL NOT NULL,
      close_summary_json TEXT,
      is_current INTEGER NOT NULL DEFAULT 0
    );
  `);

  const userCount = db.prepare("SELECT COUNT(*) AS count FROM users").get() as { count: number };
  if (userCount.count === 0) {
    const insertUser = db.prepare(`
      INSERT INTO users (id, username, password, password_hash, display_name, role, active)
      VALUES (@id, @username, @password, @password_hash, @display_name, @role, @active)
    `);

    for (const user of seedUsers) {
      insertUser.run({
        id: user.id,
        username: user.username,
        password: user.password,
        password_hash: bcrypt.hashSync(user.password, 10),
        display_name: user.displayName,
        role: user.role,
        active: user.active ? 1 : 0,
      });
    }
  }

  const productCount = db.prepare("SELECT COUNT(*) AS count FROM products").get() as { count: number };
  if (productCount.count === 0) {
    const insertProduct = db.prepare(`
      INSERT INTO products (
        id, nombre, marca, descripcion, categoria, costo, precio, precio_mayorista, stock, stock_minimo
      ) VALUES (
        @id, @nombre, @marca, @descripcion, @categoria, @costo, @precio, @precio_mayorista, @stock, @stock_minimo
      )
    `);

    for (const product of seedProducts) {
      insertProduct.run({
        id: product.id,
        nombre: product.nombre,
        marca: product.marca,
        descripcion: product.descripcion,
        categoria: product.categoria,
        costo: product.costo,
        precio: product.precio,
        precio_mayorista: product.precioMayorista,
        stock: product.stock,
        stock_minimo: product.stockMinimo,
      });
    }
  }
}
