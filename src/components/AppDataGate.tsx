import type { ReactNode } from "react";
import { useAppContext } from "../context/AppContext";

export function AppDataGate({ children }: { children: ReactNode }) {
  const { isAppLoading, appLoadError } = useAppContext();

  if (isAppLoading) {
    return (
      <div className="app-loading-screen">
        <div className="app-loading-card card">
          <span className="material-symbols-outlined app-loading-icon" aria-hidden>database</span>
          <h2>Cargando datos</h2>
          <p className="muted">Conectando con la base de datos...</p>
        </div>
      </div>
    );
  }

  if (appLoadError) {
    return (
      <div className="app-loading-screen">
        <div className="app-loading-card card">
          <span className="material-symbols-outlined app-loading-icon danger" aria-hidden>error</span>
          <h2>No se pudo cargar la base de datos</h2>
          <p className="muted">{appLoadError}</p>
          <p className="muted">Verifica que el servidor API este en ejecucion (`npm run dev`).</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
