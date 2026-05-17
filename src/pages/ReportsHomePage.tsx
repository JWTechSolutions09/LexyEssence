import { Link } from "react-router-dom";

const reportOptions = [
  {
    to: "/reportes/caja",
    title: "Reportes de Caja",
    description: "Ventas del dia, efectivo, transferencias y cierres de caja.",
    icon: "point_of_sale",
  },
  {
    to: "/reportes/inventario",
    title: "Reportes Inventario",
    description: "Valor del inventario, costos y ganancias potenciales.",
    icon: "inventory_2",
  },
];

export function ReportsHomePage() {
  return (
    <section className="reports-home-screen">
      <header className="reports-home-header">
        <h1>Reportes</h1>
        <p className="muted">Selecciona el tipo de reporte que deseas consultar.</p>
      </header>

      <div className="reports-home-grid">
        {reportOptions.map((option) => (
          <Link className="reports-home-card" key={option.to} to={option.to}>
            <span className="material-symbols-outlined reports-home-icon">{option.icon}</span>
            <div>
              <h2>{option.title}</h2>
              <p className="muted">{option.description}</p>
            </div>
            <span className="material-symbols-outlined reports-home-chevron">chevron_right</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
