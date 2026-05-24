import type { Appointment } from "../types/domain";
import type { CashSession } from "../types/cashSession";
import type { StockMovement, Transaction } from "../types/domain";
import { isCompletedSale } from "./cashSession";
import {
  getCashSessionsForDate,
  getTransactionsForDate,
  summarizeTransactions,
  toLocalDateKey,
  type SalesSummary,
} from "./reportMetrics";
import {
  getTransactionDiscountLabel,
  getTransactionTotalDiscount,
  getWholesaleClientLabel,
  isWholesaleTransaction,
} from "./transactionSaleDetails";

export type WholesaleDaySummary = {
  saleCount: number;
  totalSales: number;
  totalWholesaleDiscount: number;
  totalManualDiscount: number;
  byClient: {
    key: string;
    salon: string;
    cedula?: string;
    saleCount: number;
    totalSales: number;
    totalDiscount: number;
  }[];
};

export type DailyReportData = {
  dateKey: string;
  dateLabel: string;
  salesSummary: SalesSummary;
  wholesaleSummary: WholesaleDaySummary;
  totalDiscountGiven: number;
  transactions: Transaction[];
  cashSessions: CashSession[];
  appointments: Appointment[];
  stockMovements: StockMovement[];
  currentCashSession: CashSession | null;
};

function formatDateLabel(dateKey: string) {
  return new Intl.DateTimeFormat("es-DO", { dateStyle: "full" }).format(new Date(`${dateKey}T12:00:00`));
}

export function getAppointmentsForDate(appointments: Appointment[], dateKey: string) {
  return appointments
    .filter((appointment) => appointment.date === dateKey)
    .sort((a, b) => a.hora.localeCompare(b.hora));
}

export function getStockMovementsForDate(movements: StockMovement[], dateKey: string) {
  return movements.filter((movement) => toLocalDateKey(movement.fecha) === dateKey);
}

export function summarizeWholesaleForDay(transactions: Transaction[]): WholesaleDaySummary {
  const wholesaleSales = transactions.filter(isWholesaleTransaction).filter(isCompletedSale);
  const byClientMap = new Map<string, WholesaleDaySummary["byClient"][number]>();

  wholesaleSales.forEach((transaction) => {
    const salon = getWholesaleClientLabel(transaction) ?? transaction.cliente;
    const cedula = transaction.wholesaleCedula;
    const key = transaction.wholesaleClientId ?? `${cedula ?? "sin-cedula"}-${salon}`;
    const entry = byClientMap.get(key) ?? {
      key,
      salon,
      cedula,
      saleCount: 0,
      totalSales: 0,
      totalDiscount: 0,
    };

    entry.saleCount += 1;
    entry.totalSales += transaction.monto;
    entry.totalDiscount += getTransactionTotalDiscount(transaction);
    byClientMap.set(key, entry);
  });

  return {
    saleCount: wholesaleSales.length,
    totalSales: wholesaleSales.reduce((acc, transaction) => acc + transaction.monto, 0),
    totalWholesaleDiscount: wholesaleSales.reduce(
      (acc, transaction) => acc + (transaction.wholesaleDiscountAmount ?? 0),
      0,
    ),
    totalManualDiscount: wholesaleSales.reduce(
      (acc, transaction) => acc + (transaction.discountAmount ?? 0),
      0,
    ),
    byClient: [...byClientMap.values()].sort((a, b) => b.totalSales - a.totalSales),
  };
}

export function buildDailyReportData(input: {
  dateKey: string;
  transactions: Transaction[];
  cashSessionHistory: CashSession[];
  currentCashSession: CashSession | null;
  appointments: Appointment[];
  stockMovements: StockMovement[];
}): DailyReportData {
  const {
    dateKey,
    transactions,
    cashSessionHistory,
    currentCashSession,
    appointments,
    stockMovements,
  } = input;

  const dayTransactions = getTransactionsForDate(transactions, dateKey)
    .sort((a, b) => {
      const aTime = a.soldAt ? new Date(a.soldAt).getTime() : 0;
      const bTime = b.soldAt ? new Date(b.soldAt).getTime() : 0;
      return bTime - aTime;
    });

  const salesSummary = summarizeTransactions(dayTransactions);
  const wholesaleSummary = summarizeWholesaleForDay(dayTransactions);
  const completed = dayTransactions.filter(isCompletedSale);

  const totalDiscountGiven = completed.reduce(
    (acc, transaction) => acc + getTransactionTotalDiscount(transaction),
    0,
  );

  const cashSessions = getCashSessionsForDate(cashSessionHistory, dateKey);
  const openSessionToday = currentCashSession && toLocalDateKey(currentCashSession.openedAt) === dateKey
    ? currentCashSession
    : null;

  return {
    dateKey,
    dateLabel: formatDateLabel(dateKey),
    salesSummary,
    wholesaleSummary,
    totalDiscountGiven,
    transactions: dayTransactions,
    cashSessions,
    appointments: getAppointmentsForDate(appointments, dateKey),
    stockMovements: getStockMovementsForDate(stockMovements, dateKey),
    currentCashSession: openSessionToday,
  };
}

export function getSaleTypeLabel(transaction: Transaction) {
  if (isWholesaleTransaction(transaction)) {
    return transaction.wholesaleDiscountPercent
      ? `Mayorista ${transaction.wholesaleDiscountPercent}%`
      : "Mayorista";
  }
  if (transaction.cliente.toLowerCase().includes("envio")) return "Envio";
  return "Detalle";
}

export { getTransactionDiscountLabel, getWholesaleClientLabel };
