import type { CashCloseSummary } from "../types/cashSession";
import { currency } from "../utils/format";

type CashCloseModalProps = {
  openedAt: string;
  summary: CashCloseSummary;
  onConfirm: () => void;
  onClose: () => void;
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-DO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function CashCloseModal({ openedAt, summary, onConfirm, onClose }: CashCloseModalProps) {
  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="modal-panel card pos-cash-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cash-close-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="row">
          <div>
            <h2 id="cash-close-title">Cierre de caja</h2>
            <p className="muted">Resumen de la sesion abierta el {formatDateTime(openedAt)}.</p>
          </div>
          <button className="ghost" type="button" onClick={onClose}>Cerrar</button>
        </div>

        <ul className="pos-cash-close-summary">
          <li>
            <span>Total ventas</span>
            <strong>{currency(summary.totalSales)}</strong>
          </li>
          <li>
            <span>Total en Efectivo en caja</span>
            <strong>{currency(summary.totalCashInDrawer)}</strong>
          </li>
          <li className="muted small">
            <span>Efectivo al abrir</span>
            <span>{currency(summary.openingAmount)}</span>
          </li>
          <li className="muted small">
            <span>Ventas en efectivo</span>
            <span>{currency(summary.cashSalesAmount)}</span>
          </li>
          <li>
            <span>Total Ventas transferencia</span>
            <strong>{currency(summary.totalTransferSales)}</strong>
          </li>
        </ul>

        <button type="button" className="pos-cash-confirm-btn" onClick={onConfirm}>
          <span className="material-symbols-outlined">check_circle</span>
          Confirmar
        </button>
      </div>
    </div>
  );
}
