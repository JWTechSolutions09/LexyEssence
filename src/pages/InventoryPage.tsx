import { useState } from "react";
import { useAppContext } from "../context/AppContext";
import type { Product } from "../types/domain";
import { currency } from "../utils/format";

const categories = ["Todos", "Cosméticos", "Cuidado de Piel", "Herramientas"];

export function InventoryPage() {
  const { products, setProducts, setNotice } = useAppContext();
  const [filter, setFilter] = useState("Todos");
  const [query, setQuery] = useState("");

  const visible = products.filter((p) => {
    const categoryMatch = filter === "Todos" || p.categoria === filter;
    const queryMatch = `${p.nombre} ${p.id} ${p.categoria}`.toLowerCase().includes(query.toLowerCase());
    return categoryMatch && queryMatch;
  });
  const lowStock = products.filter((p) => p.stock <= 12).length;
  const inventoryValue = products.reduce((acc, p) => acc + p.precio * p.stock, 0);

  function addProduct() {
    const next: Product = {
      id: `LEX-NEW-${Math.floor(Math.random() * 1000)}`,
      nombre: "Producto Nuevo",
      categoria: "Cosméticos",
      precio: 55,
      stock: 20,
    };
    setProducts((prev) => [next, ...prev]);
    setNotice("Producto agregado al inventario.");
  }

  function increaseStock(id: string) {
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, stock: p.stock + 5 } : p)));
    setNotice("Stock actualizado (+5).");
  }

  return (
    <section className="inventory-screen">
      <div className="row">
        <div>
          <h1>Inventario</h1>
          <p className="muted">Control de stock, valor y estado de productos.</p>
        </div>
        <div className="actions">
          <button className="ghost" onClick={() => setNotice(`Filtro activo: ${filter}`)}>Aplicar filtro</button>
          <button onClick={addProduct}>Agregar producto</button>
        </div>
      </div>

      <div className="inventory-kpis">
        <article className="card"><span className="muted">Productos</span><strong>{products.length}</strong></article>
        <article className="card"><span className="muted">Stock bajo</span><strong>{lowStock}</strong></article>
        <article className="card"><span className="muted">Valor inventario</span><strong>{currency(inventoryValue)}</strong></article>
      </div>

      <div className="card inventory-toolbar">
        <input
          placeholder="Buscar por nombre, SKU o categoría..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="ghost" onClick={() => setQuery("")}>Limpiar búsqueda</button>
      </div>

      <div className="actions">
        {categories.map((cat) => (
          <button key={cat} className={filter === cat ? "" : "ghost"} onClick={() => setFilter(cat)}>
            {cat}
          </button>
        ))}
      </div>

      <div className="card">
        {visible.length === 0 && <p className="muted">No hay productos que coincidan con el filtro/búsqueda.</p>}
        {visible.map((p) => (
          <div className="list-item" key={p.id}>
            <div>
              <strong>{p.nombre}</strong>
              <p className="muted">{p.id} · {p.categoria}</p>
            </div>
            <div className="actions">
              <span>{currency(p.precio)}</span>
              <span className={p.stock <= 12 ? "badge warn" : "badge"}>{p.stock} unidades</span>
              <button className="ghost" onClick={() => increaseStock(p.id)}>+ Stock</button>
              <button className="ghost" onClick={() => setNotice(`Edición rápida de ${p.nombre} (demo).`)}>Editar</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
