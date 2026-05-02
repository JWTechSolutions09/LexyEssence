import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";

export function Layout({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { setNotice } = useAppContext();

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-left">
          <button
            className="mobile-menu-btn"
            type="button"
            aria-label="Abrir menu"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
          >
            <span className="material-symbols-outlined">{mobileMenuOpen ? "close" : "menu"}</span>
          </button>
          <img className="brand-logo-img" src="/logo.jpeg" alt="Logo Lexy Essence" />
          <span className="brand">Lexy Essence</span>
          <nav className="topbar-links">
            <NavLink to="/reportes">Reportes de Caja</NavLink>
            <NavLink to="/inventario">Inventario</NavLink>
            <NavLink to="/punto-venta">Punto de Venta</NavLink>
          </nav>
        </div>
        <div className="topbar-right">
          <div className="search-wrap">
            <span className="material-symbols-outlined">search</span>
            <input placeholder="Buscar productos o servicios..." />
          </div>
          <button
            className="icon-btn"
            type="button"
            aria-label="Notificaciones"
            onClick={() => setNotice("No tienes notificaciones nuevas.")}
          >
            <span className="material-symbols-outlined">notifications</span>
          </button>
          <button
            className="icon-btn"
            type="button"
            aria-label="Recibos"
            onClick={() => navigate("/reportes")}
          >
            <span className="material-symbols-outlined">receipt_long</span>
          </button>
        </div>
      </header>
      <aside className={`sidebar ${mobileMenuOpen ? "mobile-open" : ""}`}>
        <div className="sidebar-brand">
          <img className="sidebar-logo-img" src="/logo.jpeg" alt="Logo Lexy Essence" />
          <h2>Lexy Essence</h2>
        </div>
        <p>Suite de Gestión</p>
        <nav>
          <NavLink to="/" onClick={() => setMobileMenuOpen(false)}><span className="material-symbols-outlined">dashboard</span>Inicio</NavLink>
          <NavLink to="/punto-venta" onClick={() => setMobileMenuOpen(false)}><span className="material-symbols-outlined">point_of_sale</span>Punto de Venta</NavLink>
          <NavLink to="/inventario" onClick={() => setMobileMenuOpen(false)}><span className="material-symbols-outlined">inventory_2</span>Inventario</NavLink>
          <NavLink to="/reportes" onClick={() => setMobileMenuOpen(false)}><span className="material-symbols-outlined">analytics</span>Reportes</NavLink>
          <NavLink to="/agenda" onClick={() => setMobileMenuOpen(false)}><span className="material-symbols-outlined">event</span>Agenda</NavLink>
          <NavLink to="/proveedores" onClick={() => setMobileMenuOpen(false)}><span className="material-symbols-outlined">conveyor_belt</span>Proveedores</NavLink>
          <NavLink to="/configuracion" onClick={() => setMobileMenuOpen(false)}><span className="material-symbols-outlined">settings</span>Configuración</NavLink>
        </nav>
        <button className="sidebar-cta" type="button" onClick={() => navigate("/punto-venta")}>Nueva Venta</button>
      </aside>
      {mobileMenuOpen ? <button className="mobile-backdrop" onClick={() => setMobileMenuOpen(false)} aria-label="Cerrar menu" /> : null}
      <main className="content">{children}</main>
    </div>
  );
}
