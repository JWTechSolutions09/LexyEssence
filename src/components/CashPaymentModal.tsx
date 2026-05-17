import { useMemo, useState, type FormEvent } from "react";
import { currency } from "../utils/format";

type CashPaymentModalProps = {
  total: number;
  onConfirm: (amountPaid: number, change: number) => void;
  onClose: () => void;
};

export function CashPaymentModal({ total, onConfirm, onClose }: CashPaymentModalProps) {
  const [amountInput, setAmountInput] = useState("");
  const [error, setError] = useState("");

  const amountPaid = Number(amountInput);
  const change = useMemo(() => {
    if (!Number.isFinite(amountPaid) || amountPaid < 0) return 0;
    return Math.max(0, amountPaid - total);
  }, [amountPaid, total]);

  const canConfirm = Number.isFinite(amountPaid) && amountPaid >= total;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");

    if (!Number.isFinite(amountPaid) || amountPaid < total) {
      setError(`El monto debe ser al menos ${currency(total)}.`);
      return;
    }

    onConfirm(amountPaid, change);
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="modal-panel card pos-cash-modal pos-cash-payment-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cash-payment-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="row">
          <div>
            <h2 id="cash-payment-title">Pago en efectivo</h2>
            <p className="muted">Indica con cuanto pago el cliente.</p>
          </div>
          <button className="ghost" type="button" onClick={onClose}>Cerrar</button>
        </div>

        <p className="pos-cash-payment-total">
          Total a cobrar: <strong>{currency(total)}</strong>
        </p>

        <form className="pos-cash-form" onSubmit={handleSubmit} data-manual-input>
          <label>
            Con cuanto pago el cliente
            <input
              className="pos-cash-input"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              placeholder="0.00"
              value={amountInput}
              onChange={(event) => {
                setError("");
                setAmountInput(event.target.value);
              }}
              autoFocus
              required
            />
          </label>

          <div className="pos-cash-change-preview">
            <span className="muted">Su cambio</span>
            <strong>{currency(change)}</strong>
          </div>

          {error && <p className="form-error">{error}</p>}

          <button type="submit" className="pos-cash-confirm-btn" disabled={!canConfirm}>
            <span className="material-symbols-outlined">check_circle</span>
            Confirmar cobro
          </button>
        </form>
      </div>
    </div>
  );
}
