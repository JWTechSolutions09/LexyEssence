import { useMemo, useState } from "react";
import { useAppContext } from "../context/AppContext";
import type { Product, Transaction } from "../types/domain";
import { currency } from "../utils/format";

export function PosPage() {
  const {
    cart,
    setCart,
    products,
    setProducts,
    setTransactions,
    cashierOpen,
    setCashierOpen,
    setNotice,
  } = useAppContext();
  const [categoryFilter, setCategoryFilter] = useState("Todos");

  const total = useMemo(() => cart.reduce((acc, item) => acc + item.precio * item.cantidad, 0), [cart]);
  const visibleProducts = products.filter((product) => {
    if (categoryFilter === "Todos") return true;
    if (categoryFilter === "Servicios") return product.categoria.toLowerCase().includes("serv");
    if (categoryFilter === "Cuidado de Piel") return product.categoria.toLowerCase().includes("piel");
    if (categoryFilter === "Fragancias") return product.categoria.toLowerCase().includes("frag");
    return true;
  });

  function addToCart(product: Product) {
    if (product.stock <= 0) {
      setNotice("No hay stock disponible para ese producto.");
      return;
    }
    setCart((prev) => {
      const found = prev.find((i) => i.id === product.id);
      if (found) return prev.map((i) => (i.id === product.id ? { ...i, cantidad: i.cantidad + 1 } : i));
      return [...prev, { ...product, cantidad: 1 }];
    });
    setNotice(`Producto agregado: ${product.nombre}`);
  }

  function updateQty(id: string, next: number) {
    setCart((prev) => prev.flatMap((item) => {
      if (item.id !== id) return [item];
      if (next <= 0) return [];
      return [{ ...item, cantidad: next }];
    }));
  }

  function clearSale() {
    setCart([]);
    setNotice("Venta limpiada.");
  }

  function completeSale() {
    if (!cashierOpen) {
      setNotice("Primero debes abrir la caja.");
      return;
    }
    if (cart.length === 0) {
      setNotice("Agrega productos antes de completar la venta.");
      return;
    }

    setProducts((prev) => prev.map((p) => {
      const inCart = cart.find((c) => c.id === p.id);
      if (!inCart) return p;
      return { ...p, stock: Math.max(0, p.stock - inCart.cantidad) };
    }));

    const trx: Transaction = {
      id: `TXN-${Date.now().toString().slice(-5)}`,
      cliente: "Cliente Mostrador",
      monto: total,
      metodo: "Tarjeta",
      estado: "Completada",
    };
    setTransactions((prev) => [trx, ...prev]);
    setCart([]);
    setNotice("Venta completada y registrada en reportes.");
  }

  return (
    <section className="pos-screen">
      <section className="pos-catalog">
        <div className="row">
          <div className="actions">
            <button className={categoryFilter === "Todos" ? "" : "ghost"} onClick={() => setCategoryFilter("Todos")}>Todos</button>
            <button className={categoryFilter === "Servicios" ? "" : "ghost"} onClick={() => setCategoryFilter("Servicios")}>Servicios</button>
            <button className={categoryFilter === "Cuidado de Piel" ? "" : "ghost"} onClick={() => setCategoryFilter("Cuidado de Piel")}>Cuidado de Piel</button>
            <button className={categoryFilter === "Fragancias" ? "" : "ghost"} onClick={() => setCategoryFilter("Fragancias")}>Fragancias</button>
          </div>
          <div className="muted">Mostrando {visibleProducts.length} resultados</div>
        </div>
        <div className="pos-grid">
          {visibleProducts.map((p) => (
            <article className="pos-product-card" key={p.id}>
              <div className="pos-product-hero">
                <div className="pos-product-overlay" />
                <div className="pos-product-brand">{p.nombre.split(" ")[0].toUpperCase()}</div>
                <span className="pos-stock">{p.stock > 0 ? "En Stock" : "Sin Stock"}</span>
              </div>
              <div className="pos-product-content">
                <h3>{p.nombre}</h3>
                <p className="muted">{p.categoria}</p>
              </div>
              <div className="row">
                <strong>{currency(p.precio)}</strong>
                <button onClick={() => addToCart(p)}>
                  <span className="material-symbols-outlined">add_shopping_cart</span>
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <aside className="pos-cart-panel">
        <div className="pos-cart-head">
          <div className="row">
            <h2>Venta Actual</h2>
            <span className="badge">{cart.length} ARTÍCULOS</span>
          </div>
          <div className="row">
            <span className="muted">Cliente sin cita</span>
            <button className="ghost" onClick={() => setNotice("Editar cliente (demo).")}>Editar</button>
          </div>
        </div>
        <div className="pos-cart-items">
          {cart.length === 0 && <p className="muted">No hay productos en el carrito.</p>}
          {cart.map((item) => (
            <div className="pos-cart-item" key={item.id}>
              <div className="row">
                <strong>{item.nombre}</strong>
                <span>{currency(item.precio * item.cantidad)}</span>
              </div>
              <div className="actions">
                <button className="ghost" onClick={() => updateQty(item.id, item.cantidad - 1)}>-</button>
                <span>{item.cantidad}</span>
                <button className="ghost" onClick={() => updateQty(item.id, item.cantidad + 1)}>+</button>
                <button className="ghost" onClick={() => updateQty(item.id, 0)}>
                  <span className="material-symbols-outlined">delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="pos-cart-footer">
          <div className="row"><span>Subtotal</span><span>{currency(total)}</span></div>
          <div className="row"><span>Impuesto (8%)</span><span>{currency(total * 0.08)}</span></div>
          <div className="row"><span>Descuento</span><span>{currency(0)}</span></div>
          <div className="row">
            <strong>Monto Total</strong>
            <strong>{currency(total * 1.08)}</strong>
          </div>
          <div className="actions">
            <button className="ghost" onClick={() => setNotice("Flujo de cupón (demo).")}>Agregar Cupón</button>
            <button className="ghost" onClick={clearSale}>Limpiar</button>
          </div>
          <button onClick={completeSale}>Completar Venta</button>
          <div className="actions">
            <button className="ghost" onClick={() => { setCashierOpen(true); setNotice("Caja abierta."); }}>Abrir Caja</button>
            <button className="ghost" onClick={() => { setCashierOpen(false); setNotice("Caja cerrada."); }}>Cerrar Caja</button>
          </div>
          <p className="muted">Caja: {cashierOpen ? "Abierta" : "Cerrada"}</p>
        </div>
      </aside>
    </section>
  );
}
