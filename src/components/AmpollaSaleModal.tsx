import { useEffect } from "react";
import type { AmpollaVentaTipo, Product } from "../types/domain";
import { currency } from "../utils/format";
import {
  formatAmpollaStockLabel,
  getAmpollaPrecioBase,
  getMaxCantidadVenta,
  isAmpolla,
  validarStockAmpolla,
} from "../utils/ampolla";

type AmpollaSaleModalProps = {
  product: Product;
  pricingMode: "detalle" | "mayorista";
  wholesaleDiscountPercent: number | null;
  getSalePrice: (product: Product, tipo: AmpollaVentaTipo) => number;
  onClose: () => void;
  onSelect: (tipo: AmpollaVentaTipo) => void;
};

export function AmpollaSaleModal({
  product,
  pricingMode,
  wholesaleDiscountPercent,
  getSalePrice,
  onClose,
  onSelect,
}: AmpollaSaleModalProps) {
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  if (!isAmpolla(product)) return null;

  const unidadesPorCaja = Math.max(1, product.unidadesPorCaja ?? 1);
  const puedeCaja = validarStockAmpolla(product, "caja", 1).ok;
  const puedeUnidad = validarStockAmpolla(product, "unidad", 1).ok;
  const precioCaja = getSalePrice(product, "caja");
  const precioUnidad = getSalePrice(product, "unidad");

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel card pos-scan-modal ampolla-sale-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ampolla-sale-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="row">
          <div>
            <h2 id="ampolla-sale-modal-title">Vender ampolla</h2>
            <p className="muted">
              <strong>{product.nombre}</strong> · Codigo caja {product.codigoBarraCaja ?? product.id}
            </p>
            <p className="muted">{formatAmpollaStockLabel(product)}</p>
            <p className="muted">
              {unidadesPorCaja} unidades por caja · Max cajas: {getMaxCantidadVenta(product, "caja")}
            </p>
          </div>
          <button className="ghost" type="button" onClick={onClose}>Cerrar</button>
        </div>

        <div className="ampolla-sale-options">
          <button
            type="button"
            className="ampolla-sale-option"
            disabled={!puedeCaja}
            onClick={() => onSelect("caja")}
          >
            <span className="material-symbols-outlined">inventory_2</span>
            <div>
              <strong>Vender caja completa</strong>
              <p className="muted">
                {currency(precioCaja)} · Descuenta {unidadesPorCaja} unidades
              </p>
              {!puedeCaja && (
                <p className="form-error">No hay stock para una caja completa.</p>
              )}
            </div>
          </button>

          <button
            type="button"
            className="ampolla-sale-option"
            disabled={!puedeUnidad}
            onClick={() => onSelect("unidad")}
          >
            <span className="material-symbols-outlined">medication_liquid</span>
            <div>
              <strong>Vender unidad individual</strong>
              <p className="muted">
                {currency(precioUnidad)} · Descuenta 1 unidad
              </p>
              {!puedeUnidad && (
                <p className="form-error">No hay unidades disponibles.</p>
              )}
            </div>
          </button>
        </div>

        <p className="muted ampolla-sale-hint">
          Modo precio: {pricingMode === "mayorista" && wholesaleDiscountPercent
            ? `Mayorista (${wholesaleDiscountPercent}% desc.)`
            : "Cliente"}
          {" "}· Lista caja {currency(getAmpollaPrecioBase(product, "caja"))} / unidad {currency(getAmpollaPrecioBase(product, "unidad"))}
        </p>
      </div>
    </div>
  );
}
