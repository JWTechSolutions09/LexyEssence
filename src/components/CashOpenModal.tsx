import { useEffect, useState, type FormEvent } from "react";

type CashOpenModalProps = {
  onConfirm: (openingAmount: number, openedAt: string) => void;
  onClose: () => void;
};

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("es-DO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export function CashOpenModal({ onConfirm, onClose }: CashOpenModalProps) {
  const [amountInput, setAmountInput] = useState("");
  const [openedAtPreview, setOpenedAtPreview] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setOpenedAtPreview(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const amount = Number(amountInput);
    if (!Number.isFinite(amount) || amount < 0) return;
    onConfirm(amount, openedAtPreview.toISOString());
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="modal-panel card pos-cash-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cash-open-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="row">
          <div>
            <h2 id="cash-open-title">Ingrese el efectivo en Caja</h2>
            <p className="muted">Indica cuanto efectivo hay disponible al abrir la caja.</p>
          </div>
          <button className="ghost" type="button" onClick={onClose}>Cerrar</button>
        </div>

        <form className="pos-cash-form" onSubmit={handleSubmit} data-manual-input>
          <label>
            Efectivo disponible en caja
            <input
              className="pos-cash-input"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              placeholder="0.00"
              value={amountInput}
              onChange={(event) => setAmountInput(event.target.value)}
              autoFocus
              required
            />
          </label>

          <p className="pos-cash-datetime">
            <span className="muted">Fecha y hora de apertura:</span>
            <strong>{formatDateTime(openedAtPreview)}</strong>
          </p>

          <button type="submit" className="pos-cash-confirm-btn">
            <span className="material-symbols-outlined">check_circle</span>
            Confirmar
          </button>
        </form>
      </div>
    </div>
  );
}
