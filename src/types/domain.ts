export type Product = {
  id: string;
  nombre: string;
  categoria: string;
  precio: number;
  stock: number;
};

export type CartItem = Product & { cantidad: number };

export type Transaction = {
  id: string;
  cliente: string;
  monto: number;
  metodo: string;
  estado: string;
};

export type Appointment = {
  hora: string;
  cliente: string;
  servicio: string;
};

export type Supplier = {
  id: string;
  nombre: string;
  contacto: string;
  estado: "Activo" | "Pendiente";
};
