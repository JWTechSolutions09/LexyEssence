import { useMemo } from "react";
import { ReportsBackLink } from "../components/ReportsBackLink";
import { useAppContext } from "../context/AppContext";
import { exportInventoryReportPdf } from "../utils/exportInventoryReportPdf";
import { currency } from "../utils/format";
import {
  computeInventorySummary,
  getLeastSellingProducts,
  getLowStockProducts,
  getTopSellingProducts,
  type ProductSalesStat,
} from "../utils/inventoryMetrics";

function KpiCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <article className="report-glass-card reports-kpi-card">
      <span className="kpi-label">{label}</span>
      <strong className="kpi-value">{value}</strong>
      {hint && <p className="muted reports-kpi-hint">{hint}</p>}
    </article>
  );
}

function SalesList({
  title,
  items,
  emptyMessage,
  highlight = "default",
}: {
  title: string;
  items: ProductSalesStat[];
  emptyMessage: string;
  highlight?: "top" | "low" | "default";
}) {
  return (
    <section className="report-glass-card reports-inventory-block">
      <h2>{title}</h2>
      {items.length === 0 ? (
        <p className="muted">{emptyMessage}</p>
      ) : (
        <ul className="reports-sales-list">
          {items.map((item, index) => (
            <li className={`reports-sales-item reports-sales-item-${highlight}`} key={item.productId}>
              <span className="reports-sales-rank">{index + 1}</span>
              <div className="reports-sales-info">
                <strong>{item.nombre}</strong>
                <p className="muted">{item.productId}</p>
              </div>
              <span className="reports-sales-qty">
                <strong>{item.unitsSold}</strong>
                <span className="muted"> vendido(s)</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function InventoryReportsPage() {
  const { products, transactions, stockMovements } = useAppContext();

  const summary = useMemo(() => computeInventorySummary(products), [products]);
  const topSelling = useMemo(() => getTopSellingProducts(products, transactions), [products, transactions]);
  const leastSelling = useMemo(() => getLeastSellingProducts(products, transactions), [products, transactions]);
  const lowStock = useMemo(() => getLowStockProducts(products), [products]);

  const topProducts = useMemo(
    () => [...products]
      .filter((product) => product.stock > 0)
      .sort((a, b) => (b.stock * b.precio) - (a.stock * a.precio))
      .slice(0, 8),
    [products],
  );

  function handleExportPdf() {
    exportInventoryReportPdf({ products, transactions, stockMovements });
  }

  return (
    <section className="reports-screen">
      <ReportsBackLink />

      <header className="reports-header row">
        <div>
          <h1>Reportes Inventario</h1>
          <p className="muted">
            Valoracion del inventario, ventas por producto y alertas de stock.
          </p>
        </div>
        <div className="actions reports-header-actions">
          <button type="button" className="reports-export-btn" onClick={handleExportPdf}>
            <span className="material-symbols-outlined" aria-hidden>picture_as_pdf</span>
            Exportar PDF
          </button>
        </div>
      </header>

      <div className="reports-kpi-grid">
        <KpiCard
          label="Valor total del inventario"
          value={currency(summary.totalValue)}
          hint="Stock x precio de venta"
        />
        <KpiCard
          label="Costo del inventario"
          value={currency(summary.totalCost)}
          hint="Stock x costo unitario"
        />
        <KpiCard
          label="Ganancias"
          value={currency(summary.totalProfit)}
          hint="Stock x (precio - costo)"
        />
        <KpiCard
          label="Unidades en stock"
          value={String(summary.totalUnits)}
          hint={`${summary.productCount} producto(s) registrado(s)`}
        />
      </div>

      <div className="reports-inventory-panels">
        <SalesList
          title="Producto mas vendido"
          items={topSelling}
          emptyMessage="Aun no hay ventas registradas con detalle de productos."
          highlight="top"
        />
        <SalesList
          title="Producto menos vendido"
          items={leastSelling}
          emptyMessage="No hay productos para comparar."
          highlight="low"
        />
      </div>

      <section className="report-glass-card reports-inventory-block">
        <h2>Productos por agotarse</h2>
        <p className="muted reports-section-sub">Stock en o por debajo del minimo configurado.</p>
        {lowStock.length === 0 ? (
          <p className="muted">Ningun producto esta por agotarse en este momento.</p>
        ) : (
          <ul className="reports-sales-list">
            {lowStock.map((entry) => (
              <li className="reports-sales-item reports-sales-item-warn" key={entry.product.id}>
                <span className="material-symbols-outlined reports-warn-icon">warning</span>
                <div className="reports-sales-info">
                  <strong>{entry.product.nombre}</strong>
                  <p className="muted">{entry.product.id} · Min. {entry.stockMinimo}</p>
                </div>
                <span className="reports-sales-qty">
                  <strong>{entry.stock}</strong>
                  <span className="muted"> en stock</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="report-glass-card">
        <h2>Detalle por producto</h2>
        <p className="muted reports-section-sub">
          Productos con stock disponible, ordenados por mayor valor en inventario.
        </p>

        {topProducts.length === 0 ? (
          <p className="muted">No hay productos con stock para mostrar.</p>
        ) : (
          <div className="reports-inventory-table">
            <div className="reports-inventory-head">
              <span>Producto</span>
              <span>Stock</span>
              <span>Valor</span>
              <span>Costo</span>
              <span>Ganancia</span>
            </div>
            {topProducts.map((product) => {
              const value = product.stock * product.precio;
              const cost = product.stock * product.costo;
              const profit = product.stock * (product.precio - product.costo);

              return (
                <div className="reports-inventory-row" key={product.id}>
                  <div>
                    <strong>{product.nombre}</strong>
                    <p className="muted">{product.id}</p>
                  </div>
                  <span>{product.stock}</span>
                  <span>{currency(value)}</span>
                  <span>{currency(cost)}</span>
                  <strong>{currency(profit)}</strong>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </section>
  );
}
