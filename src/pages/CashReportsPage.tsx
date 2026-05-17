import { useMemo, useState } from "react";
import { ReportsBackLink } from "../components/ReportsBackLink";
import { useAppContext } from "../context/AppContext";
import { currency } from "../utils/format";
import { buildCashReportPdfInput, exportCashReportPdf } from "../utils/exportCashReportPdf";
import {
  formatReportDateShort,
  getCashSessionsForDate,
  getCashSessionsForMonth,
  getDailyBreakdownForMonth,
  getTodayCashInDrawer,
  getTransactionsForDate,
  getTransactionsForMonth,
  getYesterdayDateKey,
  summarizeTransactions,
  toLocalDateKey,
} from "../utils/reportMetrics";

type ReportFilter = "today" | "yesterday" | "date" | "month";

function KpiCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <article className="report-glass-card reports-kpi-card">
      <span className="kpi-label">{label}</span>
      <strong className="kpi-value">{value}</strong>
      {hint && <p className="muted reports-kpi-hint">{hint}</p>}
    </article>
  );
}

function SummaryGrid({ summary }: { summary: ReturnType<typeof summarizeTransactions> }) {
  return (
    <div className="reports-kpi-grid reports-kpi-grid-compact">
      <KpiCard label="Total vendido" value={currency(summary.totalSales)} />
      <KpiCard label="Efectivo" value={currency(summary.cashSales)} />
      <KpiCard label="Transferencia" value={currency(summary.transferSales)} />
      <KpiCard label="Ventas" value={String(summary.saleCount)} hint={summary.pendingSales > 0 ? `Pendiente: ${currency(summary.pendingSales)}` : undefined} />
    </div>
  );
}

