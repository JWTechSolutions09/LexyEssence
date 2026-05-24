import { useAppContext } from "../context/AppContext";

export function SaveErrorOverlay() {
  const { appSaveError, isAppLoading, isHydrated, isOfflineMode } = useAppContext();

  if (isAppLoading || !isHydrated || !appSaveError || isOfflineMode) return null;

  return <div className="save-error-overlay" aria-hidden />;
}
