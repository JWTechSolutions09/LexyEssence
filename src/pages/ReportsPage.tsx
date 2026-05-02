import { useAppContext } from "../context/AppContext";
import { currency } from "../utils/format";

export function ReportsPage() {
  const { transactions, setNotice, cashierOpen, setCashierOpen } = useAppContext();
  const total = transactions.reduce((acc, t) => acc + t.monto, 0);
  const tableData = transactions.length
    ? transactions
    : [
        { id: "TXN-84291", cliente: "Julianne Smith", monto: 185, metodo: "Visa terminación 4291", estado: "Completada" },
        { id: "TXN-84292", cliente: "Marcus Aurelius", monto: 75, metodo: "Pago en efectivo", estado: "Completada" },
        { id: "TXN-84293", cliente: "Elena Vance", monto: 120, metodo: "Transferencia bancaria", estado: "Pendiente" },
        { id: "TXN-84294", cliente: "Kevin Durant", monto: 50, metodo: "MasterCard 8821", estado: "Completada" },
      ];

  return (
    <section className="reports-screen">
      <div className="reports-header row">
        <div>
          <h1>Gestión de Caja</h1>
          <p className="muted">Rendimiento financiero en tiempo real y control de caja para Lexy Essence.</p>
        </div>
        <div className="actions">
          <button onClick={() => { setCashierOpen(true); setNotice("Caja abierta."); }}>
            <span className="material-symbols-outlined">lock_open</span>
            Abrir Caja
          </button>
          <button className="ghost" onClick={() => { setCashierOpen(false); setNotice("Caja cerrada."); }}>
            <span className="material-symbols-outlined">lock</span>
            Cerrar Caja
          </button>
        </div>
      </div>

      <div className="reports-kpi-grid">
        <div className="report-glass-card">
          <span className="kpi-label">VENTAS TOTALES</span>
          <strong className="kpi-value">{currency(total || 12482)}</strong>
        </div>
        <div className="report-glass-card">
          <span className="kpi-label">EFECTIVO EN CAJA</span>
          <strong className="kpi-value">{currency((total || 12482) * 0.25)}</strong>
        </div>
        <div className="report-glass-card">
          <span className="kpi-label">PAGOS CON TARJETA</span>
          <strong className="kpi-value">{currency((total || 12482) * 0.716)}</strong>
        </div>
        <div className="report-glass-card">
          <span className="kpi-label">TRANSFERENCIAS</span>
          <strong className="kpi-value">{currency((total || 12482) * 0.034)}</strong>
        </div>
      </div>

      <div className="reports-main-grid">
        <div className="report-glass-card chart-card">
          <div className="row">
            <h3>Tendencias de Ingresos</h3>
            <div className="actions">
              <button onClick={() => setNotice("Vista diaria seleccionada.")}>Diario</button>
              <button className="ghost" onClick={() => setNotice("Vista semanal seleccionada.")}>Semanal</button>
              <button className="ghost" onClick={() => setNotice("Vista mensual seleccionada.")}>Mensual</button>
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
          <span className="promo-tag">Estándar Premium</span>
          <h4>Refinando la Esencia de la Belleza</h4>
          <p>Gestionando el flujo del lujo con precisión y serenidad estética.</p>
          <p className="muted">Estado de caja: {cashierOpen ? "Abierta" : "Cerrada"}</p>
        </div>
      </div>

      <div className="report-glass-card">
        <div className="row">
          <h3>Transacciones Recientes</h3>
          <button className="ghost" onClick={() => setNotice("Estado completo abierto (demo).")}>
            Ver Estado Completo
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
              <span className={t.estado === "Pendiente" ? "badge warn" : "badge"}>{t.estado}</span>
            </div>
          ))}
          {transactions.length === 0 && (
            <div>
              <p className="muted">Mostrando datos demo. Completa una venta en POS para reemplazar estas filas.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
