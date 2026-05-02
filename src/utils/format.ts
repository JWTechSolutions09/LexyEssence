export function currency(value: number): string {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency: "USD" }).format(value);
}
