import type { CashSession } from "../types/cashSession";
import type { Transaction } from "../types/domain";
import { computeCloseSummary, isCompletedSale } from "./cashSession";

export type SalesSummary = {
  totalSales: number;
  cashSales: number;
  transferSales: number;
  cardSales: number;
  otherSales: number;
  pendingSales: number;
  saleCount: number;
};

export function toLocalDateKey(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatReportDate(value: string) {
  return new Intl.DateTimeFormat("es-DO", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatReportDateShort(value: string) {
  return new Intl.DateTimeFormat("es-DO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function getYesterdayDateKey(reference = new Date()) {
  const date = new Date(reference);
  date.setDate(date.getDate() - 1);
  return toLocalDateKey(date);
}

export function summarizeTransactions(transactions: Transaction[]): SalesSummary {
  const completed = transactions.filter(isCompletedSale);
  const pending = transactions.filter((transaction) => transaction.estado === "Pendiente");

  return {
    totalSales: completed.reduce((acc, transaction) => acc + transaction.monto, 0),
    cashSales: completed
      .filter((transaction) => transaction.metodo === "Efectivo")
      .reduce((acc, transaction) => acc + transaction.monto, 0),
    transferSales: completed
      .filter((transaction) => transaction.metodo === "Transferencia")
      .reduce((acc, transaction) => acc + transaction.monto, 0),
    cardSales: completed
      .filter((transaction) => transaction.metodo === "Tarjeta")
      .reduce((acc, transaction) => acc + transaction.monto, 0),
    otherSales: completed
      .filter((transaction) => !["Efectivo", "Transferencia", "Tarjeta"].includes(transaction.metodo))
      .reduce((acc, transaction) => acc + transaction.monto, 0),
    pendingSales: pending.reduce((acc, transaction) => acc + transaction.monto, 0),
    saleCount: completed.length,
  };
}

export function getTransactionsForDate(transactions: Transaction[], dateKey: string) {
  return transactions.filter((transaction) => {
    if (!transaction.soldAt) return false;
    return toLocalDateKey(transaction.soldAt) === dateKey;
  });
}

export function getTransactionsForMonth(transactions: Transaction[], monthKey: string) {
  return transactions.filter((transaction) => {
    if (!transaction.soldAt) return false;
    return toLocalDateKey(transaction.soldAt).startsWith(monthKey);
  });
}

export function getCashSessionsForDate(sessions: CashSession[], dateKey: string) {
  return sessions
    .filter((session) => session.closedAt && toLocalDateKey(session.closedAt) === dateKey)
    .sort((a, b) => new Date(b.closedAt!).getTime() - new Date(a.closedAt!).getTime());
}

export function getCashSessionsForMonth(sessions: CashSession[], monthKey: string) {
  return sessions
    .filter((session) => session.closedAt && toLocalDateKey(session.closedAt).startsWith(monthKey))
    .sort((a, b) => new Date(b.closedAt!).getTime() - new Date(a.closedAt!).getTime());
}

export function getTodayCashInDrawer(
  transactions: Transaction[],
  currentCashSession: CashSession | null,
  cashSessionHistory: CashSession[],
  todayKey: string,
) {
  if (currentCashSession && toLocalDateKey(currentCashSession.openedAt) === todayKey) {
    const summary = computeCloseSummary(
      transactions,
      currentCashSession.openingAmount,
      currentCashSession.openedAt,
      new Date().toISOString(),
    );
    return summary.totalCashInDrawer;
  }

  const todayCloses = getCashSessionsForDate(cashSessionHistory, todayKey);
  if (todayCloses[0]?.closeSummary) {
    return todayCloses[0].closeSummary.totalCashInDrawer;
  }

  return summarizeTransactions(getTransactionsForDate(transactions, todayKey)).cashSales;
}

export function getDailyBreakdownForMonth(transactions: Transaction[], monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const breakdown: { dateKey: string; summary: SalesSummary }[] = [];

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateKey = `${monthKey}-${String(day).padStart(2, "0")}`;
    const dayTransactions = getTransactionsForDate(transactions, dateKey);
    const summary = summarizeTransactions(dayTransactions);
    if (summary.saleCount > 0 || summary.pendingSales > 0) {
      breakdown.push({ dateKey, summary });
    }
  }

  return breakdown.reverse();
}
