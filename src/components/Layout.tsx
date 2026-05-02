import { NavLink } from "react-router-dom";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-left">
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
          <button className="icon-btn" type="button" aria-label="Notificaciones">
            <span className="material-symbols-outlined">notifications</span>
          </button>
          <button className="icon-btn" type="button" aria-label="Recibos">
            <span className="material-symbols-outlined">receipt_long</span>
          </button>
        </div>
      </header>
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img className="sidebar-logo-img" src="/logo.jpeg" alt="Logo Lexy Essence" />
          <h2>Lexy Essence</h2>
        </div>
        <p>Suite de Gestión</p>
        <nav>
          <NavLink to="/"><span className="material-symbols-outlined">dashboard</span>Inicio</NavLink>
          <NavLink to="/punto-venta"><span className="material-symbols-outlined">point_of_sale</span>Punto de Venta</NavLink>
          <NavLink to="/inventario"><span className="material-symbols-outlined">inventory_2</span>Inventario</NavLink>
          <NavLink to="/reportes"><span className="material-symbols-outlined">analytics</span>Reportes</NavLink>
          <NavLink to="/agenda"><span className="material-symbols-outlined">event</span>Agenda</NavLink>
          <NavLink to="/proveedores"><span className="material-symbols-outlined">conveyor_belt</span>Proveedores</NavLink>
          <NavLink to="/configuracion"><span className="material-symbols-outlined">settings</span>Configuración</NavLink>
        </nav>
        <button className="sidebar-cta" type="button">Nueva Venta</button>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