export function CashReportsPage() {
  const {
    transactions,
    cashierOpen,
    currentCashSession,
    cashSessionHistory,
  } = useAppContext();

  const todayKey = toLocalDateKey(new Date());
  const yesterdayKey = getYesterdayDateKey();

  const [filter, setFilter] = useState<ReportFilter>("today");
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [selectedMonth, setSelectedMonth] = useState(todayKey.slice(0, 7));

  const todayTransactions = useMemo(
    () => getTransactionsForDate(transactions, todayKey),
    [transactions, todayKey],
  );
  const todaySummary = useMemo(() => summarizeTransactions(todayTransactions), [todayTransactions]);
  const todayCashInDrawer = useMemo(
    () => getTodayCashInDrawer(transactions, currentCashSession, cashSessionHistory, todayKey),
    [transactions, currentCashSession, cashSessionHistory, todayKey],
  );

  const yesterdayTransactions = useMemo(
    () => getTransactionsForDate(transactions, yesterdayKey),
    [transactions, yesterdayKey],
  );
  const yesterdaySummary = useMemo(() => summarizeTransactions(yesterdayTransactions), [yesterdayTransactions]);
  const yesterdayCloses = useMemo(
    () => getCashSessionsForDate(cashSessionHistory, yesterdayKey),
    [cashSessionHistory, yesterdayKey],
  );

  const filteredTransactions = useMemo(() => {
    if (filter === "today") return getTransactionsForDate(transactions, todayKey);
    if (filter === "yesterday") return getTransactionsForDate(transactions, yesterdayKey);
    if (filter === "date") return getTransactionsForDate(transactions, selectedDate);
    return getTransactionsForMonth(transactions, selectedMonth);
  }, [filter, selectedDate, selectedMonth, todayKey, yesterdayKey, transactions]);

  const filteredSummary = useMemo(
    () => summarizeTransactions(filteredTransactions),
    [filteredTransactions],
  );

  const filteredCloses = useMemo(() => {
    if (filter === "today") return getCashSessionsForDate(cashSessionHistory, todayKey);
    if (filter === "yesterday") return yesterdayCloses;
    if (filter === "date") return getCashSessionsForDate(cashSessionHistory, selectedDate);
    return getCashSessionsForMonth(cashSessionHistory, selectedMonth);
  }, [filter, selectedDate, selectedMonth, cashSessionHistory, todayKey, yesterdayCloses]);

  const monthBreakdown = useMemo(() => {
    if (filter !== "month") return [];
    return getDailyBreakdownForMonth(transactions, selectedMonth);
  }, [filter, selectedMonth, transactions]);

  const filterLabel = useMemo(() => {
    if (filter === "today") return "Hoy";
    if (filter === "yesterday") return "Ayer";
    if (filter === "date") {
      return new Intl.DateTimeFormat("es-DO", { dateStyle: "full" }).format(new Date(`${selectedDate}T12:00:00`));
    }
    return new Intl.DateTimeFormat("es-DO", { month: "long", year: "numeric" }).format(new Date(`${selectedMonth}-01T12:00:00`));
  }, [filter, selectedDate, selectedMonth]);

  const sortedFilteredTransactions = useMemo(
    () => [...filteredTransactions].sort((a, b) => {
      const aTime = a.soldAt ? new Date(a.soldAt).getTime() : 0;
      const bTime = b.soldAt ? new Date(b.soldAt).getTime() : 0;
      return bTime - aTime;
    }),
    [filteredTransactions],
  );

  function handleExportPdf() {
    exportCashReportPdf(buildCashReportPdfInput({
      periodLabel: filterLabel,
      todaySummary,
      todayCashInDrawer,
      yesterdaySummary,
      yesterdayCloses,
      filteredCloses,
      filteredTransactions: sortedFilteredTransactions,
      monthBreakdown,
    }));
  }

  return (
    <section className="reports-screen">
      <ReportsBackLink />

      <header className="reports-header row">
        <div>
          <h1>Reportes de Caja</h1>
          <p className="muted">Ventas del dia, cierres de caja y consultas por fecha o mes.</p>
        </div>
        <div className="actions reports-header-actions">
          <button type="button" className="reports-export-btn" onClick={handleExportPdf}>
            <span className="material-symbols-outlined" aria-hidden>picture_as_pdf</span>
            Exportar PDF
          </button>
          <span className={`badge ${cashierOpen ? "success" : "danger"}`}>
            Caja {cashierOpen ? "abierta" : "cerrada"}
          </span>
        </div>
      </header>

      <section className="report-glass-card reports-live-section">
        <div className="row reports-section-head">
          <div>
            <h2>Ventas del dia</h2>
            <p className="muted">Actual · {new Intl.DateTimeFormat("es-DO", { dateStyle: "full" }).format(new Date())}</p>
          </div>
          {cashierOpen && <span className="badge success">En curso</span>}
        </div>
        <div className="reports-kpi-grid">
          <KpiCard
            label="Ventas del dia"
            value={currency(todaySummary.totalSales)}
            hint={`${todaySummary.saleCount} venta(s) completada(s)`}
          />
          <KpiCard label="Total general vendido" value={currency(todaySummary.totalSales)} />
          <KpiCard label="Total efectivo en caja" value={currency(todayCashInDrawer)} />
          <KpiCard label="Total pago por transferencia" value={currency(todaySummary.transferSales)} />
        </div>
      </section>

      <section className="report-glass-card">
        <h2>Ventas del dia anterior</h2>
        <p className="muted reports-section-sub">
          {new Intl.DateTimeFormat("es-DO", { dateStyle: "full" }).format(new Date(`${yesterdayKey}T12:00:00`))}
        </p>
        <SummaryGrid summary={yesterdaySummary} />

        {yesterdayCloses.length > 0 ? (
          <div className="reports-close-list">
            <h3>Cierres de caja</h3>
            {yesterdayCloses.map((session) => (
              <article className="reports-close-card" key={session.id}>
                <div className="row">
                  <strong>{session.id}</strong>
                  <span className="muted">{formatReportDateShort(session.closedAt!)}</span>
                </div>
                {session.closeSummary && (
                  <ul className="reports-close-metrics">
                    <li><span>Vendido al cierre</span><strong>{currency(session.closeSummary.totalSales)}</strong></li>
                    <li><span>Efectivo en caja</span><strong>{currency(session.closeSummary.totalCashInDrawer)}</strong></li>
                    <li><span>Transferencia</span><strong>{currency(session.closeSummary.totalTransferSales)}</strong></li>
                    <li><span>Fondo inicial</span><span>{currency(session.closeSummary.openingAmount)}</span></li>
                  </ul>
                )}
              </article>
            ))}
          </div>
        ) : (
          <p className="muted">No hay cierres de caja registrados para el dia anterior.</p>
        )}
      </section>

      <section className="report-glass-card reports-filter-section">
        <div className="row reports-section-head">
          <div>
            <h2>Consultar por fecha</h2>
            <p className="muted">Filtra ventas y cierres · {filterLabel}</p>
          </div>
        </div>

        <div className="reports-filter-bar">
          <div className="actions reports-filter-presets">
            <button type="button" className={filter === "today" ? "" : "ghost"} onClick={() => setFilter("today")}>Hoy</button>
            <button type="button" className={filter === "yesterday" ? "" : "ghost"} onClick={() => setFilter("yesterday")}>Ayer</button>
            <button type="button" className={filter === "date" ? "" : "ghost"} onClick={() => setFilter("date")}>Por fecha</button>
            <button type="button" className={filter === "month" ? "" : "ghost"} onClick={() => setFilter("month")}>Este mes</button>
          </div>

          {filter === "date" && (
            <label className="reports-date-input">
              Fecha
              <input
                type="date"
                value={selectedDate}
                max={todayKey}
                onChange={(event) => setSelectedDate(event.target.value)}
              />
            </label>
          )}

          {filter === "month" && (
            <label className="reports-date-input">
              Mes
              <input
                type="month"
                value={selectedMonth}
                max={todayKey.slice(0, 7)}
                onChange={(event) => setSelectedMonth(event.target.value)}
              />
            </label>
          )}
        </div>

        <SummaryGrid summary={filteredSummary} />

        {filter === "month" && monthBreakdown.length > 0 && (
          <div className="reports-month-days">
            <h3>Ventas por dia del mes</h3>
            <div className="reports-month-table">
              {monthBreakdown.map(({ dateKey, summary }) => (
                <div className="reports-month-row" key={dateKey}>
                  <span>{new Intl.DateTimeFormat("es-DO", { day: "numeric", month: "short" }).format(new Date(`${dateKey}T12:00:00`))}</span>
                  <span>{summary.saleCount} ventas</span>
                  <strong>{currency(summary.totalSales)}</strong>
                  <span className="muted">{currency(summary.cashSales)} ef.</span>
                  <span className="muted">{currency(summary.transferSales)} trans.</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {filteredCloses.length > 0 && (
          <div className="reports-close-list">
            <h3>Cierres de caja ({filterLabel})</h3>
            {filteredCloses.map((session) => (
              <article className="reports-close-card" key={session.id}>
                <div className="row">
                  <strong>{session.id}</strong>
                  <span className="muted">{formatReportDateShort(session.closedAt!)}</span>
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
        )}

        <div className="reports-table-section">
          <h3>Ventas ({filterLabel})</h3>
          {sortedFilteredTransactions.length === 0 ? (
            <p className="muted">No hay ventas registradas en este periodo.</p>
          ) : (
            <div className="reports-table">
              {sortedFilteredTransactions.map((transaction) => (
                <div className="list-item" key={transaction.id}>
                  <div>
                    <strong>#{transaction.id}</strong>
                    <p className="muted">{transaction.cliente}</p>
                    {transaction.soldAt && (
                      <p className="muted reports-tx-time">{formatReportDateShort(transaction.soldAt)}</p>
                    )}
                  </div>
                  <span className="muted">{transaction.metodo}</span>
                  <span>{currency(transaction.monto)}</span>
                  <span className={transaction.estado === "Pendiente" ? "badge warn" : "badge success"}>
                    {transaction.estado}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </section>
  );
}
