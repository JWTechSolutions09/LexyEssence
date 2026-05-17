import type { Product } from "../types/domain";

/** Removes control chars some scanners prefix/suffix (STX, CR, etc.). */
export function normalizeScanCode(raw: string) {
  return raw.replace(/[^\x20-\x7E]/g, "").trim();
}

export function findProductByCode(products: Product[], rawCode: string): Product | undefined {
  const code = normalizeScanCode(rawCode).toUpperCase();
  if (!code) return undefined;

  return products.find((product) => product.id.trim().toUpperCase() === code);
}

export function isScanTerminator(key: string) {
  return key === "Enter" || key === "Tab" || key === "NumpadEnter";
}
