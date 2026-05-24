import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  checkApiReachable,
  clearOfflinePendingSync,
  isNetworkFailure,
  isRecoverableLoadFailure,
  loadOfflineSnapshot,
  saveOfflineSnapshot,
} from "../api/offlineStore";
import {
  ApiError,
  fetchAppState,
  migrateAppState,
  saveAppState,
  type AppStatePayload,
} from "../api/client";
import { clearLocalAppState, readLocalAppState } from "../api/localMigration";
import { initialAppointments, initialProducts, initialSuppliers, initialTransactions } from "../data/mockData";
import type { CashCloseSummary, CashSession } from "../types/cashSession";
import type {
  Appointment,
  CartItem,
  Product,
  StockMovement,
  Supplier,
  Transaction,
  WholesaleClient,
} from "../types/domain";
import { normalizeCedula } from "../utils/wholesaleClient";
import { useAuth } from "./AuthContext";

type AppContextValue = {
  products: Product[];
  setProducts: Dispatch<SetStateAction<Product[]>>;
  cart: CartItem[];
  setCart: Dispatch<SetStateAction<CartItem[]>>;
  transactions: Transaction[];
  setTransactions: Dispatch<SetStateAction<Transaction[]>>;
  stockMovements: StockMovement[];
  appendStockMovements: (movements: StockMovement[]) => void;
  appointments: Appointment[];
  setAppointments: Dispatch<SetStateAction<Appointment[]>>;
  suppliers: Supplier[];
  setSuppliers: Dispatch<SetStateAction<Supplier[]>>;
  cashierOpen: boolean;
  setCashierOpen: Dispatch<SetStateAction<boolean>>;
  currentCashSession: CashSession | null;
  cashSessionHistory: CashSession[];
  openCashSession: (openingAmount: number, openedAt: string) => void;
  closeCashSession: (summary: CashCloseSummary, closedAt: string) => void;
  notice: string;
  setNotice: Dispatch<SetStateAction<string>>;
  clearNotice: () => void;
  isAppLoading: boolean;
  isAppSaving: boolean;
  isHydrated: boolean;
  isOfflineMode: boolean;
  pendingCloudSync: boolean;
  appLoadError: string | null;
  appSaveError: string | null;
  saveRetryCount: number;
  forceSave: () => Promise<boolean>;
  retrySave: () => Promise<boolean>;
  wholesaleClients: WholesaleClient[];
  addWholesaleClient: (cedula: string, salon: string) => WholesaleClient | { error: string };
  updateWholesaleClient: (id: string, input: { cedula: string; salon: string }) => { ok: true } | { ok: false; error: string };
  deleteWholesaleClient: (id: string) => { ok: true } | { ok: false; error: string };
  findWholesaleClientByCedula: (cedula: string) => WholesaleClient | undefined;
};

const SAVE_RETRY_DELAYS_MS = [1000, 2000, 4000];
const MAX_SAVE_RETRIES = SAVE_RETRY_DELAYS_MS.length;
const LOCAL_PERSIST_MS = 150;
const CLOUD_SYNC_MS = 400;

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function fetchAppStateWithRetry() {
  const maxAttempts = 12;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fetchAppState();
    } catch (error) {
      const waitingForDb = error instanceof ApiError
        && (error.status === 503 || /conectando con supabase/i.test(error.message));
      if (!waitingForDb && !isRecoverableLoadFailure(error)) throw error;
      if (attempt === maxAttempts - 1) throw error;
      await sleep(1500);
    }
  }

  throw new Error("Timeout esperando Supabase.");
}

const AppContext = createContext<AppContextValue | null>(null);

