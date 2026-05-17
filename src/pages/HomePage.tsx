import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const adminLinks = [
  { to: "/punto-venta", label: "Ir a Punto de Venta" },
  { to: "/inventario", label: "Ir a Inventario" },
  { to: "/reportes", label: "Ir a Reportes" },
  { to: "/agenda", label: "Ir a Agenda" },
  { to: "/configuracion", label: "Ir a Configuracion" },
];

const cajaLinks = [
  { to: "/punto-venta", label: "Ir a Punto de Venta" },
  { to: "/inventario", label: "Ir a Inventario" },
  { to: "/agenda", label: "Ir a Agenda" },
];

export function HomePage() {
  const { isAdmin } = useAuth();
  const links = isAdmin ? adminLinks : cajaLinks;

  return (
    <section className="home-screen">
      <div className="home-header">
        <div className="home-hero-brand">
          <img src="/logo.jpeg" alt="Logo Lexy Essence" />
          <div>
            <p className="home-badge">Gestion de Salon y Belleza</p>
            <h1>Panel General</h1>
          </div>
        </div>
        <p className="muted">Centro operativo de Lexy Essence con acceso a todas las areas clave.</p>
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
