import { useAppContext } from "../context/AppContext";

function getErrorTitle(message: string) {
  if (/http 502|http 503|http 504|ehostunreach|etimedout/i.test(message)) {
    return "Supabase no responde";
  }
  return "No se pudo guardar en Supabase";
}

export function SaveStatusBanner() {
  const {
    isAppSaving,
    appSaveError,
    saveRetryCount,
    retrySave,
    isAppLoading,
    isHydrated,
    isOfflineMode,
    pendingCloudSync,
  } = useAppContext();

  if (isAppLoading || !isHydrated) return null;

  if (appSaveError) {
    return (
      <div className="save-status-banner save-status-banner-error" role="alert">
        <div className="save-status-banner-content">
          <span className="material-symbols-outlined" aria-hidden>cloud_off</span>
          <div>
            <strong>{getErrorTitle(appSaveError)}</strong>
            <p className="muted">
              {appSaveError}
              {saveRetryCount > 0 && ` · Reintentos automaticos: ${saveRetryCount}`}
            </p>
            <p className="muted">Tus cambios siguen guardados en esta PC.</p>
          </div>
        </div>
        <button type="button" onClick={() => void retrySave()} disabled={isAppSaving}>
          {isAppSaving ? "Reintentando..." : "Reintentar ahora"}
        </button>
      </div>
    );
  }

  if (isOfflineMode || pendingCloudSync) {
    return (
      <div className="save-status-banner save-status-banner-offline" role="status" aria-live="polite">
        <div className="save-status-banner-content">
          <span className="material-symbols-outlined" aria-hidden>wifi_off</span>
          <div>
            <strong>{navigator.onLine ? "Pendiente de sincronizar" : "Modo sin internet"}</strong>
            <p className="muted">
              {navigator.onLine
                ? "Hay internet, pero Supabase aun no responde. Los cambios estan en esta PC y se sincronizaran automaticamente."
                : "Puedes seguir vendiendo. Los cambios se guardan en esta PC y se sincronizaran con Supabase al reconectar."}
            </p>
          </div>
        </div>
        <button type="button" onClick={() => void retrySave()} disabled={isAppSaving}>
          {isAppSaving ? "Sincronizando..." : "Sincronizar ahora"}
        </button>
      </div>
    );
  }

  if (isAppSaving) {
    return (
      <div className="save-status-banner save-status-banner-saving" role="status" aria-live="polite">
        <span className="material-symbols-outlined save-status-spinner" aria-hidden>sync</span>
        <span>Guardando cambios en Supabase...</span>
      </div>
    );
  }

  return null;
}
