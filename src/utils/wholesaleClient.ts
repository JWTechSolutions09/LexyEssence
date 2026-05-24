import type { Product, WholesaleDiscountPercent } from "../types/domain";

export function normalizeCedula(value: string) {
  return value.replace(/\D/g, "");
}

export function formatCedulaDisplay(value: string) {
  const digits = normalizeCedula(value);
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 10)}-${digits.slice(10)}`;
  }
  return digits || value.trim();
}

export function formatWholesaleCustomerLabel(salon: string, cedula: string, discountPercent?: WholesaleDiscountPercent) {
  const base = `${salon.trim()} (${formatCedulaDisplay(cedula)})`;
  if (discountPercent) return `${base} · ${discountPercent}% desc.`;
  return base;
}

export function computeWholesaleUnitPrice(product: Product, discountPercent: WholesaleDiscountPercent) {
  const factor = 1 - discountPercent / 100;
  return Math.round(product.precio * factor * 100) / 100;
}
