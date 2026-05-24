import type { CashSession } from "../types/cashSession";
import type { Transaction } from "../types/domain";
import { currency } from "./format";
import { PdfBuilder } from "./pdfBuilder";
import { getSaleTypeLabel, getTransactionDiscountLabel } from "./dailyReportMetrics";
import {
  formatReportDateShort,
  type SalesSummary,
  summarizeTransactions,
} from "./reportMetrics";

export type CashReportPdfInput = {
  periodLabel: string;
  filterSummary: SalesSummary;
  todaySummary: SalesSummary;
  todayCashInDrawer: number;
  yesterdaySummary: SalesSummary;
  yesterdayCloses: CashSession[];
  filteredCloses: CashSession[];
  filteredTransactions: Transaction[];
  monthBreakdown: { dateKey: string; summary: SalesSummary }[];
};

function formatCloseSession(session: CashSession) {
  const summary = session.closeSummary;
  if (!summary) return [session.id, formatReportDateShort(session.closedAt!), "-", "-", "-"];

  return [
    session.id,
    formatReportDateShort(session.closedAt!),
    currency(summary.totalSales),
    currency(summary.totalCashInDrawer),
    currency(summary.totalTransferSales),
  ];
}

export function exportCashReportPdf(input: CashReportPdfInput) {
  const pdf = new PdfBuilder();
  const {
    periodLabel,
    filterSummary,
    todaySummary,
    todayCashInDrawer,
    yesterdaySummary,
    yesterdayCloses,
    filteredCloses,
    filteredTransactions,
    monthBreakdown,
  } = input;

  pdf.addReportHeader("Reporte de Caja", `Periodo consultado: ${periodLabel}`);

  pdf.addSection("Resumen del dia (hoy)");
  pdf.addKeyValues([
    { label: "Total vendido", value: currency(todaySummary.totalSales) },
    { label: "Efectivo", value: currency(todaySummary.cashSales) },
    { label: "Transferencia", value: currency(todaySummary.transferSales) },
    { label: "Ventas", value: String(todaySummary.saleCount) },
    { label: "Efectivo en caja", value: currency(todayCashInDrawer) },
  ]);

  pdf.addSection("Resumen dia anterior");
  pdf.addKeyValues([
    { label: "Total vendido", value: currency(yesterdaySummary.totalSales) },
    { label: "Efectivo", value: currency(yesterdaySummary.cashSales) },
    { label: "Transferencia", value: currency(yesterdaySummary.transferSales) },
    { label: "Ventas", value: String(yesterdaySummary.saleCount) },
  ]);

  if (yesterdayCloses.length > 0) {
    pdf.addSection("Cierres de caja (ayer)");
    pdf.addTable(
      ["Sesion", "Cerrado", "Vendido", "Efectivo caja", "Transferencia"],
      yesterdayCloses.map(formatCloseSession),
      [28, 38, 28, 32, 32],
    );
  }

  pdf.addSection(`Resumen filtrado · ${periodLabel}`);
  pdf.addKeyValues([
    { label: "Total vendido", value: currency(filterSummary.totalSales) },
    { label: "Efectivo", value: currency(filterSummary.cashSales) },
    { label: "Transferencia", value: currency(filterSummary.transferSales) },
    { label: "Tarjeta", value: currency(filterSummary.cardSales) },
    { label: "Otros", value: currency(filterSummary.otherSales) },
    { label: "Pendiente", value: currency(filterSummary.pendingSales) },
    { label: "Ventas", value: String(filterSummary.saleCount) },
  ]);

  if (monthBreakdown.length > 0) {
    pdf.addSection("Ventas por dia del mes");
    pdf.addTable(
      ["Fecha", "Ventas", "Total", "Efectivo", "Transferencia"],
      monthBreakdown.map(({ dateKey, summary }) => [
        new Intl.DateTimeFormat("es-DO", { day: "numeric", month: "short", year: "numeric" })
          .format(new Date(`${dateKey}T12:00:00`)),
        String(summary.saleCount),
        currency(summary.totalSales),
        currency(summary.cashSales),
        currency(summary.transferSales),
      ]),
      [32, 18, 32, 32, 38],
    );
  }

  if (filteredCloses.length > 0) {
    pdf.addSection(`Cierres de caja · ${periodLabel}`);
    pdf.addTable(
      ["Sesion", "Cerrado", "Vendido", "Efectivo caja", "Transferencia"],
      filteredCloses.map(formatCloseSession),
      [28, 38, 28, 32, 32],
    );
  }

  const sortedTransactions = [...filteredTransactions].sort((a, b) => {
    const aTime = a.soldAt ? new Date(a.soldAt).getTime() : 0;
    const bTime = b.soldAt ? new Date(b.soldAt).getTime() : 0;
    return bTime - aTime;
  });

  pdf.addSection(`Detalle de ventas · ${periodLabel}`);
  pdf.addTable(
    ["Factura", "Fecha", "Cliente", "Tipo", "Descuento", "Metodo", "Monto"],
    sortedTransactions.map((transaction) => [
      transaction.id,
      transaction.soldAt ? formatReportDateShort(transaction.soldAt) : "-",
      transaction.wholesaleSalon ?? transaction.cliente,
      getSaleTypeLabel(transaction),
      getTransactionDiscountLabel(transaction),
      transaction.metodo,
      currency(transaction.monto),
    ]),
    [22, 28, 34, 20, 34, 22, 22],
  );

  const linesWithItems = sortedTransactions.flatMap((transaction) => (
    transaction.items?.map((item) => [
      transaction.id,
      item.productId,
      item.nombre,
      String(item.cantidad),
      transaction.estado,
    ]) ?? []
  ));

  if (linesWithItems.length > 0) {
    pdf.addSection("Productos vendidos por factura");
    pdf.addTable(
      ["Factura", "Codigo", "Producto", "Cant.", "Estado venta"],
      linesWithItems,
      [26, 28, 58, 16, 28],
    );
  }

  const fileDate = new Date().toISOString().slice(0, 10);
  pdf.save(`reporte-caja-${fileDate}.pdf`);
}

export function buildCashReportPdfInput(
  partial: Omit<CashReportPdfInput, "filterSummary"> & { filteredTransactions: Transaction[] },
): CashReportPdfInput {
  return {
    ...partial,
    filterSummary: summarizeTransactions(partial.filteredTransactions),
  };
}
