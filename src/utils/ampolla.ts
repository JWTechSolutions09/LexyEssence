import type { AmpollaVentaTipo, CartItem, Product } from "../types/domain";
import type { WholesaleDiscountPercent } from "../types/domain";
import { computeWholesaleUnitPrice } from "./wholesaleClient";

export const AMPOOLLA_CATEGORY = "Ampollas";

export function isAmpolla(product: Pick<Product, "esAmpolla">): boolean {
  return product.esAmpolla === true;
}

export function calcularCajasDisponibles(stockUnidades: number, unidadesPorCaja: number): number {
  if (unidadesPorCaja < 1) return 0;
  return Math.floor(stockUnidades / unidadesPorCaja);
}

export function calcularUnidadesSueltas(stockUnidades: number, unidadesPorCaja: number): number {
  if (unidadesPorCaja < 1) return stockUnidades;
  return stockUnidades % unidadesPorCaja;
}

export function formatAmpollaStockLabel(product: Product): string {
  if (!isAmpolla(product)) {
    return `${product.stock} unidades`;
  }

  const unidadesPorCaja = Math.max(1, product.unidadesPorCaja ?? 1);
  const cajas = calcularCajasDisponibles(product.stock, unidadesPorCaja);
  const sueltas = calcularUnidadesSueltas(product.stock, unidadesPorCaja);

  if (sueltas > 0) {
    return `${product.stock} unidades · ${cajas} caja(s) + ${sueltas} suelta(s)`;
  }

  return `${product.stock} unidades · ${cajas} caja(s) completas`;
}

export function getAmpollaCartLineId(productId: string, tipo: AmpollaVentaTipo): string {
  return `${productId}::${tipo}`;
}

export function parseAmpollaCartLineId(cartLineId: string): { productId: string; tipo?: AmpollaVentaTipo } {
  const [productId, tipo] = cartLineId.split("::");
  if (tipo === "caja" || tipo === "unidad") {
    return { productId, tipo };
  }
  return { productId: cartLineId };
}

export function formatAmpollaLineNombre(nombre: string, tipo: AmpollaVentaTipo): string {
  return `${nombre} - ${tipo === "caja" ? "Caja" : "Unidad"}`;
}

export function getUnidadesDescontadas(
  tipo: AmpollaVentaTipo,
  cantidad: number,
  unidadesPorCaja: number,
): number {
  const qty = Math.max(0, Math.floor(cantidad));
  if (tipo === "caja") {
    return qty * Math.max(1, unidadesPorCaja);
  }
  return qty;
}

export function getUnidadesDescontadasFromCartItem(item: CartItem, product: Product): number {
  if (isAmpolla(product) && item.ampollaVentaTipo) {
    return getUnidadesDescontadas(item.ampollaVentaTipo, item.cantidad, product.unidadesPorCaja ?? 1);
  }
  return item.cantidad;
}

export function getMaxCantidadVenta(product: Product, tipo: AmpollaVentaTipo): number {
  if (!isAmpolla(product)) {
    return product.stock;
  }

  const unidadesPorCaja = Math.max(1, product.unidadesPorCaja ?? 1);
  if (tipo === "caja") {
    return calcularCajasDisponibles(product.stock, unidadesPorCaja);
  }
  return product.stock;
}

export function validarStockAmpolla(
  product: Product,
  tipo: AmpollaVentaTipo,
  cantidad: number,
): { ok: true } | { ok: false; error: string } {
  if (!isAmpolla(product)) {
    if (product.stock < cantidad) {
      return { ok: false, error: `Solo hay ${product.stock} unidades disponibles.` };
    }
    return { ok: true };
  }

  const unidadesPorCaja = Math.max(1, product.unidadesPorCaja ?? 1);
  const unidadesNecesarias = getUnidadesDescontadas(tipo, cantidad, unidadesPorCaja);

  if (product.stock < unidadesNecesarias) {
    if (tipo === "caja") {
      const cajasDisp = calcularCajasDisponibles(product.stock, unidadesPorCaja);
      return {
        ok: false,
        error: `Stock insuficiente para ${cantidad} caja(s). Disponible: ${cajasDisp} caja(s) (${product.stock} unidades).`,
      };
    }
    return {
      ok: false,
      error: `Stock insuficiente. Disponible: ${product.stock} unidad(es).`,
    };
  }

  return { ok: true };
}

