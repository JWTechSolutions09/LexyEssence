import { useMemo, useState, type FormEvent } from "react";
import type { WholesaleClient, WholesaleDiscountPercent } from "../types/domain";
import { formatCedulaDisplay, normalizeCedula } from "../utils/wholesaleClient";

type WholesaleClientModalProps = {
  clients: WholesaleClient[];
  onConfirm: (client: WholesaleClient, discountPercent: WholesaleDiscountPercent) => void;
  onAddClient: (cedula: string, salon: string) => WholesaleClient | { error: string };
  onClose: () => void;
};

type ModalStep = "search" | "discount";

export function WholesaleClientModal({
  clients,
  onConfirm,
  onAddClient,
  onClose,
}: WholesaleClientModalProps) {
  const [step, setStep] = useState<ModalStep>("search");
  const [cedulaInput, setCedulaInput] = useState("");
  const [salonInput, setSalonInput] = useState("");
  const [selectedClient, setSelectedClient] = useState<WholesaleClient | null>(null);
  const [discountPercent, setDiscountPercent] = useState<WholesaleDiscountPercent | null>(null);
  const [error, setError] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  const normalizedQuery = normalizeCedula(cedulaInput);

  const exactMatch = useMemo(() => {
    if (!normalizedQuery) return null;
    return clients.find((client) => normalizeCedula(client.cedula) === normalizedQuery) ?? null;
  }, [clients, normalizedQuery]);

  const partialMatches = useMemo(() => {
    if (!normalizedQuery || exactMatch) return [];
    return clients.filter((client) => normalizeCedula(client.cedula).includes(normalizedQuery));
  }, [clients, exactMatch, normalizedQuery]);

  function handleSelectExisting(client: WholesaleClient) {
    setSelectedClient(client);
    setDiscountPercent(null);
    setError("");
    setStep("discount");
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!normalizedQuery) {
      setError("Ingresa la cedula del cliente mayorista.");
      return;
    }

    if (exactMatch) {
      handleSelectExisting(exactMatch);
      return;
    }

    setShowAddForm(true);
  }

  function handleAddClientSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const salon = salonInput.trim();
    if (!normalizedQuery) {
      setError("La cedula es obligatoria.");
      return;
    }
    if (!salon) {
      setError("Ingresa el nombre del salon.");
      return;
    }

    const result = onAddClient(normalizedQuery, salon);
    if ("error" in result) {
      setError(result.error);
      return;
    }

    handleSelectExisting(result);
  }

  function handleConfirmDiscount() {
    if (!selectedClient || !discountPercent) {
      setError("Selecciona un descuento del 5% o 10%.");
      return;
    }
    onConfirm(selectedClient, discountPercent);
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel card pos-wholesale-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wholesale-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="row">
          <div>
            <h2 id="wholesale-modal-title">Cliente mayorista</h2>
            <p className="muted">
              {step === "search"
                ? "Busca al cliente por cedula o agregalo si es nuevo."
                : "Selecciona el descuento que se aplicara a todos los productos."}
            </p>
          </div>
          <button className="ghost" type="button" onClick={onClose}>Cerrar</button>
        </div>

        {step === "search" && (
          <>
            <form className="pos-wholesale-search" onSubmit={handleSearchSubmit}>
              <label>
                Cedula
                <input
                  className="pos-input"
                  data-manual-input
                  placeholder="001-0000000-0"
                  value={cedulaInput}
                  onChange={(event) => {
                    setCedulaInput(event.target.value);
                    setShowAddForm(false);
                    setError("");
                  }}
                  autoFocus
                />
              </label>
              <button type="submit">Buscar cliente</button>
            </form>

            {exactMatch && !showAddForm && (
              <section className="pos-wholesale-result">
                <p className="muted">Cliente encontrado</p>
                <button
                  type="button"
                  className="pos-wholesale-client-card"
                  onClick={() => handleSelectExisting(exactMatch)}
                >
                  <strong>{exactMatch.salon}</strong>
                  <span className="muted">Cedula {formatCedulaDisplay(exactMatch.cedula)}</span>
                </button>
              </section>
            )}

            {partialMatches.length > 0 && !exactMatch && (
              <section className="pos-wholesale-results">
                <p className="muted">Coincidencias</p>
                <div className="pos-wholesale-client-list">
                  {partialMatches.map((client) => (
                    <button
                      key={client.id}
                      type="button"
                      className="pos-wholesale-client-card"
                      onClick={() => handleSelectExisting(client)}
                    >
                      <strong>{client.salon}</strong>
                      <span className="muted">Cedula {formatCedulaDisplay(client.cedula)}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {(showAddForm || (normalizedQuery && !exactMatch && partialMatches.length === 0)) && (
              <section className="pos-wholesale-add">
                <p className="muted">Cliente no registrado. Agrega el salon para guardarlo.</p>
                <form onSubmit={handleAddClientSubmit}>
                  <label>
                    Cedula
                    <input className="pos-input" data-manual-input value={formatCedulaDisplay(cedulaInput)} readOnly />
                  </label>
                  <label>
                    Nombre del salon
                    <input
                      className="pos-input"
                      data-manual-input
                      placeholder="Ej. Salon Bella Vita"
                      value={salonInput}
                      onChange={(event) => setSalonInput(event.target.value)}
                    />
                  </label>
                  <button type="submit">Agregar y continuar</button>
                </form>
              </section>
            )}
          </>
        )}

        {step === "discount" && selectedClient && (
          <section className="pos-wholesale-discount-step">
            <article className="pos-wholesale-selected card">
              <strong>{selectedClient.salon}</strong>
              <span className="muted">Cedula {formatCedulaDisplay(selectedClient.cedula)}</span>
            </article>

            <p className="pos-wholesale-discount-label">Descuento sobre el precio de venta</p>
            <div className="pos-wholesale-discount-options">
              <button
                type="button"
                className={`pos-wholesale-discount-btn ${discountPercent === 5 ? "is-selected" : ""}`}
                onClick={() => {
                  setDiscountPercent(5);
                  setError("");
                }}
              >
                <strong>5%</strong>
                <span className="muted">Descuento mayorista</span>
              </button>
              <button
                type="button"
                className={`pos-wholesale-discount-btn ${discountPercent === 10 ? "is-selected" : ""}`}
                onClick={() => {
                  setDiscountPercent(10);
                  setError("");
                }}
              >
                <strong>10%</strong>
                <span className="muted">Descuento mayorista</span>
              </button>
            </div>

            <div className="actions pos-wholesale-discount-actions">
              <button type="button" className="ghost" onClick={() => setStep("search")}>Cambiar cliente</button>
              <button type="button" onClick={handleConfirmDiscount}>Aplicar a la venta</button>
            </div>
          </section>
        )}

        {error && <p className="pos-wholesale-error">{error}</p>}
      </div>
    </div>
  );
}
