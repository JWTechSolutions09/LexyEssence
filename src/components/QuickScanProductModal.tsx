import { useEffect, useRef, type FormEvent } from "react";

export type QuickScanDraft = {
  id: string;
  nombre: string;
  precio: string;
  stock: string;
};

type QuickScanProductModalProps = {
  draft: QuickScanDraft;
  error: string;
  submitLabel: string;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onDraftChange: (updater: (prev: QuickScanDraft) => QuickScanDraft) => void;
  onClearError: () => void;
};

export function QuickScanProductModal({
  draft,
  error,
  submitLabel,
  onClose,
  onSubmit,
  onDraftChange,
  onClearError,
}: QuickScanProductModalProps) {
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel card pos-scan-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-scan-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="row">
          <div>
            <h2 id="quick-scan-modal-title">Producto no registrado</h2>
            <p className="muted">
              El codigo <strong>{draft.id}</strong> no esta en inventario.
              Agregalo para continuar.
            </p>
          </div>
          <button className="ghost" type="button" onClick={onClose}>Cerrar</button>
        </div>

        <form className="inventory-form" onSubmit={onSubmit}>
          <div className="inventory-form-grid">
            <label>
              Codigo escaneado
              <input className="inventory-input" data-manual-input value={draft.id} readOnly />
            </label>

            <label>
              Stock inicial
              <input
                className="inventory-input"
                data-manual-input
                type="number"
                min="0"
                step="1"
                value={draft.stock}
                onChange={(event) => {
                  onClearError();
                  onDraftChange((prev) => ({ ...prev, stock: event.target.value }));
                }}
              />
            </label>

            <label className="field-span-2">
              Nombre del producto
              <input
                ref={nameInputRef}
                className="inventory-input"
                data-manual-input
                value={draft.nombre}
                onChange={(event) => {
                  onClearError();
                  onDraftChange((prev) => ({ ...prev, nombre: event.target.value }));
                }}
                placeholder="Ej. Crema hidratante 50ml"
                autoComplete="off"
              />
            </label>

            <label className="field-span-2">
              Precio de venta
              <input
                className="inventory-input"
                data-manual-input
                type="number"
                min="0"
                step="0.01"
                value={draft.precio}
                onChange={(event) => {
                  onClearError();
                  onDraftChange((prev) => ({ ...prev, precio: event.target.value }));
                }}
              />
            </label>
          </div>

          {error && <p className="form-error">{error}</p>}

          <div className="modal-actions">
            <button className="ghost" type="button" onClick={onClose}>Cancelar</button>
            <button type="submit">{submitLabel}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