export function getAmpollaPrecioBase(product: Product, tipo: AmpollaVentaTipo): number {
  if (tipo === "caja") {
    return product.precioCaja ?? product.precio;
  }
  return product.precioUnidad ?? product.precio;
}

export function getAmpollaSalePrice(
  product: Product,
  tipo: AmpollaVentaTipo,
  pricingMode: "detalle" | "mayorista",
  wholesaleDiscountPercent: WholesaleDiscountPercent | null,
): number {
  const base = getAmpollaPrecioBase(product, tipo);

  if (pricingMode === "mayorista" && wholesaleDiscountPercent) {
    const refProduct: Product = {
      ...product,
      precio: base,
      precioMayorista: product.precioMayorista > 0 ? product.precioMayorista : base * 0.85,
    };
    return computeWholesaleUnitPrice(refProduct, wholesaleDiscountPercent);
  }

  if (pricingMode === "mayorista") {
    return tipo === "caja"
      ? (product.precioCaja ?? product.precioMayorista)
      : (product.precioUnidad ?? product.precioMayorista);
  }

  return base;
}

export function findAmpollaByCode(products: Product[], rawCode: string): Product | undefined {
  const code = rawCode.trim().toUpperCase();
  if (!code) return undefined;

  return products.find((product) => {
    if (!isAmpolla(product)) return false;
    const boxCode = (product.codigoBarraCaja ?? product.id).trim().toUpperCase();
    return boxCode === code || product.id.trim().toUpperCase() === code;
  });
}

export function matchesAmpollaSearch(product: Product, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const haystack = [
    product.nombre,
    product.marca,
    product.id,
    product.codigoBarraCaja ?? "",
    product.categoria,
  ].join(" ").toLowerCase();

  return haystack.includes(q);
}

export function buildAmpollaCartItem(
  product: Product,
  tipo: AmpollaVentaTipo,
  cantidad: number,
  precio: number,
): CartItem {
  return {
    ...product,
    cartLineId: getAmpollaCartLineId(product.id, tipo),
    ampollaVentaTipo: tipo,
    nombre: formatAmpollaLineNombre(product.nombre, tipo),
    precio,
    cantidad,
  };
}

export function sumUnidadesDescontadasEnCarrito(
  cart: CartItem[],
  productId: string,
  products: Product[],
  extraTipo?: AmpollaVentaTipo,
  extraCantidad = 0,
): number {
  const product = products.find((entry) => entry.id === productId);
  if (!product) return 0;

  let total = 0;

  for (const item of cart) {
    if (item.id !== productId) continue;
    total += getUnidadesDescontadasFromCartItem(item, product);
  }

  if (extraTipo && extraCantidad > 0) {
    total += getUnidadesDescontadas(extraTipo, extraCantidad, product.unidadesPorCaja ?? 1);
  }

  return total;
}

export function validarStockAmpollaEnCarrito(
  product: Product,
  cart: CartItem[],
  tipo: AmpollaVentaTipo,
  cantidadNueva: number,
  cartLineId?: string,
): { ok: true } | { ok: false; error: string } {
  if (!isAmpolla(product)) {
    return validarStockAmpolla(product, "unidad", cantidadNueva);
  }

  const unidadesPorCaja = Math.max(1, product.unidadesPorCaja ?? 1);
  let unidadesEnCarrito = 0;

  for (const item of cart) {
    if (item.cartLineId === cartLineId) continue;
    if (item.id !== product.id) continue;
    unidadesEnCarrito += getUnidadesDescontadasFromCartItem(item, product);
  }

  unidadesEnCarrito += getUnidadesDescontadas(tipo, cantidadNueva, unidadesPorCaja);

  if (product.stock < unidadesEnCarrito) {
    return {
      ok: false,
      error: `Stock insuficiente. En inventario hay ${product.stock} unidad(es) y el carrito requiere ${unidadesEnCarrito}.`,
    };
  }

  return { ok: true };
}

export function stockFromCajasIngresadas(cajas: number, unidadesPorCaja: number): number {
  return Math.max(0, Math.floor(cajas)) * Math.max(1, Math.floor(unidadesPorCaja));
}
