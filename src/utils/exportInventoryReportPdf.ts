import type { Product, StockMovement, Transaction } from "../types/domain";
import {
  computeInventorySummary,
  getLeastSellingProducts,
  getLowStockProducts,
  getTopSellingProducts,
  type ProductSalesStat,
} from "./inventoryMetrics";
import { currency } from "./format";
import { PdfBuilder } from "./pdfBuilder";
import { formatReportDateShort } from "./reportMetrics";
import { sortStockMovements } from "./stockMovements";

export type InventoryReportPdfInput = {
  products: Product[];
  transactions: Transaction[];
  stockMovements: StockMovement[];
};

function salesStatRows(items: ProductSalesStat[]) {
  return items.map((item, index) => [
    String(index + 1),
    item.productId,
    item.nombre,
    String(item.unitsSold),
    String(item.stock),
  ]);
}

export function exportInventoryReportPdf({
  products,
  transactions,
  stockMovements,
}: InventoryReportPdfInput) {
  const pdf = new PdfBuilder();
  const summary = computeInventorySummary(products);
  const topSelling = getTopSellingProducts(products, transactions, 20);
  const leastSelling = getLeastSellingProducts(products, transactions, 20);
  const lowStock = getLowStockProducts(products, 50);

  const sortedProducts = [...products].sort((a, b) => (
    (b.stock * b.precio) - (a.stock * a.precio)
  ));

  const sortedMovements = sortStockMovements(stockMovements);
  const entradas = sortedMovements.filter((movement) => movement.tipo === "entrada");
  const salidas = sortedMovements.filter((movement) => movement.tipo === "salida");

  pdf.addReportHeader("Reporte de Inventario", "Valoracion, ventas y movimientos de stock");

  pdf.addSection("Resumen general");
  pdf.addKeyValues([
    { label: "Valor inventario", value: currency(summary.totalValue) },
    { label: "Costo inventario", value: currency(summary.totalCost) },
    { label: "Ganancia potencial", value: currency(summary.totalProfit) },
    { label: "Unidades en stock", value: String(summary.totalUnits) },
    { label: "Productos", value: String(summary.productCount) },
    { label: "Entradas registradas", value: String(entradas.length) },
    { label: "Salidas registradas", value: String(salidas.length) },
  ]);

  if (topSelling.length > 0) {
    pdf.addSection("Productos mas vendidos");
    pdf.addTable(
      ["#", "Codigo", "Producto", "Vendidos", "Stock actual"],
      salesStatRows(topSelling),
      [10, 28, 62, 22, 24],
    );
  }

  if (leastSelling.length > 0) {
    pdf.addSection("Productos menos vendidos");
    pdf.addTable(
      ["#", "Codigo", "Producto", "Vendidos", "Stock actual"],
      salesStatRows(leastSelling),
      [10, 28, 62, 22, 24],
    );
  }

  if (lowStock.length > 0) {
    pdf.addSection("Productos por agotarse");
    pdf.addTable(
      ["Codigo", "Producto", "Stock", "Minimo"],
      lowStock.map((entry) => [
        entry.product.id,
        entry.product.nombre,
        String(entry.stock),
        String(entry.stockMinimo),
      ]),
      [28, 72, 22, 22],
    );
  }

  pdf.addSection("Detalle por producto");
  pdf.addTable(
    ["Codigo", "Producto", "Stock", "Precio", "Valor", "Costo", "Ganancia"],
    sortedProducts.map((product) => {
      const value = product.stock * product.precio;
      const cost = product.stock * product.costo;
      const profit = product.stock * (product.precio - product.costo);
      return [
        product.id,
        product.nombre,
        String(product.stock),
        currency(product.precio),
        currency(value),
        currency(cost),
        currency(profit),
      ];
    }),
    [22, 42, 14, 22, 22, 22, 22],
  );

  pdf.addSection("Entradas de inventario");
  pdf.addTable(
    ["Fecha", "Codigo", "Producto", "Cant.", "Motivo", "Ref."],
    entradas.map((movement) => [
      formatReportDateShort(movement.fecha),
      movement.productId,
      movement.nombre,
      String(movement.cantidad),
      movement.motivo,
      movement.referencia ?? "-",
    ]),
    [30, 24, 42, 14, 38, 20],
  );

  pdf.addSection("Salidas de inventario");
  pdf.addTable(
    ["Fecha", "Codigo", "Producto", "Cant.", "Motivo", "Ref."],
    salidas.map((movement) => [
      formatReportDateShort(movement.fecha),
      movement.productId,
      movement.nombre,
      String(movement.cantidad),
      movement.motivo,
      movement.referencia ?? "-",
    ]),
    [30, 24, 42, 14, 38, 20],
  );

  const fileDate = new Date().toISOString().slice(0, 10);
  pdf.save(`reporte-inventario-${fileDate}.pdf`);
}
