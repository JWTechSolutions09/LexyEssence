import type { Product, Transaction } from "../types/domain";
import { isCompletedSale } from "./cashSession";

export type ProductSalesStat = {
  productId: string;
  nombre: string;
  unitsSold: number;
  stock: number;
  stockMinimo: number;
};

export type LowStockProduct = {
  product: Product;
  stock: number;
  stockMinimo: number;
};

export type InventorySummary = {
  totalValue: number;
  totalCost: number;
  totalProfit: number;
  totalUnits: number;
  productCount: number;
};

export function computeInventorySummary(products: Product[]): InventorySummary {
  return products.reduce<InventorySummary>((acc, product) => {
    const units = Math.max(0, product.stock);
    return {
      totalValue: acc.totalValue + units * product.precio,
      totalCost: acc.totalCost + units * product.costo,
      totalProfit: acc.totalProfit + units * (product.precio - product.costo),
      totalUnits: acc.totalUnits + units,
      productCount: acc.productCount + 1,
    };
  }, {
    totalValue: 0,
    totalCost: 0,
    totalProfit: 0,
    totalUnits: 0,
    productCount: 0,
  });
}

export function aggregateProductSales(transactions: Transaction[]) {
  const totals = new Map<string, ProductSalesStat>();

  transactions.filter(isCompletedSale).forEach((transaction) => {
    transaction.items?.forEach((item) => {
      const existing = totals.get(item.productId);
      if (existing) {
        existing.unitsSold += item.cantidad;
        return;
      }
      totals.set(item.productId, {
        productId: item.productId,
        nombre: item.nombre,
        unitsSold: item.cantidad,
        stock: 0,
        stockMinimo: 0,
      });
    });
  });

  return totals;
}

export function getTopSellingProducts(
  products: Product[],
  transactions: Transaction[],
  limit = 5,
): ProductSalesStat[] {
  const sales = aggregateProductSales(transactions);

  products.forEach((product) => {
    const stat = sales.get(product.id);
    if (stat) {
      stat.stock = product.stock;
      stat.stockMinimo = product.stockMinimo;
      stat.nombre = product.nombre;
      return;
    }
    sales.set(product.id, {
      productId: product.id,
      nombre: product.nombre,
      unitsSold: 0,
      stock: product.stock,
      stockMinimo: product.stockMinimo,
    });
  });

  return [...sales.values()]
    .filter((stat) => stat.unitsSold > 0)
    .sort((a, b) => b.unitsSold - a.unitsSold)
    .slice(0, limit);
}

export function getLeastSellingProducts(
  products: Product[],
  transactions: Transaction[],
  limit = 5,
): ProductSalesStat[] {
  const sales = aggregateProductSales(transactions);

  products.forEach((product) => {
    if (!sales.has(product.id)) {
      sales.set(product.id, {
        productId: product.id,
        nombre: product.nombre,
        unitsSold: 0,
        stock: product.stock,
        stockMinimo: product.stockMinimo,
      });
    }
  });

  return [...sales.values()]
    .sort((a, b) => a.unitsSold - b.unitsSold)
    .slice(0, limit);
}

export function getLowStockProducts(products: Product[], limit = 10): LowStockProduct[] {
  return products
    .filter((product) => product.stock > 0 && product.stock <= product.stockMinimo)
    .sort((a, b) => a.stock - b.stock)
    .slice(0, limit)
    .map((product) => ({
      product,
      stock: product.stock,
      stockMinimo: product.stockMinimo,
    }));
}
