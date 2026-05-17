import { businessDetails } from "../config/business";
import type { CashCloseReceipt } from "../types/cashSession";
import { receiptCurrency } from "./format";

const THERMAL_PAPER_MM = 58;
const PRINTABLE_WIDTH_MM = 40;
const PRINTABLE_WIDTH_PX = 152;
const PAGE_MARGIN_MM = 2;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatReceiptDateTime(value: string) {
  return new Intl.DateTimeFormat("es-DO", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function totalLine(label: string, value: number, extraClass = "") {
  return `<div class="total-line ${extraClass}"><span>${label}</span><span>${receiptCurrency(value)}</span></div>`;
}

function buildCashCloseReceiptHtml(receipt: CashCloseReceipt) {
  const { summary } = receipt;

  return `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>Cierre de caja ${escapeHtml(receipt.sessionId)}</title>
    <style>
      @page { size: ${THERMAL_PAPER_MM}mm auto; margin: ${PAGE_MARGIN_MM}mm; }
      * { box-sizing: border-box; }
      html, body {
        width: ${PRINTABLE_WIDTH_MM}mm;
        max-width: ${PRINTABLE_WIDTH_MM}mm;
        width: ${PRINTABLE_WIDTH_PX}px;
        max-width: ${PRINTABLE_WIDTH_PX}px;
        margin: 0 auto;
        padding: 0;
      }
      body {
        padding: 0 1mm 2mm;
        color: #000;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 8px;
        font-weight: 600;
        line-height: 1.25;
      }
      .center { text-align: center; }
      .business-name { font-size: 12px; font-weight: 800; margin: 0 0 2px; }
      .business-contact { margin: 0; font-size: 8px; line-height: 1.2; }
      .title { font-size: 11px; font-weight: 800; margin: 4px 0 0; }
      .divider { border: 0; border-top: 1px dashed #000; margin: 6px 0; }
      .meta { margin: 0 0 2px; font-size: 8px; line-height: 1.2; }
      .meta strong { font-weight: 800; }
      .totals { margin-top: 2px; }
      .total-line {
        display: flex;
        justify-content: space-between;
        gap: 3px;
        font-size: 8px;
        padding: 1px 0;
      }
      .total-line.grand {
        margin-top: 3px;
        padding-top: 3px;
        border-top: 1px dashed #000;
        font-size: 10px;
        font-weight: 800;
      }
      .footer { margin-top: 6px; font-size: 8px; text-align: center; }
    </style>
  </head>
  <body>
    <header class="center">
      <p class="business-name">${escapeHtml(businessDetails.name)}</p>
      <p class="business-contact">${escapeHtml(businessDetails.phone)}</p>
      <p class="title">CIERRE DE CAJA</p>
    </header>
    <hr class="divider" />
    <p class="meta"><strong>Sesion:</strong> ${escapeHtml(receipt.sessionId)}</p>
    <p class="meta"><strong>Apertura:</strong> ${escapeHtml(formatReceiptDateTime(receipt.openedAt))}</p>
    <p class="meta"><strong>Cierre:</strong> ${escapeHtml(formatReceiptDateTime(receipt.closedAt))}</p>
    <hr class="divider" />
    <div class="totals">
      ${totalLine("Efectivo al abrir", summary.openingAmount)}
      ${totalLine("Ventas en efectivo", summary.cashSalesAmount)}
      ${totalLine("Total ventas", summary.totalSales, "grand")}
      ${totalLine("Efectivo", summary.totalCashInDrawer, "grand")}
      ${totalLine("Transferencia", summary.totalTransferSales)}
    </div>
    <p class="footer">Caja cerrada correctamente</p>
  </body>
</html>`;
}

export function printThermalCashClose(receipt: CashCloseReceipt): Promise<boolean> {
  return new Promise((resolve) => {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("title", "Impresion de cierre de caja");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;";

    const cleanup = () => {
      window.setTimeout(() => iframe.remove(), 1000);
    };

    document.body.appendChild(iframe);
    const doc = iframe.contentDocument;
    if (!doc) {
      cleanup();
      resolve(false);
      return;
    }

    const html = buildCashCloseReceiptHtml(receipt);

    doc.open();
    doc.write(html);
    doc.close();

    const triggerPrint = () => {
      try {
        const printWindow = iframe.contentWindow;
        if (!printWindow) {
          resolve(false);
          return;
        }
        printWindow.focus();
        printWindow.print();
        resolve(true);
      } catch {
        resolve(false);
      } finally {
        cleanup();
      }
    };

    window.setTimeout(triggerPrint, 250);
  });
}
