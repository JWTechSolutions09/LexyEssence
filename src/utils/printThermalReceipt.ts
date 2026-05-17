import { businessDetails } from "../config/business";
import type { SaleReceipt } from "../types/receipt";
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
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(new Date(value));
}

function paymentConditionLabel(method: string) {
  if (method === "Efectivo") return "CONTADO";
  if (method === "Transferencia") return "TRANSFERENCIA";
  if (method === "Tarjeta") return "TARJETA";
  if (method === "Mixto") return "MIXTO";
  return method.toUpperCase();
}

function formatAmount(value: number) {
  return receiptCurrency(value).replace(/^RD\$\s?/, "");
}

function buildThermalReceiptHtml(receipt: SaleReceipt) {
  const itemsHtml = receipt.items.map((item) => `
    <div class="item-block">
      <p class="item-qty">${item.cantidad} UNIDAD x ${receiptCurrency(item.precioUnitario)}</p>
      <div class="item-line">
        <span class="item-title">${escapeHtml(item.nombre)}</span>
        <span class="item-price">${formatAmount(item.subtotal)}</span>
      </div>
    </div>
  `).join("");

  const discountHtml = receipt.discount > 0
    ? `<div class="total-line"><span>DESCUENTO :</span><span>${formatAmount(receipt.discount)}</span></div>`
    : "";

  const noteHtml = receipt.note
    ? `<p class="note"><strong>NOTA:</strong> ${escapeHtml(receipt.note)}</p>`
    : "";

  const paymentLabel = paymentConditionLabel(receipt.paymentMethod);

  return `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(receipt.invoiceNumber)}</title>
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
        overflow-wrap: anywhere;
        word-break: break-word;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .center { text-align: center; }
      .business-name {
        font-size: 11px;
        font-weight: 800;
        margin: 0 0 3px;
        text-transform: uppercase;
      }
      .business-line {
        margin: 0 0 2px;
        font-size: 7.5px;
        line-height: 1.2;
      }
      .divider {
        border: 0;
        border-top: 1px dashed #000;
        margin: 5px 0;
      }
      .meta {
        margin: 0 0 2px;
        font-size: 8px;
        line-height: 1.2;
      }
      .doc-title {
        text-align: center;
        font-size: 9px;
        font-weight: 800;
        margin: 4px 0 3px;
      }
      .items-head {
        display: flex;
        justify-content: space-between;
        font-weight: 800;
        font-size: 8px;
        margin: 3px 0 2px;
      }
      .item-block {
        margin-bottom: 4px;
      }
      .item-qty {
        margin: 0;
        font-size: 7.5px;
      }
      .item-line {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 4px;
        margin: 1px 0 0;
      }
      .item-title {
        flex: 1;
        font-weight: 800;
        font-size: 8px;
        text-transform: uppercase;
      }
      .item-price {
        flex-shrink: 0;
        font-weight: 700;
        white-space: nowrap;
      }
      .total-line {
        display: flex;
        justify-content: space-between;
        gap: 4px;
        font-size: 8px;
        padding: 1px 0;
      }
      .total-line.grand {
        margin-top: 2px;
        padding-top: 2px;
        border-top: 1px dashed #000;
        font-size: 9px;
        font-weight: 800;
      }
      .footer {
        margin-top: 5px;
        font-size: 8px;
        text-align: center;
      }
      .note {
        margin: 4px 0 0;
        font-size: 7.5px;
      }
    </style>
  </head>
  <body>
    <header class="center">
      <p class="business-name">${escapeHtml(businessDetails.name)}</p>
      <p class="business-line">${escapeHtml(businessDetails.address)}</p>
      <p class="business-line"><strong>TELEFONO:</strong> ${escapeHtml(businessDetails.phone)}</p>
    </header>

    <hr class="divider" />

    <p class="meta"><strong>CLIENTE :</strong> ${escapeHtml(receipt.customerName)}</p>

    <p class="doc-title">FACTURA DE CONSUMIDOR FINAL</p>

    <p class="meta"><strong>FACTURA # :</strong> ${escapeHtml(receipt.invoiceNumber)}</p>
    <p class="meta"><strong>FECHA :</strong> ${escapeHtml(formatReceiptDateTime(receipt.soldAt))}</p>
    <p class="meta"><strong>CONDICION :</strong> ${escapeHtml(paymentConditionLabel(receipt.paymentMethod))}</p>

    <hr class="divider" />

    <div class="items-head">
      <span>ITEM</span>
      <span>PRECIO TOTAL</span>
    </div>

    ${itemsHtml}

    <hr class="divider" />

    <div class="totals">
      ${discountHtml}
      <div class="total-line grand">
        <span>TOTAL GENERAL :</span>
        <span>${formatAmount(receipt.total)}</span>
      </div>
      <div class="total-line">
        <span>${escapeHtml(paymentLabel)} :</span>
        <span>${formatAmount(receipt.amountPaid ?? receipt.total)}</span>
      </div>
      <div class="total-line">
        <span>SU CAMBIO:</span>
        <span>${formatAmount(receipt.change ?? 0)}</span>
      </div>
    </div>

    ${noteHtml}

    <p class="footer">Gracias por su compra</p>
  </body>
</html>`;
}

export function printThermalReceipt(receipt: SaleReceipt): Promise<boolean> {

  return new Promise((resolve) => {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("title", "Impresion de factura termica");
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

    doc.open();
    doc.write(buildThermalReceiptHtml(receipt));
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
