import type { CashSession } from "../src/types/cashSession.js";
import type {
  Appointment,
  Product,
  StockMovement,
  Transaction,
} from "../src/types/domain.js";
import { db } from "./db.js";

export type AppStatePayload = {
  products: Product[];
  transactions: Transaction[];
  appointments: Appointment[];
  stockMovements: StockMovement[];
  currentCashSession: CashSession | null;
  cashSessionHistory: CashSession[];
};

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
  const itemsJson = row.items_json;
  return {
    id: String(row.id),
    cliente: String(row.cliente),
    monto: Number(row.monto),
    metodo: String(row.metodo),
    estado: String(row.estado),
    soldAt: row.sold_at ? String(row.sold_at) : undefined,
    items: itemsJson ? JSON.parse(String(itemsJson)) : undefined,
  };
}

function rowToAppointment(row: Record<string, unknown>): Appointment {
  return {
    id: String(row.id),
    date: String(row.date),
    hora: String(row.hora),
    cliente: String(row.cliente),
    servicios: JSON.parse(String(row.servicios_json)),
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
    fecha: String(row.fecha),
    referencia: row.referencia ? String(row.referencia) : undefined,
  };
}

function rowToCashSession(row: Record<string, unknown>): CashSession {
  return {
    id: String(row.id),
    openedAt: String(row.opened_at),
    closedAt: row.closed_at ? String(row.closed_at) : undefined,
    openingAmount: Number(row.opening_amount),
    closeSummary: row.close_summary_json
      ? JSON.parse(String(row.close_summary_json))
      : undefined,
  };
}

export function loadAppState(): AppStatePayload {
  const products = (db.prepare("SELECT * FROM products ORDER BY nombre").all() as Record<string, unknown>[])
    .map(rowToProduct);

  const transactions = (db.prepare("SELECT * FROM transactions ORDER BY sold_at DESC").all() as Record<string, unknown>[])
    .map(rowToTransaction);

  const appointments = (db.prepare("SELECT * FROM appointments ORDER BY date, hora").all() as Record<string, unknown>[])
    .map(rowToAppointment);

  const stockMovements = (db.prepare("SELECT * FROM stock_movements ORDER BY fecha DESC").all() as Record<string, unknown>[])
    .map(rowToStockMovement);

  const cashRows = db.prepare("SELECT * FROM cash_sessions ORDER BY opened_at DESC").all() as Record<string, unknown>[];
  const currentRow = cashRows.find((row) => Number(row.is_current) === 1);
  const currentCashSession = currentRow ? rowToCashSession(currentRow) : null;
  const cashSessionHistory = cashRows
    .filter((row) => Number(row.is_current) !== 1)
    .map(rowToCashSession);

  return {
    products,
    transactions,
    appointments,
    stockMovements,
    currentCashSession,
    cashSessionHistory,
  };
}

export function saveAppState(payload: AppStatePayload) {
  const write = db.transaction(() => {
    db.prepare("DELETE FROM products").run();
    db.prepare("DELETE FROM transactions").run();
    db.prepare("DELETE FROM appointments").run();
    db.prepare("DELETE FROM stock_movements").run();
    db.prepare("DELETE FROM cash_sessions").run();

    const insertProduct = db.prepare(`
      INSERT INTO products (
        id, nombre, marca, descripcion, categoria, costo, precio, precio_mayorista, stock, stock_minimo
      ) VALUES (
        @id, @nombre, @marca, @descripcion, @categoria, @costo, @precio, @precio_mayorista, @stock, @stock_minimo
      )
    `);

    for (const product of payload.products) {
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

    const insertTransaction = db.prepare(`
      INSERT INTO transactions (id, cliente, monto, metodo, estado, sold_at, items_json)
      VALUES (@id, @cliente, @monto, @metodo, @estado, @sold_at, @items_json)
    `);

    for (const transaction of payload.transactions) {
      insertTransaction.run({
        id: transaction.id,
        cliente: transaction.cliente,
        monto: transaction.monto,
        metodo: transaction.metodo,
        estado: transaction.estado,
        sold_at: transaction.soldAt ?? null,
        items_json: transaction.items ? JSON.stringify(transaction.items) : null,
      });
    }

    const insertAppointment = db.prepare(`
      INSERT INTO appointments (id, date, hora, cliente, servicios_json, total)
      VALUES (@id, @date, @hora, @cliente, @servicios_json, @total)
    `);

    for (const appointment of payload.appointments) {
      insertAppointment.run({
        id: appointment.id,
        date: appointment.date,
        hora: appointment.hora,
        cliente: appointment.cliente,
        servicios_json: JSON.stringify(appointment.servicios),
        total: appointment.total,
      });
    }

    const insertMovement = db.prepare(`
      INSERT INTO stock_movements (id, tipo, product_id, nombre, cantidad, motivo, fecha, referencia)
      VALUES (@id, @tipo, @product_id, @nombre, @cantidad, @motivo, @fecha, @referencia)
    `);

    for (const movement of payload.stockMovements) {
      insertMovement.run({
        id: movement.id,
        tipo: movement.tipo,
        product_id: movement.productId,
        nombre: movement.nombre,
        cantidad: movement.cantidad,
        motivo: movement.motivo,
        fecha: movement.fecha,
        referencia: movement.referencia ?? null,
      });
    }

    const insertCashSession = db.prepare(`
      INSERT INTO cash_sessions (id, opened_at, closed_at, opening_amount, close_summary_json, is_current)
      VALUES (@id, @opened_at, @closed_at, @opening_amount, @close_summary_json, @is_current)
    `);

    if (payload.currentCashSession) {
      insertCashSession.run({
        id: payload.currentCashSession.id,
        opened_at: payload.currentCashSession.openedAt,
        closed_at: null,
        opening_amount: payload.currentCashSession.openingAmount,
        close_summary_json: null,
        is_current: 1,
      });
    }

    for (const session of payload.cashSessionHistory) {
      insertCashSession.run({
        id: session.id,
        opened_at: session.openedAt,
        closed_at: session.closedAt ?? null,
        opening_amount: session.openingAmount,
        close_summary_json: session.closeSummary ? JSON.stringify(session.closeSummary) : null,
        is_current: 0,
      });
    }
  });

  write();
}

export function hasUserAppData(state: AppStatePayload) {
  return state.transactions.length > 0
    || state.appointments.length > 0
    || state.stockMovements.length > 0
    || Boolean(state.currentCashSession)
    || state.cashSessionHistory.length > 0;
}
