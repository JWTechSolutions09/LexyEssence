import type { CashCloseSummary } from "../types/cashSession";
import type { Transaction } from "../types/domain";

export function isCompletedSale(transaction: Transaction) {
  return transaction.estado === "Completada";
}

export function getSessionSales(
  transactions: Transaction[],
  openedAt: string,
  closedAt: string,
) {
  const openedMs = new Date(openedAt).getTime();
  const closedMs = new Date(closedAt).getTime();

  return transactions.filter((transaction) => {
    if (!isCompletedSale(transaction) || !transaction.soldAt) return false;
    const soldMs = new Date(transaction.soldAt).getTime();
    return soldMs >= openedMs && soldMs <= closedMs;
  });
}

export function computeCloseSummary(
  transactions: Transaction[],
  openingAmount: number,
  openedAt: string,
  closedAt: string,
): CashCloseSummary {
  const sales = getSessionSales(transactions, openedAt, closedAt);
  const totalSales = sales.reduce((acc, sale) => acc + sale.monto, 0);
  const cashSalesAmount = sales
    .filter((sale) => sale.metodo === "Efectivo")
    .reduce((acc, sale) => acc + sale.monto, 0);
  const totalTransferSales = sales
    .filter((sale) => sale.metodo === "Transferencia")
    .reduce((acc, sale) => acc + sale.monto, 0);

  return {
    totalSales,
    openingAmount,
    cashSalesAmount,
    totalCashInDrawer: openingAmount + cashSalesAmount,
    totalTransferSales,
  };
}
