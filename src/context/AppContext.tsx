import { createContext, useContext, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { initialAppointments, initialProducts, initialSuppliers, initialTransactions } from "../data/mockData";
import type { Appointment, CartItem, Product, Supplier, Transaction } from "../types/domain";

type AppContextValue = {
  products: Product[];
  setProducts: Dispatch<SetStateAction<Product[]>>;
  cart: CartItem[];
  setCart: Dispatch<SetStateAction<CartItem[]>>;
  transactions: Transaction[];
  setTransactions: Dispatch<SetStateAction<Transaction[]>>;
  appointments: Appointment[];
  setAppointments: Dispatch<SetStateAction<Appointment[]>>;
  suppliers: Supplier[];
  setSuppliers: Dispatch<SetStateAction<Supplier[]>>;
  cashierOpen: boolean;
  setCashierOpen: Dispatch<SetStateAction<boolean>>;
  notice: string;
  setNotice: Dispatch<SetStateAction<string>>;
  clearNotice: () => void;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
  const [appointments, setAppointments] = useState<Appointment[]>(initialAppointments);
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers);
  const [cashierOpen, setCashierOpen] = useState(false);
  const [notice, setNotice] = useState("");

  const value = useMemo<AppContextValue>(() => ({
    products,
    setProducts,
    cart,
    setCart,
    transactions,
    setTransactions,
    appointments,
    setAppointments,
    suppliers,
    setSuppliers,
    cashierOpen,
    setCashierOpen,
    notice,
    setNotice,
    clearNotice: () => setNotice(""),
  }), [products, cart, transactions, appointments, suppliers, cashierOpen, notice]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) throw new Error("useAppContext debe usarse dentro de AppProvider.");
  return context;
}
