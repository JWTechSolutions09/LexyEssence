import type { Transaction, WholesaleClient } from "../types/domain";
import { isCompletedSale } from "./cashSession";
import { normalizeCedula } from "./wholesaleClient";
import { getTransactionTotalDiscount, isWholesaleTransaction } from "./transactionSaleDetails";

export function transactionBelongsToWholesaleClient(
  transaction: Transaction,
  client: WholesaleClient,
) {
  if (transaction.wholesaleClientId === client.id) return true;
  if (!transaction.wholesaleCedula) return false;
  return normalizeCedula(transaction.wholesaleCedula) === normalizeCedula(client.cedula);
}

export function getWholesaleClientTransactions(
  transactions: Transaction[],
  client: WholesaleClient,
) {
  return transactions
    .filter((transaction) => transactionBelongsToWholesaleClient(transaction, client))
    .sort((a, b) => {
      const aTime = a.soldAt ? new Date(a.soldAt).getTime() : 0;
      const bTime = b.soldAt ? new Date(b.soldAt).getTime() : 0;
      return bTime - aTime;
    });
}

export function summarizeWholesaleClientHistory(transactions: Transaction[], client: WholesaleClient) {
  const clientTransactions = getWholesaleClientTransactions(transactions, client);
  const completed = clientTransactions.filter(isCompletedSale);

  return {
    totalSales: completed.reduce((acc, transaction) => acc + transaction.monto, 0),
    saleCount: completed.length,
    totalDiscount: completed.reduce(
      (acc, transaction) => acc + getTransactionTotalDiscount(transaction),
      0,
    ),
    lastSaleAt: completed[0]?.soldAt,
    hasWholesaleSales: completed.some(isWholesaleTransaction),
  };
}