function applyAppState(
  state: AppStatePayload,
  setters: {
    setProducts: Dispatch<SetStateAction<Product[]>>;
    setTransactions: Dispatch<SetStateAction<Transaction[]>>;
    setAppointments: Dispatch<SetStateAction<Appointment[]>>;
    setStockMovements: Dispatch<SetStateAction<StockMovement[]>>;
    setCurrentCashSession: Dispatch<SetStateAction<CashSession | null>>;
    setCashSessionHistory: Dispatch<SetStateAction<CashSession[]>>;
    setCashierOpen: Dispatch<SetStateAction<boolean>>;
    setWholesaleClients: Dispatch<SetStateAction<WholesaleClient[]>>;
  },
) {
  setters.setProducts(state.products);
  setters.setTransactions(state.transactions);
  setters.setAppointments(state.appointments);
  setters.setStockMovements(state.stockMovements);
  setters.setCurrentCashSession(state.currentCashSession);
  setters.setCashSessionHistory(state.cashSessionHistory);
  setters.setCashierOpen(Boolean(state.currentCashSession));
  setters.setWholesaleClients(state.wholesaleClients ?? []);
}

function normalizePayload(state: AppStatePayload): AppStatePayload {
  return {
    ...state,
    wholesaleClients: state.wholesaleClients ?? [],
  };
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, logout } = useAuth();

  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>(initialAppointments);
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers);
  const [currentCashSession, setCurrentCashSession] = useState<CashSession | null>(null);
  const [cashSessionHistory, setCashSessionHistory] = useState<CashSession[]>([]);
  const [wholesaleClients, setWholesaleClients] = useState<WholesaleClient[]>([]);
  const [cashierOpen, setCashierOpen] = useState(false);
  const [notice, setNotice] = useState("");

  const [isAppLoading, setIsAppLoading] = useState(false);
  const [isAppSaving, setIsAppSaving] = useState(false);
  const [appLoadError, setAppLoadError] = useState<string | null>(null);
  const [appSaveError, setAppSaveError] = useState<string | null>(null);
  const [saveRetryCount, setSaveRetryCount] = useState(0);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [pendingCloudSync, setPendingCloudSync] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  const saveTimerRef = useRef<number | null>(null);
  const localTimerRef = useRef<number | null>(null);
  const saveInFlightRef = useRef(false);
  const pendingSaveRef = useRef(false);
  const latestPayloadRef = useRef<AppStatePayload>({
    products: initialProducts,
    transactions: initialTransactions,
    appointments: initialAppointments,
    stockMovements: [],
    currentCashSession: null,
    cashSessionHistory: [],
    wholesaleClients: [],
  });

  const buildPayload = useCallback((): AppStatePayload => ({
    products,
    transactions,
    appointments,
    stockMovements,
    currentCashSession,
    cashSessionHistory,
    wholesaleClients,
  }), [products, transactions, appointments, stockMovements, currentCashSession, cashSessionHistory, wholesaleClients]);

  useEffect(() => {
    latestPayloadRef.current = buildPayload();
  }, [buildPayload]);

  const persistLocalSnapshot = useCallback(async (payload: AppStatePayload, cloudPending: boolean) => {
    await saveOfflineSnapshot(normalizePayload(payload), cloudPending);
    setPendingCloudSync(cloudPending);
  }, []);

  const performSave = useCallback(async (attempt = 0): Promise<boolean> => {
    const payload = normalizePayload(latestPayloadRef.current);

    try {
      await saveOfflineSnapshot(payload, true);
    } catch {
      setAppSaveError("No se pudo guardar una copia local de seguridad.");
      return false;
    }

    try {
      await saveAppState(payload);
      await clearOfflinePendingSync(payload);
      setAppSaveError(null);
      setSaveRetryCount(0);
      setIsOfflineMode(false);
      setPendingCloudSync(false);
      return true;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        logout();
        return false;
      }

      if (isNetworkFailure(error)) {
        setIsOfflineMode(true);
        setPendingCloudSync(true);
        setAppSaveError(null);
        setSaveRetryCount(0);
        return true;
      }

      // HTTP response means the local API is reachable — not a browser offline state.
      setIsOfflineMode(false);

      const message = error instanceof ApiError
        ? `HTTP ${error.status} — ${error.message}`
        : (error instanceof Error ? error.message : "No se pudo guardar en la base de datos.");

      const shouldRetry = attempt < MAX_SAVE_RETRIES
        && (error instanceof ApiError && error.status >= 500 || isRecoverableLoadFailure(error));

      if (shouldRetry) {
        setSaveRetryCount(attempt + 1);
        setAppSaveError(`${message} · Reintentando (${attempt + 1}/${MAX_SAVE_RETRIES})...`);
        await sleep(SAVE_RETRY_DELAYS_MS[attempt]);
        return performSave(attempt + 1);
      }

      setSaveRetryCount(MAX_SAVE_RETRIES);
      setAppSaveError(message);
      setPendingCloudSync(true);
      setNotice("Los cambios estan guardados localmente, pero no en Supabase. Reintenta cuando puedas.");
      return false;
    }
  }, [logout, setNotice]);

  const flushSave = useCallback(async (): Promise<boolean> => {
    if (!isAuthenticated || !isHydrated || isAppLoading || appLoadError) return false;

    if (saveInFlightRef.current) {
      pendingSaveRef.current = true;
      return false;
    }

    saveInFlightRef.current = true;
    setIsAppSaving(true);

    let success = false;

    try {
      success = await performSave();
    } finally {
      saveInFlightRef.current = false;
      setIsAppSaving(false);

      if (pendingSaveRef.current) {
        pendingSaveRef.current = false;
        const pendingSuccess = await flushSave();
        success = pendingSuccess || success;
      }
    }

    return success;
  }, [isAuthenticated, isHydrated, isAppLoading, appLoadError, performSave]);

  const forceSave = useCallback(async (): Promise<boolean> => {
    if (!isAuthenticated || !isHydrated || isAppLoading || appLoadError) return false;

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    await sleep(50);
    return flushSave();
  }, [isAuthenticated, isHydrated, isAppLoading, appLoadError, flushSave]);

  const retrySave = useCallback(async (): Promise<boolean> => {
    setSaveRetryCount(0);
    setAppSaveError(null);
    return forceSave();
  }, [forceSave]);

  useEffect(() => {
    if (!isAuthenticated) {
      setIsHydrated(false);
      setIsAppLoading(false);
      setAppLoadError(null);
      setAppSaveError(null);
      setSaveRetryCount(0);
      setIsOfflineMode(false);
      setPendingCloudSync(false);
      setCart([]);
      return;
    }

    let cancelled = false;

    async function tryLoadOfflineCopy() {
      const offline = await loadOfflineSnapshot();
      if (!offline?.payload) return false;

      const normalizedState = normalizePayload(offline.payload);
      applyAppState(normalizedState, {
        setProducts,
        setTransactions,
        setAppointments,
        setStockMovements,
        setCurrentCashSession,
        setCashSessionHistory,
        setCashierOpen,
        setWholesaleClients,
      });
      latestPayloadRef.current = normalizedState;
      setIsOfflineMode(true);
      setPendingCloudSync(offline.pendingCloudSync);
      setIsHydrated(true);
      setNotice("No hay conexion con Supabase. Trabajando con la copia local de esta PC.");
      return true;
    }

    async function loadFromDatabase() {
      setIsAppLoading(true);
      setAppLoadError(null);
      setIsHydrated(false);

      try {
        let state = await fetchAppStateWithRetry();
        const localSnapshot = readLocalAppState();

        if (localSnapshot) {
          const migration = await migrateAppState(localSnapshot);
          if (migration.migrated) {
            state = migration.state;
            setNotice("Datos locales migrados a la base de datos.");
          }
        }

        clearLocalAppState();

        if (cancelled) return;

        const normalizedState = normalizePayload(state);
        await saveOfflineSnapshot(normalizedState, false);

        applyAppState(normalizedState, {
          setProducts,
          setTransactions,
          setAppointments,
          setStockMovements,
          setCurrentCashSession,
          setCashSessionHistory,
          setCashierOpen,
          setWholesaleClients,
        });
        latestPayloadRef.current = normalizedState;
        setIsOfflineMode(false);
        setPendingCloudSync(false);
        setIsHydrated(true);
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 401) {
          logout();
          return;
        }

        if (isRecoverableLoadFailure(error)) {
          if (await tryLoadOfflineCopy()) return;

          setAppLoadError(
            "No hay conexion con Supabase y no hay copia local. "
            + "Asegurate de que `npm run dev` este corriendo y conecta internet al menos una vez.",
          );
          return;
        }

        if (await tryLoadOfflineCopy()) return;

        setIsHydrated(false);
        setAppLoadError(error instanceof Error ? error.message : "Error al cargar datos.");
      } finally {
        if (!cancelled) setIsAppLoading(false);
      }
    }

    loadFromDatabase();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, logout]);

  useEffect(() => {
    if (!isAuthenticated || !isHydrated || isAppLoading || appLoadError) return;

    if (localTimerRef.current) {
      window.clearTimeout(localTimerRef.current);
    }

    localTimerRef.current = window.setTimeout(() => {
      void persistLocalSnapshot(latestPayloadRef.current, pendingCloudSync || isOfflineMode);
    }, LOCAL_PERSIST_MS);

    return () => {
      if (localTimerRef.current) {
        window.clearTimeout(localTimerRef.current);
      }
    };
  }, [
    isAuthenticated,
    isHydrated,
    isAppLoading,
    appLoadError,
    pendingCloudSync,
    isOfflineMode,
    persistLocalSnapshot,
    products,
    transactions,
    appointments,
    stockMovements,
    currentCashSession,
    cashSessionHistory,
    wholesaleClients,
  ]);

  useEffect(() => {
    if (!isAuthenticated || !isHydrated || isAppLoading || appLoadError) return;

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      void flushSave();
    }, CLOUD_SYNC_MS);

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [
    isAuthenticated,
    isHydrated,
    isAppLoading,
    appLoadError,
    flushSave,
    products,
    transactions,
    appointments,
    stockMovements,
    currentCashSession,
    cashSessionHistory,
    wholesaleClients,
  ]);

  useEffect(() => {
    if (!isAuthenticated || !isHydrated) return;

    async function trySyncOnline() {
      if (!pendingCloudSync && !isOfflineMode && !appSaveError) return;

      const reachable = await checkApiReachable();
      if (!reachable) {
        if (!navigator.onLine) setIsOfflineMode(true);
        return;
      }

      setIsOfflineMode(false);
      const synced = await flushSave();
      if (synced) {
        setNotice("Datos sincronizados con Supabase.");
      }
    }

    function handleOnline() {
      setIsOfflineMode(false);
      void trySyncOnline();
    }

    window.addEventListener("online", handleOnline);
    const interval = window.setInterval(() => {
      void trySyncOnline();
    }, 8000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.clearInterval(interval);
    };
  }, [isAuthenticated, isHydrated, pendingCloudSync, isOfflineMode, appSaveError, flushSave, setNotice]);

  const appendStockMovements = useCallback((movements: StockMovement[]) => {
    if (movements.length === 0) return;
    setStockMovements((prev) => [...movements, ...prev]);
  }, []);

  const openCashSession = useCallback((openingAmount: number, openedAt: string) => {
    const session: CashSession = {
      id: `CAJA-${Date.now().toString().slice(-8)}`,
      openedAt,
      openingAmount,
    };
    setCurrentCashSession(session);
    setCashierOpen(true);
  }, []);

  const closeCashSession = useCallback((summary: CashCloseSummary, closedAt: string) => {
    setCurrentCashSession((prev) => {
      if (!prev) return null;

      const closed: CashSession = {
        ...prev,
        closedAt,
        closeSummary: summary,
      };

      setCashSessionHistory((history) => [closed, ...history]);
      return null;
    });
    setCashierOpen(false);
  }, []);

  const findWholesaleClientByCedula = useCallback((cedula: string) => {
    const normalized = normalizeCedula(cedula);
    return wholesaleClients.find((client) => normalizeCedula(client.cedula) === normalized);
  }, [wholesaleClients]);

  const addWholesaleClient = useCallback((cedula: string, salon: string): WholesaleClient | { error: string } => {
    const normalized = normalizeCedula(cedula);
    const trimmedSalon = salon.trim();

    if (!normalized) return { error: "La cedula es obligatoria." };
    if (!trimmedSalon) return { error: "El nombre del salon es obligatorio." };

    const existing = wholesaleClients.find((client) => normalizeCedula(client.cedula) === normalized);
    if (existing) return existing;

    const client: WholesaleClient = {
      id: `wc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      cedula: normalized,
      salon: trimmedSalon,
    };

    setWholesaleClients((prev) => [...prev, client]);
    return client;
  }, [wholesaleClients]);

  const updateWholesaleClient = useCallback((
    id: string,
    input: { cedula: string; salon: string },
  ): { ok: true } | { ok: false; error: string } => {
    const normalized = normalizeCedula(input.cedula);
    const trimmedSalon = input.salon.trim();

    if (!normalized) return { ok: false, error: "La cedula es obligatoria." };
    if (!trimmedSalon) return { ok: false, error: "El nombre del salon es obligatorio." };

    const duplicate = wholesaleClients.find(
      (client) => client.id !== id && normalizeCedula(client.cedula) === normalized,
    );
    if (duplicate) return { ok: false, error: "Ya existe un cliente con esa cedula." };

    setWholesaleClients((prev) => prev.map((client) => (
      client.id === id
        ? { ...client, cedula: normalized, salon: trimmedSalon }
        : client
    )));

    return { ok: true };
  }, [wholesaleClients]);

  const deleteWholesaleClient = useCallback((id: string): { ok: true } | { ok: false; error: string } => {
    const target = wholesaleClients.find((client) => client.id === id);
    if (!target) return { ok: false, error: "Cliente no encontrado." };

    setWholesaleClients((prev) => prev.filter((client) => client.id !== id));
    return { ok: true };
  }, [wholesaleClients]);

  const value = useMemo<AppContextValue>(() => ({
    products,
    setProducts,
    cart,
    setCart,
    transactions,
    setTransactions,
    stockMovements,
    appendStockMovements,
    appointments,
    setAppointments,
    suppliers,
    setSuppliers,
    cashierOpen,
    setCashierOpen,
    currentCashSession,
    cashSessionHistory,
    openCashSession,
    closeCashSession,
    notice,
    setNotice,
    clearNotice: () => setNotice(""),
    isAppLoading,
    isAppSaving,
    isHydrated,
    isOfflineMode,
    pendingCloudSync,
    appLoadError,
    appSaveError,
    saveRetryCount,
    forceSave,
    retrySave,
    wholesaleClients,
    addWholesaleClient,
    updateWholesaleClient,
    deleteWholesaleClient,
    findWholesaleClientByCedula,
  }), [
    products,
    cart,
    transactions,
    stockMovements,
    appendStockMovements,
    appointments,
    suppliers,
    cashierOpen,
    currentCashSession,
    cashSessionHistory,
    openCashSession,
    closeCashSession,
    notice,
    isAppLoading,
    isAppSaving,
    isHydrated,
    isOfflineMode,
    pendingCloudSync,
    appLoadError,
    appSaveError,
    saveRetryCount,
    forceSave,
    retrySave,
    wholesaleClients,
    addWholesaleClient,
    updateWholesaleClient,
    deleteWholesaleClient,
    findWholesaleClientByCedula,
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) throw new Error("useAppContext debe usarse dentro de AppProvider.");
  return context;
}
