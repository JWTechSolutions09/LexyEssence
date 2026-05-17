import type { CashSession } from "../types/cashSession";
import type { Appointment, Product, StockMovement, Transaction } from "../types/domain";
import type { AppStatePayload } from "./client";

const productsStorageKey = "lexy-react-products";
const transactionsStorageKey = "lexy-react-transactions";
const appointmentsStorageKey = "lexy-react-appointments";
const stockMovementsStorageKey = "lexy-react-stock-movements";
const cashSessionStorageKey = "lexy-react-cash-session";
const cashHistoryStorageKey = "lexy-react-cash-history";

function readJson<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return fallback;
    return JSON.parse(stored) as T;
  } catch {
    return fallback;
  }
}

export function readLocalAppState(): AppStatePayload | null {
  const products = readJson<Product[]>(productsStorageKey, []);
  const transactions = readJson<Transaction[]>(transactionsStorageKey, []);
  const appointments = readJson<Appointment[]>(appointmentsStorageKey, []);
  const stockMovements = readJson<StockMovement[]>(stockMovementsStorageKey, []);
  const currentCashSession = readJson<CashSession | null>(cashSessionStorageKey, null);
  const cashSessionHistory = readJson<CashSession[]>(cashHistoryStorageKey, []);

  const hasData = products.length > 0
    || transactions.length > 0
    || appointments.length > 0
    || stockMovements.length > 0
    || Boolean(currentCashSession)
    || cashSessionHistory.length > 0;

  if (!hasData) return null;

  return {
    products,
    transactions,
    appointments,
    stockMovements,
    currentCashSession,
    cashSessionHistory,
  };
}

export function clearLocalAppState() {
  [
    productsStorageKey,
    transactionsStorageKey,
    appointmentsStorageKey,
    stockMovementsStorageKey,
    cashSessionStorageKey,
    cashHistoryStorageKey,
  ].forEach((key) => localStorage.removeItem(key));
}
