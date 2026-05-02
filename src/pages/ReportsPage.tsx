import { useAppContext } from "../context/AppContext";
import { currency } from "../utils/format";

export function ReportsPage() {
  const { transactions, setNotice, cashierOpen, setCashierOpen } = useAppContext();
  const total = transactions.reduce((acc, t) => acc + t.monto, 0);
  const tableData = transactions.length
    ? transactions
    : [
        { id: "TXN-84291", cliente: "Julianne Smith", monto: 185, metodo: "Visa Ending 4291", estado: "Completed" },
        { id: "TXN-84292", cliente: "Marcus Aurelius", monto: 75, metodo: "Cash Payment", estado: "Completed" },
        { id: "TXN-84293", cliente: "Elena Vance", monto: 120, metodo: "Bank Transfer", estado: "Pending" },
        { id: "TXN-84294", cliente: "Kevin Durant", monto: 50, metodo: "MasterCard 8821", estado: "Completed" },
      ];

  return (
    <section className="reports-screen">
      <div className="reports-header row">
        <div>
          <h1>Cash Management</h1>
          <p className="muted">Real-time financial performance and register controls for Lexy Essence.</p>
        </div>
        <div className="actions">
          <button onClick={() => { setCashierOpen(true); setNotice("Cashier opened."); }}>
            <span className="material-symbols-outlined">lock_open</span>
            Open Cashier
          </button>
          <button className="ghost" onClick={() => { setCashierOpen(false); setNotice("Cashier closed."); }}>
            <span className="material-symbols-outlined">lock</span>
            Close Cashier
          </button>
        </div>
      </div>

      <div className="reports-kpi-grid">
        <div className="report-glass-card">
          <span className="kpi-label">TOTAL SALES</span>
          <strong className="kpi-value">{currency(total || 12482)}</strong>
        </div>
        <div className="report-glass-card">
          <span className="kpi-label">CASH ON HAND</span>
          <strong className="kpi-value">{currency((total || 12482) * 0.25)}</strong>
        </div>
        <div className="report-glass-card">
          <span className="kpi-label">CARD PAYMENTS</span>
          <strong className="kpi-value">{currency((total || 12482) * 0.716)}</strong>
        </div>
        <div className="report-glass-card">
          <span className="kpi-label">TRANSFERS</span>
          <strong className="kpi-value">{currency((total || 12482) * 0.034)}</strong>
        </div>
      </div>

      <div className="reports-main-grid">
        <div className="report-glass-card chart-card">
          <div className="row">
            <h3>Revenue Trends</h3>
            <div className="actions">
              <button onClick={() => setNotice("Daily view selected.")}>Daily</button>
              <button className="ghost" onClick={() => setNotice("Weekly view selected.")}>Weekly</button>
              <button className="ghost" onClick={() => setNotice("Monthly view selected.")}>Monthly</button>
            </div>
          </div>
          <div className="chart-bars">
            <div style={{ height: "40%" }} />
            <div style={{ height: "65%" }} />
            <div style={{ height: "85%" }} />
            <div style={{ height: "55%" }} />
            <div style={{ height: "75%" }} />
            <div style={{ height: "35%" }} />
            <div style={{ height: "95%" }} />
          </div>
        </div>
        <div className="report-glass-card promo-card">
          <span className="promo-tag">Premium Standard</span>
          <h4>Refining the Essence of Beauty</h4>
          <p>Managing the flow of luxury with precision and aesthetic serenity.</p>
          <p className="muted">Cashier status: {cashierOpen ? "Open" : "Closed"}</p>
        </div>
      </div>

      <div className="report-glass-card">
        <div className="row">
          <h3>Recent Transactions</h3>
          <button className="ghost" onClick={() => setNotice("Full statement opened (demo).")}>
            View Full Statement
          </button>
        </div>
        <div className="reports-table">
          {tableData.map((t) => (
            <div className="list-item" key={t.id}>
              <div>
                <strong>#{t.id}</strong>
                <p className="muted">{t.cliente}</p>
              </div>
              <span className="muted">{t.metodo}</span>
              <span>{currency(t.monto)}</span>
              <span className={t.estado === "Pending" ? "badge warn" : "badge"}>{t.estado}</span>
            </div>
          ))}
          {transactions.length === 0 && (
            <div>
              <p className="muted">Showing demo data. Complete a sale in POS to replace these rows.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
