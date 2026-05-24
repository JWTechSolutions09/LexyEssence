import type { CashSession } from "../src/types/cashSession.js";
import type {
  Appointment,
  Product,
  StockMovement,
  Transaction,
  WholesaleClient,
} from "../src/types/domain.js";
import { getPool } from "./db.js";

function extractSaleDetails(transaction: Transaction) {
  return {
    pricingMode: transaction.pricingMode,
    subtotal: transaction.subtotal,
    listSubtotal: transaction.listSubtotal,
    discountAmount: transaction.discountAmount,
    wholesaleDiscountPercent: transaction.wholesaleDiscountPercent,
    wholesaleDiscountAmount: transaction.wholesaleDiscountAmount,
    wholesaleClientId: transaction.wholesaleClientId,
    wholesaleSalon: transaction.wholesaleSalon,
    wholesaleCedula: transaction.wholesaleCedula,
    note: transaction.note,
  };
}

export type AppStatePayload = {
  products: Product[];
  transactions: Transaction[];
  appointments: Appointment[];
  stockMovements: StockMovement[];
  currentCashSession: CashSession | null;
  cashSessionHistory: CashSession[];
  wholesaleClients: WholesaleClient[];
};

function parseJsonValue<T>(value: unknown): T | undefined {
  if (value == null) return undefined;
  if (typeof value === "string") return JSON.parse(value) as T;
  return value as T;
}

function toIsoTimestamp(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (value == null) return new Date().toISOString();

  const str = String(value).trim();
  if (!str) return new Date().toISOString();

  const parsed = new Date(str);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();

  return str;
}

function toIsoTimestampOrNull(value: unknown): string | null {
  if (value == null) return null;
  return toIsoTimestamp(value);
}

function rowToProduct(row: Record<string, unknown>): Product {
  return {
    id: String(row.id),
    nombre: String(row.nombre),
    marca: String(row.marca),
    descripcion: String(row.descripcion ?? ""),
    categoria: String(row.categoria),
    costo: Number(row.costo),
    precio: Number(row.precio),
    precioMayorista: Number(row.precio_mayorista),
    stock: Number(row.stock),
    stockMinimo: Number(row.stock_minimo),
  };
}

function rowToTransaction(row: Record<string, unknown>): Transaction {
  const details = parseJsonValue<ReturnType<typeof extractSaleDetails>>(row.sale_details_json) ?? {};

  return {
    id: String(row.id),
    cliente: String(row.cliente),
    monto: Number(row.monto),
    metodo: String(row.metodo),
    estado: String(row.estado),
    soldAt: row.sold_at ? toIsoTimestamp(row.sold_at) : undefined,
    items: parseJsonValue<Transaction["items"]>(row.items_json),
    ...details,
  };
}

function rowToAppointment(row: Record<string, unknown>): Appointment {
  return {
    id: String(row.id),
    date: String(row.date),
    hora: String(row.hora),
    cliente: String(row.cliente),
    servicios: parseJsonValue<string[]>(row.servicios_json) ?? [],
    total: Number(row.total),
  };
}

function rowToStockMovement(row: Record<string, unknown>): StockMovement {
  return {
    id: String(row.id),
    tipo: row.tipo as StockMovement["tipo"],
    productId: String(row.product_id),
    nombre: String(row.nombre),
    cantidad: Number(row.cantidad),
    motivo: String(row.motivo),
    fecha: toIsoTimestamp(row.fecha),
    referencia: row.referencia ? String(row.referencia) : undefined,
  };
}

function rowToCashSession(row: Record<string, unknown>): CashSession {
  return {
    id: String(row.id),
    openedAt: toIsoTimestamp(row.opened_at),
    closedAt: row.closed_at ? toIsoTimestamp(row.closed_at) : undefined,
    openingAmount: Number(row.opening_amount),
    closeSummary: parseJsonValue<CashSession["closeSummary"]>(row.close_summary_json),
  };
}

function rowToWholesaleClient(row: Record<string, unknown>): WholesaleClient {
  return {
    id: String(row.id),
    cedula: String(row.cedula),
    salon: String(row.salon),
  };
}

function isCurrentSession(row: Record<string, unknown>) {
  return row.is_current === true || row.is_current === 1;
}

async function loadWholesaleClients() {
  try {
    const result = await getPool().query("SELECT * FROM wholesale_clients ORDER BY salon");
    return result.rows.map((row) => rowToWholesaleClient(row as Record<string, unknown>));
  } catch {
    return [];
  }
}

