import { useAppContext } from "../context/AppContext";
import type { Supplier } from "../types/domain";
import { useMemo, useState } from "react";

export function SuppliersPage() {
  const { suppliers, setSuppliers, setNotice } = useAppContext();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"Todos" | "Activo" | "Pendiente">("Todos");
  const visibleSuppliers = useMemo(
    () => suppliers.filter((s) => {
      const statusMatch = statusFilter === "Todos" || s.estado === statusFilter;
      const queryMatch = `${s.nombre} ${s.contacto} ${s.id}`.toLowerCase().includes(query.toLowerCase());
      return statusMatch && queryMatch;
    }),
    [suppliers, query, statusFilter],
  );

  function addSupplier() {
    const next: Supplier = {
      id: `SUP-${Math.floor(Math.random() * 900 + 100)}`,
      nombre: "Nuevo Proveedor",
      contacto: "nuevo@proveedor.com",
      estado: "Pendiente",
    };
    setSuppliers((prev) => [next, ...prev]);
    setNotice("Proveedor agregado.");
  }

  function toggleState(id: string) {
    setSuppliers((prev) => prev.map((s) => {
      if (s.id !== id) return s;
      return { ...s, estado: s.estado === "Activo" ? "Pendiente" : "Activo" };
    }));
    setNotice("Estado de proveedor actualizado.");
  }

  return (
    <section className="suppliers-screen">
      <div className="row">
        <div>
          <h1>Proveedores</h1>
          <p className="muted">Gestión de aliados comerciales y estados de suministro.</p>
        </div>
        <div className="actions">
          <button className="ghost" onClick={() => setNotice("Exportación de proveedores (demo).")}>Exportar</button>
          <button onClick={addSupplier}>Agregar proveedor</button>
        </div>
      </div>
      <div className="suppliers-kpis">
        <article className="card"><span className="muted">Total</span><strong>{suppliers.length}</strong></article>
        <article className="card"><span className="muted">Activos</span><strong>{suppliers.filter((s) => s.estado === "Activo").length}</strong></article>
        <article className="card"><span className="muted">Pendientes</span><strong>{suppliers.filter((s) => s.estado === "Pendiente").length}</strong></article>
      </div>
      <div className="card suppliers-toolbar">
        <input
          placeholder="Buscar proveedor, correo o ID..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "Todos" | "Activo" | "Pendiente")}>
          <option value="Todos">Todos</option>
          <option value="Activo">Activo</option>
          <option value="Pendiente">Pendiente</option>
        </select>
      </div>
      <div className="card">
        {visibleSuppliers.length === 0 && <p className="muted">No hay proveedores que coincidan con los filtros.</p>}
        {visibleSuppliers.map((s) => (
          <div className="list-item" key={s.id}>
            <div>
              <strong>{s.nombre}</strong>
              <p className="muted">{s.id} · {s.contacto}</p>
            </div>
            <div className="actions">
              <span className={s.estado === "Activo" ? "badge" : "badge warn"}>{s.estado}</span>
              <button className="ghost" onClick={() => toggleState(s.id)}>Cambiar estado</button>
              <button className="ghost" onClick={() => setNotice(`Contacto de ${s.nombre}: ${s.contacto}`)}>Ver contacto</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
