import { Link } from "react-router-dom";

export function HomePage() {
  const links = [
    { to: "/punto-venta", label: "Ir a Punto de Venta" },
    { to: "/inventario", label: "Ir a Inventario" },
    { to: "/reportes", label: "Ir a Reportes" },
    { to: "/agenda", label: "Ir a Agenda" },
    { to: "/proveedores", label: "Ir a Proveedores" },
    { to: "/configuracion", label: "Ir a Configuración" },
  ];

  return (
    <section className="home-screen">
      <div className="home-header">
        <div className="home-hero-brand">
          <img src="/logo.jpeg" alt="Logo Lexy Essence" />
          <div>
            <p className="home-badge">Salon & Beauty Management</p>
            <h1>Panel General</h1>
          </div>
        </div>
        <p className="muted">Centro operativo de Lexy Essence con acceso a todas las áreas clave.</p>
      </div>
      <div className="home-grid">
        {links.map((item) => (
          <Link className="home-card" key={item.to} to={item.to}>
            <span>{item.label}</span>
            <span className="material-symbols-outlined">chevron_right</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