export async function loadAppState(): Promise<AppStatePayload> {
  const wholesaleClients = await loadWholesaleClients();
  const db = getPool();
  const [productsResult, transactionsResult, appointmentsResult, movementsResult, cashResult] = await Promise.all([
    db.query("SELECT * FROM products ORDER BY nombre"),
    db.query("SELECT * FROM transactions ORDER BY sold_at DESC NULLS LAST"),
    db.query("SELECT * FROM appointments ORDER BY date, hora"),
    db.query("SELECT * FROM stock_movements ORDER BY fecha DESC"),
    db.query("SELECT * FROM cash_sessions ORDER BY opened_at DESC"),
  ]);

  const cashRows = cashResult.rows as Record<string, unknown>[];
  const currentRow = cashRows.find(isCurrentSession);

  return {
    products: productsResult.rows.map((row) => rowToProduct(row as Record<string, unknown>)),
    transactions: transactionsResult.rows.map((row) => rowToTransaction(row as Record<string, unknown>)),
    appointments: appointmentsResult.rows.map((row) => rowToAppointment(row as Record<string, unknown>)),
    stockMovements: movementsResult.rows.map((row) => rowToStockMovement(row as Record<string, unknown>)),
    currentCashSession: currentRow ? rowToCashSession(currentRow) : null,
    cashSessionHistory: cashRows
      .filter((row) => !isCurrentSession(row))
      .map(rowToCashSession),
    wholesaleClients,
  };
}

export async function saveAppState(payload: AppStatePayload) {
  const client = await getPool().connect();

  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM products");
    await client.query("DELETE FROM transactions");
    await client.query("DELETE FROM appointments");
    await client.query("DELETE FROM stock_movements");
    await client.query("DELETE FROM cash_sessions");
    await client.query("DELETE FROM wholesale_clients");

    for (const product of payload.products) {
      await client.query(`
        INSERT INTO products (
          id, nombre, marca, descripcion, categoria, costo, precio, precio_mayorista, stock, stock_minimo
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
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

    for (const transaction of payload.transactions) {
      const saleDetails = extractSaleDetails(transaction);
      await client.query(`
        INSERT INTO transactions (id, cliente, monto, metodo, estado, sold_at, items_json, sale_details_json)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        transaction.id,
        transaction.cliente,
        transaction.monto,
        transaction.metodo,
        transaction.estado,
        transaction.soldAt ? toIsoTimestamp(transaction.soldAt) : null,
        transaction.items ? JSON.stringify(transaction.items) : null,
        JSON.stringify(saleDetails),
      ]);
    }

    for (const appointment of payload.appointments) {
      await client.query(`
        INSERT INTO appointments (id, date, hora, cliente, servicios_json, total)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        appointment.id,
        appointment.date,
        appointment.hora,
        appointment.cliente,
        JSON.stringify(appointment.servicios),
        appointment.total,
      ]);
    }

    for (const movement of payload.stockMovements) {
      await client.query(`
        INSERT INTO stock_movements (id, tipo, product_id, nombre, cantidad, motivo, fecha, referencia)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        movement.id,
        movement.tipo,
        movement.productId,
        movement.nombre,
        movement.cantidad,
        movement.motivo,
        toIsoTimestamp(movement.fecha),
        movement.referencia ?? null,
      ]);
    }

    if (payload.currentCashSession) {
      await client.query(`
        INSERT INTO cash_sessions (id, opened_at, closed_at, opening_amount, close_summary_json, is_current)
        VALUES ($1, $2, NULL, $3, NULL, TRUE)
      `, [
        payload.currentCashSession.id,
        toIsoTimestamp(payload.currentCashSession.openedAt),
        payload.currentCashSession.openingAmount,
      ]);
    }

    for (const session of payload.cashSessionHistory) {
      await client.query(`
        INSERT INTO cash_sessions (id, opened_at, closed_at, opening_amount, close_summary_json, is_current)
        VALUES ($1, $2, $3, $4, $5, FALSE)
      `, [
        session.id,
        toIsoTimestamp(session.openedAt),
        toIsoTimestampOrNull(session.closedAt),
        session.openingAmount,
        session.closeSummary ? JSON.stringify(session.closeSummary) : null,
      ]);
    }

    for (const wholesaleClient of payload.wholesaleClients ?? []) {
      await client.query(`
        INSERT INTO wholesale_clients (id, cedula, salon)
        VALUES ($1, $2, $3)
      `, [
        wholesaleClient.id,
        wholesaleClient.cedula,
        wholesaleClient.salon,
      ]);
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export function hasUserAppData(state: AppStatePayload) {
  return state.transactions.length > 0
    || state.appointments.length > 0
    || state.stockMovements.length > 0
    || Boolean(state.currentCashSession)
    || state.cashSessionHistory.length > 0;
}

export function shouldMigrateLocalState(current: AppStatePayload, incoming: AppStatePayload) {
  if (hasUserAppData(current)) return false;
  if (hasUserAppData(incoming)) return true;
  return incoming.products.length > current.products.length;
}
