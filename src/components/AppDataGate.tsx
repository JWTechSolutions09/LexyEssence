import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAppContext } from "../context/AppContext";

function describeLoadError(message: string) {
  if (/sesion|session|autorizado|401/i.test(message)) {
    return {
      title: "Sesion expirada",
      hint: null,
      showLogin: true,
    };
  }

  if (/ehostunreach|enotfound|econnrefused|etimedout|connect/i.test(message)) {
    return {
      title: "No se pudo conectar con Supabase",
      hint: "Supabase es tu base de datos en la nube. El servidor local (npm run dev) es el puente entre la app y Supabase. Si ya tienes copia local, recarga; si no, verifica internet y que npm run dev este activo.",
      showLogin: false,
    };
  }

  if (/failed to fetch|network|load failed|servidor api/i.test(message)) {
    return {
      title: "Servidor local no disponible",
      hint: "La app necesita el servidor local en localhost:3001. En la PC del negocio ejecuta: npm run dev",
      showLogin: false,
    };
  }

  return {
    title: "No se pudo cargar la base de datos",
    hint: "Supabase guarda tus datos. El servidor local (npm run dev) conecta la app con Supabase. Verifica que este corriendo e intenta de nuevo.",
    showLogin: false,
  };
}

export function AppDataGate({ children }: { children: ReactNode }) {
  const { isAppLoading, appLoadError } = useAppContext();

  if (isAppLoading) {
    return (
      <div className="app-loading-screen">
        <div className="app-loading-card card">
          <span className="material-symbols-outlined app-loading-icon" aria-hidden>database</span>
          <h2>Cargando datos</h2>
          <p className="muted">Conectando con Supabase...</p>
        </div>
      </div>
    );
  }

  if (appLoadError) {
    const details = describeLoadError(appLoadError);

    return (
      <div className="app-loading-screen">
        <div className="app-loading-card card">
          <span className="material-symbols-outlined app-loading-icon danger" aria-hidden>error</span>
          <h2>{details.title}</h2>
          <p className="muted">{appLoadError}</p>
          {details.hint && <p className="muted">{details.hint}</p>}
          {details.showLogin ? (
            <Link className="login-submit-btn app-loading-action" to="/login">Volver a iniciar sesion</Link>
          ) : (
            <button type="button" className="login-submit-btn app-loading-action" onClick={() => window.location.reload()}>
              Reintentar
            </button>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
