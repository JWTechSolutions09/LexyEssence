import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { SaveErrorOverlay } from "./SaveErrorOverlay";
import { SaveStatusBanner } from "./SaveStatusBanner";
import { AppDataGate } from "./AppDataGate";
import { useAppContext } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";

const adminNavItems = [
  { to: "/", label: "Inicio", icon: "dashboard" },
  { to: "/punto-venta", label: "Punto de Venta", icon: "point_of_sale" },
  { to: "/inventario", label: "Inventario", icon: "inventory_2" },
  { to: "/clientes-mayoristas", label: "Mayoristas", icon: "groups" },
  { to: "/reportes", label: "Reportes", icon: "analytics" },
  { to: "/agenda", label: "Agenda", icon: "event" },
  { to: "/configuracion", label: "Configuracion", icon: "settings" },
];

const cajaNavItems = [
  { to: "/punto-venta", label: "Punto de Venta", icon: "point_of_sale" },
  { to: "/inventario", label: "Inventario", icon: "inventory_2" },
  { to: "/agenda", label: "Agenda", icon: "event" },
];

export function Layout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { setNotice, isAppSaving, appSaveError, isOfflineMode } = useAppContext();
  const { user, isAdmin, logout } = useAuth();

  const navItems = isAdmin ? adminNavItems : cajaNavItems;

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

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
          {isAdmin && (
            <nav className="topbar-links">
              <NavLink to="/reportes">Reportes</NavLink>
              <NavLink to="/inventario">Inventario</NavLink>
              <NavLink to="/punto-venta">Punto de Venta</NavLink>
            </nav>
          )}
        </div>
        <div className="topbar-right">
          {isAdmin && (
            <div className="search-wrap">
              <span className="material-symbols-outlined">search</span>
              <input placeholder="Buscar productos o servicios..." />
            </div>
          )}
          <span className="topbar-user muted">
            {user?.displayName}
            {isAppSaving && <span className="db-saving-badge"> · Guardando...</span>}
            {isOfflineMode && navigator.onLine === false && (
              <span className="db-offline-badge"> · Sin internet</span>
            )}
            {isOfflineMode && navigator.onLine && (
              <span className="db-offline-badge"> · Sin conexion a Supabase</span>
            )}
            {appSaveError && !isOfflineMode && (
              <span className="db-error-badge"> · Sin guardar en nube</span>
            )}
          </span>
          {isAdmin && (
            <>
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
            </>
          )}
          <button className="ghost topbar-logout-btn" type="button" onClick={handleLogout}>
            Salir
          </button>
        </div>
      </header>
      <aside className={`sidebar ${mobileMenuOpen ? "mobile-open" : ""}`}>
        <nav>
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} onClick={() => setMobileMenuOpen(false)}>
              <span className="material-symbols-outlined">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button className="sidebar-cta" type="button" onClick={() => navigate("/punto-venta")}>
          Nueva Venta
        </button>
        <button className="ghost sidebar-logout-btn" type="button" onClick={handleLogout}>
          Cerrar sesion
        </button>
      </aside>
      {mobileMenuOpen ? <button className="mobile-backdrop" onClick={() => setMobileMenuOpen(false)} aria-label="Cerrar menu" /> : null}
      <main className={`content ${appSaveError && !isOfflineMode ? "content-save-blocked" : ""}`}>
        <SaveStatusBanner />
        <SaveErrorOverlay />
        <AppDataGate>
          <Outlet />
        </AppDataGate>
      </main>
    </div>
  );
}
