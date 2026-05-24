import type { Transaction, WholesaleDiscountPercent } from "../types/domain";

export type TransactionSaleDetails = {
  pricingMode?: Transaction["pricingMode"];
  subtotal?: number;
  listSubtotal?: number;
  discountAmount?: number;
  wholesaleDiscountPercent?: WholesaleDiscountPercent;
  wholesaleDiscountAmount?: number;
  wholesaleClientId?: string;
  wholesaleSalon?: string;
  wholesaleCedula?: string;
  note?: string;
};

export function extractSaleDetails(transaction: Transaction): TransactionSaleDetails {
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

export function applySaleDetails(
  transaction: Omit<Transaction, keyof TransactionSaleDetails>,
  details: Partial<TransactionSaleDetails>,
): Transaction {
  return { ...transaction, ...details };
}

export function isWholesaleTransaction(transaction: Transaction) {
  return transaction.pricingMode === "mayorista"
    || Boolean(transaction.wholesaleDiscountPercent)
    || Boolean(transaction.wholesaleSalon);
}

export function getTransactionTotalDiscount(transaction: Transaction) {
  const manual = transaction.discountAmount ?? 0;
  const wholesale = transaction.wholesaleDiscountAmount ?? 0;
  return manual + wholesale;
}

export function getTransactionDiscountLabel(transaction: Transaction) {
  const parts: string[] = [];
  if (transaction.wholesaleDiscountPercent) {
    parts.push(`Mayorista ${transaction.wholesaleDiscountPercent}% (${formatDiscountAmount(transaction.wholesaleDiscountAmount)})`);
  }
  if (transaction.discountAmount && transaction.discountAmount > 0) {
    parts.push(`Manual ${formatDiscountAmount(transaction.discountAmount)}`);
  }
  return parts.length > 0 ? parts.join(" · ") : "Sin descuento";
}

function formatDiscountAmount(value?: number) {
  if (!value || value <= 0) return "RD$0.00";
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
  }).format(value);
}

export function getWholesaleClientLabel(transaction: Transaction) {
  if (transaction.wholesaleSalon) {
    return transaction.wholesaleSalon;
  }
  if (isWholesaleTransaction(transaction)) {
    return transaction.cliente;
  }
  return null;
}
