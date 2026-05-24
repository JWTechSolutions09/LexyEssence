import { currency } from "./format";
import { PdfBuilder } from "./pdfBuilder";
import type { DailyReportData } from "./dailyReportMetrics";
import { getSaleTypeLabel, getTransactionDiscountLabel } from "./dailyReportMetrics";
import { formatReportDateShort } from "./reportMetrics";
import { formatCedulaDisplay } from "./wholesaleClient";

export function exportDailyReportPdf(report: DailyReportData) {
  const pdf = new PdfBuilder();

  pdf.addReportHeader("Reporte del dia", report.dateLabel);

  pdf.addSection("Resumen general");
  pdf.addKeyValues([
    { label: "Total vendido", value: currency(report.salesSummary.totalSales) },
    { label: "Ventas completadas", value: String(report.salesSummary.saleCount) },
    { label: "Efectivo", value: currency(report.salesSummary.cashSales) },
    { label: "Transferencia", value: currency(report.salesSummary.transferSales) },
    { label: "Tarjeta", value: currency(report.salesSummary.cardSales) },
    { label: "Pendiente", value: currency(report.salesSummary.pendingSales) },
    { label: "Descuentos totales", value: currency(report.totalDiscountGiven) },
    { label: "Desc. mayoristas", value: currency(report.wholesaleSummary.totalWholesaleDiscount) },
    { label: "Ventas mayoristas", value: String(report.wholesaleSummary.saleCount) },
    { label: "Citas", value: String(report.appointments.length) },
    { label: "Mov. inventario", value: String(report.stockMovements.length) },
    { label: "Cierres de caja", value: String(report.cashSessions.length) },
  ]);

  if (report.wholesaleSummary.byClient.length > 0) {
    pdf.addSection("Clientes mayoristas del dia");
    pdf.addTable(
      ["Salon", "Cedula", "Ventas", "Total", "Descuento"],
      report.wholesaleSummary.byClient.map((entry) => [
        entry.salon,
        entry.cedula ? formatCedulaDisplay(entry.cedula) : "-",
        String(entry.saleCount),
        currency(entry.totalSales),
        currency(entry.totalDiscount),
      ]),
      [42, 30, 18, 28, 28],
    );
  }

  if (report.transactions.length > 0) {
    pdf.addSection("Ventas del dia");
    pdf.addTable(
      ["Factura", "Hora", "Cliente", "Tipo", "Descuento", "Metodo", "Total"],
      report.transactions.map((transaction) => [
        transaction.id,
        transaction.soldAt ? formatReportDateShort(transaction.soldAt) : "-",
        transaction.wholesaleSalon ?? transaction.cliente,
        getSaleTypeLabel(transaction),
        getTransactionDiscountLabel(transaction),
        transaction.metodo,
        currency(transaction.monto),
      ]),
      [24, 34, 34, 22, 34, 22, 22],
    );
  }

  if (report.cashSessions.length > 0) {
    pdf.addSection("Cierres de caja");
    pdf.addTable(
      ["Sesion", "Cerrado", "Vendido", "Efectivo", "Transferencia"],
      report.cashSessions.map((session) => [
        session.id,
        session.closedAt ? formatReportDateShort(session.closedAt) : "-",
        currency(session.closeSummary?.totalSales ?? 0),
        currency(session.closeSummary?.totalCashInDrawer ?? 0),
        currency(session.closeSummary?.totalTransferSales ?? 0),
      ]),
      [28, 38, 28, 32, 32],
    );
  }

  if (report.appointments.length > 0) {
    pdf.addSection("Citas");
    pdf.addTable(
      ["Hora", "Cliente", "Servicios", "Total"],
      report.appointments.map((appointment) => [
        appointment.hora,
        appointment.cliente,
        appointment.servicios.join(", "),
        currency(appointment.total),
      ]),
      [22, 42, 70, 24],
    );
  }

  if (report.stockMovements.length > 0) {
    pdf.addSection("Movimientos de inventario");
    pdf.addTable(
      ["Tipo", "Producto", "Cant.", "Motivo", "Hora"],
      report.stockMovements.map((movement) => [
        movement.tipo,
        movement.nombre,
        String(movement.cantidad),
        movement.motivo,
        formatReportDateShort(movement.fecha),
      ]),
      [18, 52, 14, 52, 34],
    );
  }

  pdf.save(`reporte-dia-${report.dateKey}.pdf`);
}
