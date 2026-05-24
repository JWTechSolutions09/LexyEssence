import { useMemo, useState, type FormEvent } from "react";
import { useAppContext } from "../context/AppContext";
import { currency } from "../utils/format";
import { formatReportDateShort } from "../utils/reportMetrics";
import {
  getSaleTypeLabel,
  getTransactionDiscountLabel,
} from "../utils/dailyReportMetrics";
import {
  getWholesaleClientTransactions,
  summarizeWholesaleClientHistory,
} from "../utils/wholesaleClientHistory";
import { formatCedulaDisplay, normalizeCedula } from "../utils/wholesaleClient";
import type { WholesaleClient } from "../types/domain";

type FormMode = "create" | "edit" | null;

const emptyForm = { cedula: "", salon: "" };

export function WholesaleClientsPage() {
  const {
    wholesaleClients,
    transactions,
    addWholesaleClient,
    updateWholesaleClient,
    deleteWholesaleClient,
    setNotice,
    forceSave,
  } = useAppContext();

  const [search, setSearch] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [editingClient, setEditingClient] = useState<WholesaleClient | null>(null);

  const filteredClients = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return [...wholesaleClients].sort((a, b) => a.salon.localeCompare(b.salon));

    return wholesaleClients
      .filter((client) => {
        const cedula = normalizeCedula(client.cedula);
        return client.salon.toLowerCase().includes(query)
          || cedula.includes(normalizeCedula(query))
          || formatCedulaDisplay(client.cedula).includes(query);
      })
      .sort((a, b) => a.salon.localeCompare(b.salon));
  }, [wholesaleClients, search]);

  const selectedClient = useMemo(
    () => wholesaleClients.find((client) => client.id === selectedClientId) ?? null,
    [selectedClientId, wholesaleClients],
  );

  const selectedHistory = useMemo(() => {
    if (!selectedClient) return null;
    return {
      transactions: getWholesaleClientTransactions(transactions, selectedClient),
      summary: summarizeWholesaleClientHistory(transactions, selectedClient),
    };
  }, [selectedClient, transactions]);

  function openCreateModal() {
    setForm(emptyForm);
    setFormError("");
    setEditingClient(null);
    setFormMode("create");
  }

  function openEditModal(client: WholesaleClient) {
    setEditingClient(client);
    setForm({ cedula: client.cedula, salon: client.salon });
    setFormError("");
    setFormMode("edit");
  }

  function closeModal() {
    setFormMode(null);
    setEditingClient(null);
    setForm(emptyForm);
    setFormError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    if (formMode === "create") {
      const result = addWholesaleClient(form.cedula, form.salon);
      if ("error" in result) {
        setFormError(result.error);
        return;
      }
      setNotice(`Cliente mayorista ${result.salon} agregado.`);
      setSelectedClientId(result.id);
      closeModal();
      await forceSave();
      return;
    }

    if (formMode === "edit" && editingClient) {
      const result = updateWholesaleClient(editingClient.id, form);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      setNotice(`Cliente ${form.salon.trim()} actualizado.`);
      closeModal();
      await forceSave();
    }
  }

  async function handleDelete(client: WholesaleClient) {
    const history = summarizeWholesaleClientHistory(transactions, client);
    const message = history.saleCount > 0
      ? `Eliminar ${client.salon}? Las ${history.saleCount} venta(s) en historial conservaran su registro.`
      : `Eliminar ${client.salon}?`;

    if (!window.confirm(message)) return;

    const result = deleteWholesaleClient(client.id);
    if (!result.ok) {
      setNotice(result.error);
      return;
    }

    if (selectedClientId === client.id) setSelectedClientId(null);
    setNotice(`Cliente ${client.salon} eliminado.`);
    await forceSave();
  }

  return (
    <section className="wholesale-clients-screen">
      <header className="row wholesale-clients-head">
        <div>
          <h1>Clientes mayoristas</h1>
          <p className="muted">Administra salones, cedulas e historial de compras.</p>
        </div>
        <button type="button" onClick={openCreateModal}>Agregar cliente</button>
      </header>

      <div className="wholesale-clients-layout">
        <section className="card wholesale-clients-list-panel">
          <div className="wholesale-clients-toolbar">
            <input
              className="pos-input"
              placeholder="Buscar por salon o cedula..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <span className="muted">{filteredClients.length} cliente(s)</span>
          </div>

          {filteredClients.length === 0 ? (
            <p className="muted wholesale-clients-empty">
              {wholesaleClients.length === 0
                ? "Aun no hay clientes mayoristas. Agrega uno aqui o desde el POS."
                : "No hay coincidencias para la busqueda."}
            </p>
          ) : (
            <ul className="wholesale-clients-list">
              {filteredClients.map((client) => {
                const summary = summarizeWholesaleClientHistory(transactions, client);
                const isSelected = selectedClientId === client.id;

                return (
                  <li key={client.id}>
                    <button
                      type="button"
                      className={`wholesale-client-row ${isSelected ? "is-selected" : ""}`}
                      onClick={() => setSelectedClientId(client.id)}
                    >
                      <div>
                        <strong>{client.salon}</strong>
                        <p className="muted">Cedula {formatCedulaDisplay(client.cedula)}</p>
                      </div>
                      <div className="wholesale-client-row-meta">
                        <span className="badge">{summary.saleCount} venta(s)</span>
                        <strong>{currency(summary.totalSales)}</strong>
                      </div>
                    </button>
                    <div className="actions wholesale-client-row-actions">
                      <button type="button" className="ghost" onClick={() => openEditModal(client)}>Editar</button>
                      <button type="button" className="ghost" onClick={() => void handleDelete(client)}>Eliminar</button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="card wholesale-clients-detail-panel">
          {!selectedClient || !selectedHistory ? (
            <div className="wholesale-clients-detail-empty">
              <span className="material-symbols-outlined">groups</span>
              <h2>Historial del cliente</h2>
              <p className="muted">Selecciona un cliente para ver sus compras y descuentos aplicados.</p>
            </div>
          ) : (
            <>
              <div className="row wholesale-clients-detail-head">
                <div>
                  <h2>{selectedClient.salon}</h2>
                  <p className="muted">Cedula {formatCedulaDisplay(selectedClient.cedula)}</p>
                </div>
                <button type="button" className="ghost" onClick={() => openEditModal(selectedClient)}>Editar</button>
              </div>

              <div className="reports-kpi-grid reports-kpi-grid-compact wholesale-client-kpis">
                <article className="report-glass-card reports-kpi-card">
                  <span className="kpi-label">Total comprado</span>
                  <strong className="kpi-value">{currency(selectedHistory.summary.totalSales)}</strong>
                </article>
                <article className="report-glass-card reports-kpi-card">
                  <span className="kpi-label">Ventas</span>
                  <strong className="kpi-value">{selectedHistory.summary.saleCount}</strong>
                </article>
                <article className="report-glass-card reports-kpi-card">
                  <span className="kpi-label">Descuentos</span>
                  <strong className="kpi-value">{currency(selectedHistory.summary.totalDiscount)}</strong>
                </article>
              </div>

              {selectedHistory.summary.lastSaleAt && (
                <p className="muted wholesale-client-last-sale">
                  Ultima compra: {formatReportDateShort(selectedHistory.summary.lastSaleAt)}
                </p>
              )}

              <h3>Historial de ventas</h3>
              {selectedHistory.transactions.length === 0 ? (
                <p className="muted">Este cliente aun no tiene ventas registradas.</p>
              ) : (
                <div className="reports-table">
                  {selectedHistory.transactions.map((transaction) => (
                    <div className="list-item reports-tx-row" key={transaction.id}>
                      <div>
                        <strong>#{transaction.id}</strong>
                        {transaction.soldAt && (
                          <p className="muted reports-tx-time">{formatReportDateShort(transaction.soldAt)}</p>
                        )}
                        <p className="muted reports-tx-wholesale">{getTransactionDiscountLabel(transaction)}</p>
                      </div>
                      <span className="badge warn">{getSaleTypeLabel(transaction)}</span>
                      <span className="muted">{transaction.metodo}</span>
                      <span>{currency(transaction.monto)}</span>
                      <span className={transaction.estado === "Pendiente" ? "badge warn" : "badge success"}>
                        {transaction.estado}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {formMode && (
        <div className="modal-backdrop" role="presentation" onClick={closeModal}>
          <div
            className="modal-panel card pos-wholesale-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="row">
              <h2>{formMode === "create" ? "Agregar cliente mayorista" : "Editar cliente"}</h2>
              <button type="button" className="ghost" onClick={closeModal}>Cerrar</button>
            </div>
            <form className="pos-wholesale-add" onSubmit={(event) => void handleSubmit(event)}>
              <label>
                Cedula
                <input
                  className="pos-input"
                  value={form.cedula}
                  onChange={(event) => setForm((prev) => ({ ...prev, cedula: event.target.value }))}
                  placeholder="001-0000000-0"
                  required
                />
              </label>
              <label>
                Nombre del salon
                <input
                  className="pos-input"
                  value={form.salon}
                  onChange={(event) => setForm((prev) => ({ ...prev, salon: event.target.value }))}
                  placeholder="Ej. Salon Bella Vita"
                  required
                />
              </label>
              {formError && <p className="pos-wholesale-error">{formError}</p>}
              <div className="actions">
                <button type="button" className="ghost" onClick={closeModal}>Cancelar</button>
                <button type="submit">{formMode === "create" ? "Guardar" : "Actualizar"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
