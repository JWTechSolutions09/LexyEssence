import { useCallback, useEffect, useState } from "react";
import { fetchApiHealth } from "../api/offlineStore";
import { useAppContext } from "../context/AppContext";

type CloudUiStatus = "ok" | "syncing" | "pending" | "error" | "offline";

export function NavSyncStatus() {
  const {
    isHydrated,
    isAppLoading,
    isAppSaving,
    appSaveError,
    pendingCloudSync,
    retrySave,
  } = useAppContext();

  const [cloudOk, setCloudOk] = useState<boolean | null>(null);

  const refreshHealth = useCallback(async () => {
    const health = await fetchApiHealth();
    setCloudOk(health?.cloudOk === true);
  }, []);

  useEffect(() => {
    if (!isHydrated || isAppLoading) return;

    void refreshHealth();
    const interval = window.setInterval(() => {
      void refreshHealth();
    }, 10_000);

    return () => window.clearInterval(interval);
  }, [isHydrated, isAppLoading, refreshHealth, isAppSaving, pendingCloudSync]);

  if (!isHydrated || isAppLoading) return null;

  let cloudStatus: CloudUiStatus = "ok";
  let cloudLabel = "Nube OK";
  let cloudTitle = "Supabase sincronizado";

  if (!navigator.onLine) {
    cloudStatus = "offline";
    cloudLabel = "Sin red";
    cloudTitle = "Sin internet. Datos en SQL Server local.";
  } else if (appSaveError) {
    cloudStatus = "error";
    cloudLabel = "Nube error";
    cloudTitle = appSaveError;
  } else if (isAppSaving || (pendingCloudSync && cloudOk)) {
    cloudStatus = "syncing";
    cloudLabel = "Sincronizando";
    cloudTitle = "Copiando cambios a Supabase...";
  } else if (pendingCloudSync) {
    cloudStatus = "pending";
    cloudLabel = "Nube pend.";
    cloudTitle = "Guardado en SQL Server. Supabase se actualizara al reconectar.";
  } else if (cloudOk === false) {
    cloudStatus = "pending";
    cloudLabel = "Nube pend.";
    cloudTitle = "Supabase no responde. Datos en SQL Server local.";
  }

  const canRetry = cloudStatus === "pending" || cloudStatus === "error";

  return (
    <div className="nav-sync-status" role="status" aria-live="polite">
      <span
        className="nav-sync-pill nav-sync-pill-local"
        title="SQL Server local (LexyLocal)"
      >
        <span className="nav-sync-dot" aria-hidden />
        Local
      </span>
      <button
        type="button"
        className={`nav-sync-pill nav-sync-pill-cloud nav-sync-pill-${cloudStatus}`}
        title={cloudTitle}
        disabled={!canRetry || isAppSaving}
        onClick={() => {
          if (canRetry) void retrySave();
        }}
      >
        <span className={`nav-sync-dot ${cloudStatus === "syncing" ? "nav-sync-dot-spin" : ""}`} aria-hidden />
        {cloudLabel}
      </button>
    </div>
  );
}
