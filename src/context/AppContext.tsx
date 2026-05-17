import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
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
} from "../types/domain";
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
  appLoadError: string | null;
};

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
  },
) {
  setters.setProducts(state.products);
  setters.setTransactions(state.transactions);
  setters.setAppointments(state.appointments);
  setters.setStockMovements(state.stockMovements);
  setters.setCurrentCashSession(state.currentCashSession);
  setters.setCashSessionHistory(state.cashSessionHistory);
  setters.setCashierOpen(Boolean(state.currentCashSession));
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();

  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>(initialAppointments);
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers);
  const [currentCashSession, setCurrentCashSession] = useState<CashSession | null>(null);
  const [cashSessionHistory, setCashSessionHistory] = useState<CashSession[]>([]);
  const [cashierOpen, setCashierOpen] = useState(false);
  const [notice, setNotice] = useState("");

  const [isAppLoading, setIsAppLoading] = useState(false);
  const [isAppSaving, setIsAppSaving] = useState(false);
  const [appLoadError, setAppLoadError] = useState<string | null>(null);

  const hydratedRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);

  const buildPayload = useCallback((): AppStatePayload => ({
    products,
    transactions,
    appointments,
    stockMovements,
    currentCashSession,
    cashSessionHistory,
  }), [products, transactions, appointments, stockMovements, currentCashSession, cashSessionHistory]);

  useEffect(() => {
    if (!isAuthenticated) {
      hydratedRef.current = false;
      setIsAppLoading(false);
      setAppLoadError(null);
      setCart([]);
      return;
    }

    let cancelled = false;

    async function loadFromDatabase() {
      setIsAppLoading(true);
      setAppLoadError(null);

      try {
        let state = await fetchAppState();
        const localSnapshot = readLocalAppState();

        if (localSnapshot) {
          const migration = await migrateAppState(localSnapshot);
          if (migration.migrated) {
            state = migration.state;
            clearLocalAppState();
            setNotice("Datos locales migrados a la base de datos.");
          }
        }

        if (cancelled) return;

        applyAppState(state, {
          setProducts,
          setTransactions,
          setAppointments,
          setStockMovements,
          setCurrentCashSession,
          setCashSessionHistory,
          setCashierOpen,
        });
        hydratedRef.current = true;
      } catch (error) {
        if (cancelled) return;
        hydratedRef.current = false;
        setAppLoadError(error instanceof Error ? error.message : "Error al cargar datos.");
      } finally {
        if (!cancelled) setIsAppLoading(false);
      }
    }

    loadFromDatabase();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !hydratedRef.current || isAppLoading || appLoadError) return;

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(async () => {
      setIsAppSaving(true);
      try {
        await saveAppState(buildPayload());
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "No se pudo guardar en la base de datos.");
      } finally {
        setIsAppSaving(false);
      }
    }, 600);

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [
    isAuthenticated,
    isAppLoading,
    appLoadError,
    buildPayload,
    products,
    transactions,
    appointments,
    stockMovements,
    currentCashSession,
    cashSessionHistory,
  ]);

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
    appLoadError,
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
    appLoadError,
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) throw new Error("useAppContext debe usarse dentro de AppProvider.");
  return context;
}
