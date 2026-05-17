import { transferPaymentConfig } from "../config/transfer";

type TransferPaymentModalProps = {
  onConfirm: (confirmed: boolean) => void;
  onClose: () => void;
};

export function TransferPaymentModal({ onConfirm, onClose }: TransferPaymentModalProps) {
  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="modal-panel card pos-transfer-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="transfer-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="row">
          <div>
            <h2 id="transfer-modal-title">Pago por transferencia</h2>
            <p className="muted">Indica al cliente las cuentas y confirma si ya recibiste el pago.</p>
          </div>
          <button className="ghost" type="button" onClick={onClose}>Cerrar</button>
        </div>

        <section className="pos-transfer-section">
          <h3>Cuentas a transferir:</h3>
          <ul className="pos-transfer-accounts">
            {transferPaymentConfig.banks.map((bank) => (
              <li key={bank.name}>
                <strong>{bank.name}:</strong>
                <span>{bank.account || "Consultar en caja"}</span>
              </li>
            ))}
          </ul>
        </section>

        <p className="pos-transfer-proof">
          Enviar comprobante a: <strong>{transferPaymentConfig.proofPhone}</strong>
        </p>

        <section className="pos-transfer-confirm">
          <h3>Transferencia confirmada:</h3>
          <div className="pos-transfer-actions">
            <button
              type="button"
              className="pos-transfer-btn pos-transfer-btn-yes"
              onClick={() => onConfirm(true)}
            >
              <span className="material-symbols-outlined">check_circle</span>
              Si
            </button>
            <button
              type="button"
              className="pos-transfer-btn pos-transfer-btn-no"
              onClick={() => onConfirm(false)}
            >
              <span className="material-symbols-outlined">cancel</span>
              No
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
