import type { Appointment, Product, Supplier, Transaction } from "../types/domain";

export const initialProducts: Product[] = [
  { id: "LEX-GS-001", nombre: "Elixir Rosa Medianoche", categoria: "Cuidado de Piel", precio: 120, stock: 85 },
  { id: "LEX-HM-042", nombre: "Bruma Esencia Hidratante", categoria: "Cosméticos", precio: 45, stock: 12 },
  { id: "LEX-VC-088", nombre: "Crema Noche Terciopelo", categoria: "Cuidado de Piel", precio: 85, stock: 0 },
  { id: "LEX-BR-015", nombre: "Brocha Precisión Seda", categoria: "Herramientas", precio: 32, stock: 142 },
];

export const initialTransactions: Transaction[] = [];

export const initialAppointments: Appointment[] = [
  { hora: "10:00", cliente: "Julianne Smith", servicio: "Facial Premium" },
  { hora: "13:30", cliente: "Elena Vance", servicio: "Terapia Capilar" },
];

export const initialSuppliers: Supplier[] = [
  { id: "SUP-001", nombre: "Rose Beauty Imports", contacto: "ventas@rosebeauty.com", estado: "Activo" },
  { id: "SUP-002", nombre: "Skincare Elite DR", contacto: "contacto@skincareelite.do", estado: "Activo" },
  { id: "SUP-003", nombre: "Nova Salon Tools", contacto: "hola@novasalontools.com", estado: "Pendiente" },
];
