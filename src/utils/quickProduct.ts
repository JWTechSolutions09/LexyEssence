import { normalizeScanCode } from "../hooks/useBarcodeScanner";
import type { Product } from "../types/domain";

export type QuickScanProductDraft = {
  id: string;
  nombre: string;
  precio: string;
  stock: string;
};

export function buildQuickProductFromScan(
  draft: QuickScanProductDraft,
  existingProducts: Product[],
): { product: Product } | { error: string } {
  const id = normalizeScanCode(draft.id).toUpperCase();
  const nombre = draft.nombre.trim();
  const precio = Number(draft.precio);
  const stock = Number(draft.stock);

  if (!id) {
    return { error: "El codigo escaneado no es valido." };
  }

  if (!nombre) {
    return { error: "Escribe el nombre del producto." };
  }

  if (!Number.isFinite(precio) || precio < 0) {
    return { error: "El precio debe ser un numero mayor o igual a 0." };
  }

  if (!Number.isInteger(stock) || stock < 0) {
    return { error: "El stock debe ser un numero entero mayor o igual a 0." };
  }

  const duplicate = existingProducts.some((product) => product.id.toUpperCase() === id);
  if (duplicate) {
    return { error: "Ese codigo ya existe en el inventario." };
  }

  const precioMayorista = precio > 0 ? Math.round(precio * 0.85 * 100) / 100 : 0;

  return {
    product: {
      id,
      nombre,
      marca: "Sin marca",
      descripcion: "",
      categoria: "General",
      costo: 0,
      precio,
      precioMayorista,
      stock,
      stockMinimo: 1,
    },
  };
}
