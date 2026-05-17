export type ReceiptItem = {
  id: string;
  nombre: string;
  marca: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
};

export type SaleReceipt = {
  invoiceNumber: string;
  soldAt: string;
  customerName: string;
  paymentMethod: string;
  pricingMode: "detalle" | "mayorista";
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  amountPaid?: number;
  change?: number;
  note: string;
  items: ReceiptItem[];
};
