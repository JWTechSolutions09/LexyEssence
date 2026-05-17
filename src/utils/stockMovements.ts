import type { StockMovement, Transaction } from "../types/domain";

export const stockMovementsStorageKey = "lexy-react-stock-movements";

export function createStockMovement(input: Omit<StockMovement, "id">): StockMovement {
  return {
    id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ...input,
  };
}

export function normalizeStockMovement(raw: Partial<StockMovement>, index: number): StockMovement | null {
  const tipo = raw.tipo === "entrada" || raw.tipo === "salida" ? raw.tipo : null;
  const productId = typeof raw.productId === "string" ? raw.productId : "";
  const nombre = typeof raw.nombre === "string" ? raw.nombre : "";
  const cantidad = typeof raw.cantidad === "number" ? raw.cantidad : 0;
  const motivo = typeof raw.motivo === "string" ? raw.motivo : "";
  const fecha = typeof raw.fecha === "string" ? raw.fecha : "";

  if (!tipo || !productId || !nombre || cantidad <= 0 || !motivo || !fecha) return null;

  return {
    id: typeof raw.id === "string" ? raw.id : `mov-legacy-${index}`,
    tipo,
    productId,
    nombre,
    cantidad,
    motivo,
    fecha,
    referencia: typeof raw.referencia === "string" ? raw.referencia : undefined,
  };
}

export function loadStoredStockMovements(): StockMovement[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = window.localStorage.getItem(stockMovementsStorageKey);
    if (!stored) return [];

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((movement, index) => normalizeStockMovement(movement as Partial<StockMovement>, index))
      .filter((movement): movement is StockMovement => Boolean(movement))
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  } catch {
    return [];
  }
}

export function movementsFromSale(
  transaction: Transaction,
  items: { productId: string; nombre: string; cantidad: number }[],
): StockMovement[] {
  const fecha = transaction.soldAt ?? new Date().toISOString();
  const motivo = transaction.estado === "Pendiente"
    ? "Venta POS (pendiente)"
    : "Venta POS";

  return items.map((item) => createStockMovement({
    tipo: "salida",
    productId: item.productId,
    nombre: item.nombre,
    cantidad: item.cantidad,
    motivo,
    fecha,
    referencia: transaction.id,
  }));
}

export function backfillMovementsFromTransactions(
  transactions: Transaction[],
  existing: StockMovement[],
): StockMovement[] {
  const refs = new Set(existing.map((movement) => movement.referencia).filter(Boolean));
  const created: StockMovement[] = [];

  transactions.forEach((transaction) => {
    if (!transaction.items?.length || !transaction.soldAt) return;
    if (refs.has(transaction.id)) return;

    created.push(...movementsFromSale(transaction, transaction.items));
    refs.add(transaction.id);
  });

  return created;
}

export function sortStockMovements(movements: StockMovement[]) {
  return [...movements].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
}
