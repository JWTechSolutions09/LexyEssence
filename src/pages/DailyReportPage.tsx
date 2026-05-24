import { useMemo, useState, type ReactNode } from "react";
import { ReportsBackLink } from "../components/ReportsBackLink";
import { useAppContext } from "../context/AppContext";
import {
  buildDailyReportData,
  getSaleTypeLabel,
  getTransactionDiscountLabel,
  getWholesaleClientLabel,
} from "../utils/dailyReportMetrics";
import { exportDailyReportPdf } from "../utils/exportDailyReportPdf";
import { currency } from "../utils/format";
import { formatReportDateShort, toLocalDateKey } from "../utils/reportMetrics";
import { isWholesaleTransaction } from "../utils/transactionSaleDetails";
import { formatCedulaDisplay } from "../utils/wholesaleClient";

function KpiCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <article className="report-glass-card reports-kpi-card">
      <span className="kpi-label">{label}</span>
      <strong className="kpi-value">{value}</strong>
      {hint && <p className="muted reports-kpi-hint">{hint}</p>}
    </article>
  );
}

function SectionBlock({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="report-glass-card reports-daily-section">
      <div className="row reports-section-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p className="muted">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

export function DailyReportPage() {
  const {
    transactions,
    cashSessionHistory,
    currentCashSession,
    appointments,
    stockMovements,
    cashierOpen,
  } = useAppContext();

  const todayKey = toLocalDateKey(new Date());
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);

  const report = useMemo(
    () => buildDailyReportData({
      dateKey: selectedDate,
      transactions,
      cashSessionHistory,
      currentCashSession,
      appointments,
      stockMovements,
    }),
    [selectedDate, transactions, cashSessionHistory, currentCashSession, appointments, stockMovements],
  );

  const isToday = selectedDate === todayKey;

  function handleExportPdf() {
    exportDailyReportPdf(report);
  }

  function toggleSaleDetails(saleId: string) {
    setExpandedSaleId((current) => (current === saleId ? null : saleId));
  }

  return (
    <section className="reports-screen">
      <ReportsBackLink />

      <header className="reports-header row">
        <div>
          <h1>Reporte del dia</h1>
          <p className="muted">Todo lo realizado: ventas, mayoristas, caja, citas e inventario.</p>
        </div>
        <div className="actions reports-header-actions">
          <label className="reports-date-input">
            Fecha
            <input
              type="date"
              value={selectedDate}
              max={todayKey}
              onChange={(event) => {
                setSelectedDate(event.target.value);
                setExpandedSaleId(null);
              }}
            />
          </label>
          <button type="button" className="reports-export-btn" onClick={handleExportPdf}>
            <span className="material-symbols-outlined" aria-hidden>picture_as_pdf</span>
            Exportar PDF
          </button>
          {isToday && (
            <span className={`badge ${cashierOpen ? "success" : "danger"}`}>
              Caja {cashierOpen ? "abierta" : "cerrada"}
            </span>
          )}
        </div>
      </header>

      <section className="report-glass-card reports-live-section">
        <div className="row reports-section-head">
          <div>
            <h2>{report.dateLabel}</h2>
            <p className="muted">Resumen completo del dia seleccionado</p>
          </div>
          {isToday && cashierOpen && <span className="badge success">Dia en curso</span>}
        </div>
        <div className="reports-kpi-grid">
          <KpiCard label="Total vendido" value={currency(report.salesSummary.totalSales)} hint={`${report.salesSummary.saleCount} venta(s)`} />
          <KpiCard label="Efectivo" value={currency(report.salesSummary.cashSales)} />
          <KpiCard label="Transferencia" value={currency(report.salesSummary.transferSales)} />
          <KpiCard label="Descuentos aplicados" value={currency(report.totalDiscountGiven)} hint={`Mayorista: ${currency(report.wholesaleSummary.totalWholesaleDiscount)}`} />
          <KpiCard label="Ventas mayoristas" value={String(report.wholesaleSummary.saleCount)} hint={currency(report.wholesaleSummary.totalSales)} />
          <KpiCard label="Citas" value={String(report.appointments.length)} />
          <KpiCard label="Mov. inventario" value={String(report.stockMovements.length)} />
          <KpiCard label="Cierres de caja" value={String(report.cashSessions.length)} />
        </div>
      </section>

      {report.wholesaleSummary.byClient.length > 0 && (
        <SectionBlock title="Clientes mayoristas" subtitle="Ventas y descuentos por salon">
          <div className="reports-table">
            {report.wholesaleSummary.byClient.map((entry) => (
              <div className="list-item reports-daily-wholesale-row" key={entry.key}>
                <div>
                  <strong>{entry.salon}</strong>
                  {entry.cedula && <p className="muted">Cedula {formatCedulaDisplay(entry.cedula)}</p>}
                </div>
                <span className="muted">{entry.saleCount} venta(s)</span>
                <span>{currency(entry.totalSales)}</span>
                <span className="badge warn">-{currency(entry.totalDiscount)}</span>
              </div>
            ))}
          </div>
        </SectionBlock>
      )}

      <SectionBlock title="Ventas del dia" subtitle="Detalle de cada factura, productos y descuentos">
        {report.transactions.length === 0 ? (
          <p className="muted">No hay ventas registradas en esta fecha.</p>
        ) : (
          <div className="reports-daily-sales">
            {report.transactions.map((transaction) => {
              const isExpanded = expandedSaleId === transaction.id;
              const wholesale = isWholesaleTransaction(transaction);

              return (
                <article className="reports-daily-sale-card" key={transaction.id}>
                  <button
                    type="button"
                    className="reports-daily-sale-head"
                    onClick={() => toggleSaleDetails(transaction.id)}
                  >
                    <div className="reports-daily-sale-main">
                      <strong>#{transaction.id}</strong>
                      <p className="muted">
                        {getWholesaleClientLabel(transaction) ?? transaction.cliente}
                        {transaction.soldAt && ` · ${formatReportDateShort(transaction.soldAt)}`}
                      </p>
                    </div>
                    <div className="reports-daily-sale-tags">
                      <span className={`badge ${wholesale ? "warn" : "success"}`}>{getSaleTypeLabel(transaction)}</span>
                      <span className="badge">{transaction.metodo}</span>
                      <span className={transaction.estado === "Pendiente" ? "badge warn" : "badge success"}>{transaction.estado}</span>
                    </div>
                    <div className="reports-daily-sale-amounts">
                      <strong>{currency(transaction.monto)}</strong>
                      {(transaction.wholesaleDiscountAmount || transaction.discountAmount) ? (
                        <span className="muted reports-daily-discount">{getTransactionDiscountLabel(transaction)}</span>
                      ) : null}
                    </div>
                    <span className="material-symbols-outlined reports-daily-chevron">
                      {isExpanded ? "expand_less" : "expand_more"}
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="reports-daily-sale-body">
                      {transaction.wholesaleSalon && (
                        <p className="muted">
                          Salon: <strong>{transaction.wholesaleSalon}</strong>
                          {transaction.wholesaleCedula && ` · Cedula ${formatCedulaDisplay(transaction.wholesaleCedula)}`}
                          {transaction.wholesaleDiscountPercent && ` · ${transaction.wholesaleDiscountPercent}% desc.`}
                        </p>
                      )}
                      {transaction.subtotal != null && (
                        <p className="muted">
                          Subtotal {currency(transaction.subtotal)}
                          {transaction.listSubtotal != null && transaction.listSubtotal !== transaction.subtotal && (
                            <> · Lista {currency(transaction.listSubtotal)}</>
                          )}
                          {transaction.discountAmount ? <> · Desc. manual {currency(transaction.discountAmount)}</> : null}
                          {transaction.wholesaleDiscountAmount ? <> · Desc. mayorista {currency(transaction.wholesaleDiscountAmount)}</> : null}
                        </p>
                      )}
                      {transaction.note && <p className="muted">Nota: {transaction.note}</p>}

                      {transaction.items && transaction.items.length > 0 ? (
                        <ul className="reports-daily-items">
                          {transaction.items.map((item) => (
                            <li key={`${transaction.id}-${item.productId}`}>
                              <span>{item.nombre}</span>
                              <span className="muted">x{item.cantidad}</span>
                              <span>{currency((item.precioUnitario ?? 0) * item.cantidad)}</span>
                              {item.precioLista != null && item.precioUnitario != null && item.precioLista > item.precioUnitario && (
                                <span className="muted reports-daily-item-list">
                                  lista {currency(item.precioLista)}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="muted">Sin detalle de productos (venta pendiente o sin items).</p>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </SectionBlock>

      {report.currentCashSession && (
        <SectionBlock title="Caja abierta" subtitle="Sesion activa en este dia">
          <p className="muted">
            {report.currentCashSession.id} · Apertura {formatReportDateShort(report.currentCashSession.openedAt)} ·
            {" "}Fondo {currency(report.currentCashSession.openingAmount)}
          </p>
        </SectionBlock>
      )}

      {report.cashSessions.length > 0 && (
        <SectionBlock title="Cierres de caja" subtitle="Sesiones cerradas en el dia">
          <div className="reports-close-list">
            {report.cashSessions.map((session) => (
              <article className="reports-close-card" key={session.id}>
                <div className="row">
                  <strong>{session.id}</strong>
                  <span className="muted">{session.closedAt && formatReportDateShort(session.closedAt)}</span>
                </div>
                {session.closeSummary && (
                  <ul className="reports-close-metrics">
                    <li><span>Total vendido</span><strong>{currency(session.closeSummary.totalSales)}</strong></li>
                    <li><span>Efectivo en caja</span><strong>{currency(session.closeSummary.totalCashInDrawer)}</strong></li>
                    <li><span>Transferencia</span><strong>{currency(session.closeSummary.totalTransferSales)}</strong></li>
                  </ul>
                )}
              </article>
            ))}
          </div>
        </SectionBlock>
      )}

      {report.appointments.length > 0 && (
        <SectionBlock title="Citas del dia" subtitle="Agenda registrada">
          <div className="reports-table">
            {report.appointments.map((appointment) => (
              <div className="list-item" key={appointment.id}>
                <div>
                  <strong>{appointment.cliente}</strong>
                  <p className="muted">{appointment.servicios.join(", ")}</p>
                </div>
                <span className="badge">{appointment.hora}</span>
                <span>{currency(appointment.total)}</span>
              </div>
            ))}
          </div>
        </SectionBlock>
      )}

      {report.stockMovements.length > 0 && (
        <SectionBlock title="Movimientos de inventario" subtitle="Entradas y salidas del dia">
          <div className="reports-table">
            {report.stockMovements.map((movement) => (
              <div className="list-item" key={movement.id}>
                <div>
                  <strong>{movement.nombre}</strong>
                  <p className="muted">{movement.motivo}</p>
                </div>
                <span className={`badge ${movement.tipo === "entrada" ? "success" : "warn"}`}>{movement.tipo}</span>
                <span>{movement.cantidad} u.</span>
                <span className="muted">{formatReportDateShort(movement.fecha)}</span>
              </div>
            ))}
          </div>
        </SectionBlock>
      )}
    </section>
  );
}
