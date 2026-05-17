export type Product = {
  id: string;
  nombre: string;
  marca: string;
  descripcion: string;
  categoria: string;
  costo: number;
  precio: number;
  precioMayorista: number;
  stock: number;
  stockMinimo: number;
};

export type CartItem = Product & { cantidad: number };

export type TransactionItem = {
  productId: string;
  nombre: string;
  cantidad: number;
};

export type Transaction = {
  id: string;
  cliente: string;
  monto: number;
  metodo: string;
  estado: string;
  soldAt?: string;
  items?: TransactionItem[];
};

export type Appointment = {
  id: string;
  date: string;
  hora: string;
  cliente: string;
  servicios: string[];
  total: number;
};

export type Supplier = {
  id: string;
  nombre: string;
  contacto: string;
  estado: "Activo" | "Pendiente";
};

export type StockMovementType = "entrada" | "salida";

export type StockMovement = {
  id: string;
  tipo: StockMovementType;
  productId: string;
  nombre: string;
  cantidad: number;
  motivo: string;
  fecha: string;
  referencia?: string;
};
