import { useMemo } from "react";
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

  const total = useMemo(() => cart.reduce((acc, item) => acc + item.precio * item.cantidad, 0), [cart]);

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
            <button>All Items</button>
            <button className="ghost">Services</button>
            <button className="ghost">Skincare</button>
            <button className="ghost">Fragrances</button>
          </div>
          <div className="muted">Showing {products.length} Results</div>
        </div>
        <div className="pos-grid">
          {products.map((p) => (
            <article className="pos-product-card" key={p.id}>
              <div className="pos-product-hero">
                <div className="pos-product-overlay" />
                <div className="pos-product-brand">{p.nombre.split(" ")[0].toUpperCase()}</div>
                <span className="pos-stock">{p.stock > 0 ? "In Stock" : "Out of Stock"}</span>
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
            <h2>Current Sale</h2>
            <span className="badge">{cart.length} ITEMS</span>
          </div>
          <div className="row">
            <span className="muted">Walking-in Customer</span>
            <button className="ghost" onClick={() => setNotice("Edit customer (demo).")}>Edit</button>
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
          <div className="row"><span>Tax (8%)</span><span>{currency(total * 0.08)}</span></div>
          <div className="row"><span>Discount</span><span>{currency(0)}</span></div>
          <div className="row">
            <strong>Total Amount</strong>
            <strong>{currency(total * 1.08)}</strong>
          </div>
          <div className="actions">
            <button className="ghost" onClick={() => setNotice("Coupon flow (demo).")}>Add Coupon</button>
            <button className="ghost" onClick={clearSale}>Clear</button>
          </div>
          <button onClick={completeSale}>Complete Sale</button>
          <div className="actions">
            <button className="ghost" onClick={() => { setCashierOpen(true); setNotice("Cashier opened."); }}>Open Cashier</button>
            <button className="ghost" onClick={() => { setCashierOpen(false); setNotice("Cashier closed."); }}>Close Cashier</button>
          </div>
          <p className="muted">Cashier: {cashierOpen ? "Open" : "Closed"}</p>
        </div>
      </aside>
    </section>
  );
}
