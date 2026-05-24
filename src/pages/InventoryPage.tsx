import { useCallback, useState, type FormEvent } from "react";
import { QuickScanProductModal, type QuickScanDraft } from "../components/QuickScanProductModal";
import { useAppContext } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";
import { useBarcodeCapture } from "../hooks/useBarcodeCapture";
import { findProductByCode, normalizeScanCode } from "../hooks/useBarcodeScanner";
import type { Product } from "../types/domain";
import { currency } from "../utils/format";
import { createStockMovement } from "../utils/stockMovements";
import { buildQuickProductFromScan } from "../utils/quickProduct";

const baseCategories = ["Cosméticos", "Cuidado de Piel", "Herramientas", "Fragancias", "Accesorios"];
const stockViews = ["Todos", "Disponibles", "Stock bajo", "Agotados"] as const;

type ProductFormState = {
  id: string;
  nombre: string;
  marca: string;
  descripcion: string;
  categoria: string;
  costo: string;
  precio: string;
  precioMayorista: string;
  stock: string;
  stockMinimo: string;
};

type ProductDraftResult =
  | { product: Product }
  | { error: string };

type StockView = typeof stockViews[number];

const emptyProductForm: ProductFormState = {
  id: "",
  nombre: "",
  marca: "",
  descripcion: "",
  categoria: baseCategories[0],
  costo: "0",
  precio: "0",
  precioMayorista: "0",
  stock: "0",
  stockMinimo: "0",
};

function getProductStatus(product: Product) {
  if (product.stock <= 0) {
    return { label: "Agotado", className: "danger" };
  }

  if (product.stock <= product.stockMinimo) {
    return { label: "Stock bajo", className: "warn" };
  }

  return { label: "Disponible", className: "success" };
}

export function InventoryPage() {
  const { products, setProducts, setNotice, appendStockMovements, forceSave } = useAppContext();
  const { isAdmin } = useAuth();
  const [filter, setFilter] = useState("Todos");
  const [stockView, setStockView] = useState<StockView>("Todos");
  const [query, setQuery] = useState("");
  const [modalMode, setModalMode] = useState<"create" | "edit" | "delete" | null>(null);
  const [draft, setDraft] = useState<ProductFormState>(emptyProductForm);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [formError, setFormError] = useState("");
  const [unknownScanDraft, setUnknownScanDraft] = useState<QuickScanDraft | null>(null);
  const [unknownScanError, setUnknownScanError] = useState("");
  const [quickScanMode, setQuickScanMode] = useState(false);

  const categories = ["Todos", ...new Set([...baseCategories, ...products.map((product) => product.categoria)])];

  const visible = products.filter((product) => {
    const categoryMatch = filter === "Todos" || product.categoria === filter;
    const stockMatch =
      stockView === "Todos"
        || (stockView === "Disponibles" && product.stock > product.stockMinimo)
        || (stockView === "Stock bajo" && product.stock > 0 && product.stock <= product.stockMinimo)
        || (stockView === "Agotados" && product.stock <= 0);
    const queryMatch = `${product.nombre} ${product.id} ${product.categoria} ${product.marca} ${product.descripcion}`
      .toLowerCase()
      .includes(query.toLowerCase());

    return categoryMatch && stockMatch && queryMatch;
  });

  const lowStock = products.filter((product) => product.stock > 0 && product.stock <= product.stockMinimo).length;
  const outOfStock = products.filter((product) => product.stock <= 0).length;
  const inventoryValue = products.reduce((acc, product) => acc + product.precio * product.stock, 0);
  const inventoryCost = products.reduce((acc, product) => acc + product.costo * product.stock, 0);
  const expectedMargin = inventoryValue - inventoryCost;

  function resetFilters() {
    setFilter("Todos");
    setStockView("Todos");
    setQuery("");
    setNotice("Filtros restablecidos.");
  }

  function openCreateModal() {
    setDraft({ ...emptyProductForm });
    setEditingProductId(null);
    setSelectedProduct(null);
    setFormError("");
    setModalMode("create");
  }

  function openEditModal(product: Product) {
    setDraft({
      id: product.id,
      nombre: product.nombre,
      marca: product.marca,
      descripcion: product.descripcion,
      categoria: product.categoria,
      costo: String(product.costo),
      precio: String(product.precio),
      precioMayorista: String(product.precioMayorista),
      stock: String(product.stock),
      stockMinimo: String(product.stockMinimo),
    });
    setEditingProductId(product.id);
    setSelectedProduct(product);
    setFormError("");
    setModalMode("edit");
  }

  function openDeleteModal(product: Product) {
    setSelectedProduct(product);
    setEditingProductId(null);
    setFormError("");
    setModalMode("delete");
  }

  function closeModal() {
    setModalMode(null);
    setEditingProductId(null);
    setSelectedProduct(null);
    setFormError("");
  }

  function updateDraft(field: keyof ProductFormState, value: string) {
    if (formError) setFormError("");
    setDraft((prev) => ({ ...prev, [field]: value }));
  }

  function buildProductFromDraft(): ProductDraftResult {
    const id = draft.id.trim().toUpperCase();
    const nombre = draft.nombre.trim();
    const marca = draft.marca.trim();
    const descripcion = draft.descripcion.trim();
    const categoria = draft.categoria.trim();
    const costo = Number(draft.costo);
    const precio = Number(draft.precio);
    const precioMayorista = Number(draft.precioMayorista);
    const stock = Number(draft.stock);
    const stockMinimo = Number(draft.stockMinimo);

    if (!id || !nombre || !marca || !categoria) {
      return { error: "Completa codigo, nombre, marca y categoria." };
    }

    if (!Number.isFinite(costo) || costo < 0) {
      return { error: "El costo debe ser un numero valido mayor o igual a 0." };
    }

    if (!Number.isFinite(precio) || precio < 0) {
      return { error: "El precio de venta debe ser un numero valido mayor o igual a 0." };
    }

    if (!Number.isFinite(precioMayorista) || precioMayorista < 0) {
      return { error: "El precio mayorista debe ser un numero valido mayor o igual a 0." };
    }

    if (!Number.isInteger(stock) || stock < 0) {
      return { error: "El stock debe ser un numero entero mayor o igual a 0." };
    }

    if (!Number.isInteger(stockMinimo) || stockMinimo < 0) {
      return { error: "El stock minimo debe ser un numero entero mayor o igual a 0." };
    }

    if (precio < costo) {
      return { error: "El precio de venta no puede ser menor al costo." };
    }

    if (precioMayorista < costo) {
      return { error: "El precio mayorista no puede ser menor al costo." };
    }

    if (precioMayorista > precio) {
      return { error: "El precio de venta debe ser mayor o igual al precio mayorista." };
    }

    const duplicate = products.some((product) => {
      if (editingProductId && product.id === editingProductId) return false;
      return product.id.toLowerCase() === id.toLowerCase();
    });

    if (duplicate) {
      return { error: "Ya existe un producto con ese codigo." };
    }

    return {
      product: {
        id,
        nombre,
        marca,
        descripcion,
        categoria,
        costo,
        precio,
        precioMayorista,
        stock,
        stockMinimo,
      } satisfies Product,
    };
  }

  function submitProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const result = buildProductFromDraft();
    if ("error" in result) {
      setFormError(result.error);
      return;
    }

    if (modalMode === "create") {
      setProducts((prev) => [result.product, ...prev]);
      if (result.product.stock > 0) {
        appendStockMovements([createStockMovement({
          tipo: "entrada",
          productId: result.product.id,
          nombre: result.product.nombre,
          cantidad: result.product.stock,
          motivo: "Alta de producto",
          fecha: new Date().toISOString(),
        })]);
      }
      setNotice(`Producto ${result.product.nombre} agregado correctamente.`);
    }

    if (modalMode === "edit" && editingProductId) {
      const previous = products.find((product) => product.id === editingProductId);
      setProducts((prev) => prev.map((product) => (product.id === editingProductId ? result.product : product)));
      if (previous) {
        const delta = result.product.stock - previous.stock;
        if (delta > 0) {
          appendStockMovements([createStockMovement({
            tipo: "entrada",
            productId: result.product.id,
            nombre: result.product.nombre,
            cantidad: delta,
            motivo: "Ajuste manual de stock",
            fecha: new Date().toISOString(),
          })]);
        } else if (delta < 0) {
          appendStockMovements([createStockMovement({
            tipo: "salida",
            productId: result.product.id,
            nombre: result.product.nombre,
            cantidad: Math.abs(delta),
            motivo: "Ajuste manual de stock",
            fecha: new Date().toISOString(),
          })]);
        }
      }
      setNotice(`Producto ${result.product.nombre} actualizado correctamente.`);
    }

    closeModal();
    void forceSave();
  }

  function deleteProduct() {
    if (!selectedProduct) return;

    if (selectedProduct.stock > 0) {
      appendStockMovements([createStockMovement({
        tipo: "salida",
        productId: selectedProduct.id,
        nombre: selectedProduct.nombre,
        cantidad: selectedProduct.stock,
        motivo: "Eliminacion de producto",
        fecha: new Date().toISOString(),
      })]);
    }

    setProducts((prev) => prev.filter((product) => product.id !== selectedProduct.id));
    setNotice(`Producto ${selectedProduct.nombre} eliminado del inventario.`);
    closeModal();
    void forceSave();
  }

  function increaseStock(id: string) {
    const product = products.find((entry) => entry.id === id);
    if (!product) return;

    const delta = Math.max(1, product.stockMinimo || 5);
    addStockUnits(product, delta, "Entrada + Stock");
    setNotice("Stock actualizado correctamente.");
  }

  function addStockUnits(product: Product, quantity: number, motivo: string) {
    if (quantity <= 0) return;

    setProducts((prev) => prev.map((entry) => (
      entry.id === product.id
        ? { ...entry, stock: entry.stock + quantity }
        : entry
    )));
    appendStockMovements([createStockMovement({
      tipo: "entrada",
      productId: product.id,
      nombre: product.nombre,
      cantidad: quantity,
      motivo,
      fecha: new Date().toISOString(),
    })]);
    void forceSave();
  }

  function toggleQuickScanMode() {
    setQuickScanMode((prev) => {
      const next = !prev;
      setNotice(
        next
          ? "Modo escaneo rapido activado. Cada escaneo suma +1 al stock."
          : "Modo escaneo rapido desactivado.",
      );
      return next;
    });
  }

  const registerScannedCode = useCallback((rawCode: string) => {
    const code = normalizeScanCode(rawCode);
    if (!code) return;

    const product = findProductByCode(products, code);
    if (product) {
      setQuery(code);
      if (isAdmin && quickScanMode) {
        addStockUnits(product, 1, "Escaneo rapido");
        setNotice(`+1 stock: ${product.nombre} (ahora ${product.stock + 1} unidades)`);
        return;
      }
      if (isAdmin) {
        openEditModal(product);
      }
      setNotice(`Producto encontrado: ${product.nombre}`);
      return;
    }

    if (!isAdmin) {
      setNotice("Codigo no registrado. Consulta con administracion.");
      return;
    }

    setUnknownScanError("");
    setUnknownScanDraft({
      id: code.toUpperCase(),
      nombre: "",
      precio: "0",
      stock: "1",
    });
  }, [isAdmin, quickScanMode, products, setNotice]);

  const {
    scanInputRef,
    handleCaptureKeyDown,
    handleCaptureBlur,
    focusScannerCapture,
    handleSearchKeyDown,
  } = useBarcodeCapture({
    onScan: registerScannedCode,
    isPaused: () => modalMode !== null || unknownScanDraft !== null,
  });

  const closeUnknownScanModal = useCallback(() => {
    setUnknownScanDraft(null);
    setUnknownScanError("");
    window.setTimeout(() => focusScannerCapture(), 80);
  }, [focusScannerCapture]);

  function submitUnknownScanProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!unknownScanDraft) return;

    const result = buildQuickProductFromScan(unknownScanDraft, products);
    if ("error" in result) {
      setUnknownScanError(result.error);
      return;
    }

    const product = result.product;
    setProducts((prev) => [product, ...prev]);
    if (product.stock > 0) {
      appendStockMovements([createStockMovement({
        tipo: "entrada",
        productId: product.id,
        nombre: product.nombre,
        cantidad: product.stock,
        motivo: "Registro por escaneo",
        fecha: new Date().toISOString(),
      })]);
    }
    setUnknownScanDraft(null);
    setUnknownScanError("");
    setQuery(product.id);
    setNotice(`Producto registrado en inventario: ${product.nombre}`);
    window.setTimeout(() => focusScannerCapture(), 80);
  }

  const focusScannerWithNotice = useCallback(() => {
    focusScannerCapture();
    setNotice("Lector USB listo. Escanea un codigo de barras.");
  }, [focusScannerCapture, setNotice]);

  return (
    <section className="inventory-screen">
      <div className="row">
        <div>
          <h1>Inventario</h1>
          <p className="muted">
            {quickScanMode && isAdmin
              ? "Modo escaneo rapido: cada codigo conocido suma +1 al stock. Los nuevos abren el registro rapido."
              : "Escanea codigos con el lector USB o gestiona productos manualmente."}
          </p>
        </div>
        <div className="actions">
          <button type="button" className="ghost" onClick={resetFilters}>Restablecer filtros</button>
          <button type="button" className="ghost" onClick={focusScannerWithNotice}>
            <span className="material-symbols-outlined">barcode_scanner</span>
            Lector
          </button>
          {isAdmin && <button type="button" onClick={openCreateModal}>Agregar producto</button>}
        </div>
      </div>

      <div className="inventory-kpis inventory-kpis-extended">
        <article className="card">
          <span className="muted">Productos</span>
          <strong>{products.length}</strong>
        </article>
        <article className="card">
          <span className="muted">Stock bajo</span>
          <strong>{lowStock}</strong>
        </article>
        <article className="card">
          <span className="muted">Agotados</span>
          <strong>{outOfStock}</strong>
        </article>
        {isAdmin && (
          <>
            <article className="card">
              <span className="muted">Valor inventario</span>
              <strong>{currency(inventoryValue)}</strong>
            </article>
            <article className="card">
              <span className="muted">Costo inventario</span>
              <strong>{currency(inventoryCost)}</strong>
            </article>
            <article className="card">
              <span className="muted">Margen potencial</span>
              <strong>{currency(expectedMargin)}</strong>
            </article>
          </>
        )}
      </div>

      <input
        ref={scanInputRef}
        type="text"
        className="pos-barcode-capture"
        aria-label="Captura de lector de codigos USB"
        autoComplete="off"
        onKeyDown={handleCaptureKeyDown}
        onBlur={handleCaptureBlur}
      />

      <div className="card inventory-toolbar inventory-toolbar-extended">
        <div className="inventory-toolbar-main">
          <input
            className="inventory-input"
            data-manual-input
            placeholder="Buscar o escanear codigo..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => handleSearchKeyDown(event, () => setQuery(""))}
            onBlur={handleCaptureBlur}
          />
          <button type="button" className="ghost" onClick={() => setQuery("")}>Limpiar busqueda</button>
        </div>
        <div className="pos-scanner-status inventory-scanner-status" role="status">
          <span className="badge success">
            <span className="material-symbols-outlined">usb</span>
            Lector USB activo
          </span>
          {isAdmin && (
            <button
              type="button"
              className={quickScanMode ? "inventory-quick-scan-toggle active" : "inventory-quick-scan-toggle ghost"}
              onClick={toggleQuickScanMode}
              aria-pressed={quickScanMode}
            >
              <span className="material-symbols-outlined">barcode_reader</span>
              Modo escaneo rapido
            </button>
          )}
          {isAdmin && quickScanMode && (
            <span className="badge warn">+1 por escaneo</span>
          )}
        </div>
        <p className="muted">Mostrando {visible.length} de {products.length} productos.</p>
      </div>

      <div className="inventory-filter-groups">
        <div className="actions">
          {categories.map((category) => (
            <button
              key={category}
              className={filter === category ? "" : "ghost"}
              onClick={() => setFilter(category)}
            >
              {category}
            </button>
          ))}
        </div>

        <div className="actions">
          {stockViews.map((view) => (
            <button
              key={view}
              className={stockView === view ? "" : "ghost"}
              onClick={() => setStockView(view)}
            >
              {view}
            </button>
          ))}
        </div>
      </div>

      <div className="card inventory-list">
        {visible.length === 0 && <p className="muted">No hay productos que coincidan con el filtro o la busqueda.</p>}

        {visible.map((product) => {
          const status = getProductStatus(product);

          return (
            <article className="inventory-record" key={product.id}>
              <div className="inventory-record-main">
                <div className="inventory-record-heading">
                  <div>
                    <strong>{product.nombre}</strong>
                    <p className="muted">Codigo {product.id} · {product.marca} · {product.categoria}</p>
                  </div>
                  <span className={`badge inventory-status ${status.className}`}>{status.label}</span>
                </div>

                {product.descripcion && <p className="inventory-description">{product.descripcion}</p>}

                <div className="inventory-meta-grid">
                  <div className="inventory-metric-card highlight">
                    <span className="muted">Precio venta</span>
                    <strong>{currency(product.precio)}</strong>
                  </div>
                  <div className="inventory-metric-card">
                    <span className="muted">Precio mayorista</span>
                    <strong>{currency(product.precioMayorista)}</strong>
                  </div>
                  {isAdmin && (
                    <div className="inventory-metric-card">
                      <span className="muted">Costo</span>
                      <strong>{currency(product.costo)}</strong>
                    </div>
                  )}
                  <div className="inventory-metric-card stock">
                    <span className="muted">Stock actual</span>
                    <strong>{product.stock}</strong>
                  </div>
                </div>

                <div className="inventory-details-row">
                  <span className="badge">Minimo {product.stockMinimo}</span>
                  {isAdmin && (
                    <>
                      <span className="badge">Margen unitario {currency(product.precio - product.costo)}</span>
                      <span className="badge">Valor total {currency(product.precio * product.stock)}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="actions inventory-record-actions">
                <button className="ghost" onClick={() => increaseStock(product.id)}>+ Stock</button>
                {isAdmin && (
                  <>
                    <button className="ghost" onClick={() => openEditModal(product)}>Editar</button>
                    <button className="ghost danger-text" onClick={() => openDeleteModal(product)}>Eliminar</button>
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {isAdmin && modalMode && (
        <div className="modal-backdrop" role="presentation" onClick={closeModal}>
          <div
            className="modal-panel card inventory-modal-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="inventory-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            {modalMode !== "delete" ? (
              <>
                <div className="row">
                  <div>
                    <h2 id="inventory-modal-title">{modalMode === "create" ? "Agregar producto" : "Editar producto"}</h2>
                    <p className="muted">
                      {modalMode === "create"
                        ? "Registra codigo, precios y stock inicial como en un panel de inventario real."
                        : "Actualiza costos, precios, stock y datos generales del producto."}
                    </p>
                  </div>
                  <button className="ghost" type="button" onClick={closeModal}>Cerrar</button>
                </div>

                <form className="inventory-form" onSubmit={submitProduct}>
                  <div className="inventory-form-grid">
                    <label>
                      Codigo
                      <input
                        className="inventory-input"
                        value={draft.id}
                        onChange={(event) => updateDraft("id", event.target.value)}
                        placeholder="Ej. LEX-CM-100"
                      />
                    </label>

                    <label>
                      Categoria
                      <input
                        className="inventory-input"
                        list="inventory-categories"
                        value={draft.categoria}
                        onChange={(event) => updateDraft("categoria", event.target.value)}
                        placeholder="Categoria del producto"
                      />
                      <datalist id="inventory-categories">
                        {categories
                          .filter((category) => category !== "Todos")
                          .map((category) => <option key={category} value={category} />)}
                      </datalist>
                    </label>

                    <label>
                      Nombre
                      <input
                        className="inventory-input"
                        value={draft.nombre}
                        onChange={(event) => updateDraft("nombre", event.target.value)}
                        placeholder="Nombre visible del producto"
                      />
                    </label>

                    <label>
                      Marca
                      <input
                        className="inventory-input"
                        value={draft.marca}
                        onChange={(event) => updateDraft("marca", event.target.value)}
                        placeholder="Marca del producto"
                      />
                    </label>

                    <label className="field-span-2">
                      Descripcion
                      <textarea
                        className="inventory-input inventory-textarea"
                        value={draft.descripcion}
                        onChange={(event) => updateDraft("descripcion", event.target.value)}
                        placeholder="Describe el producto para identificarlo rapido."
                        rows={3}
                      />
                    </label>

                    <label>
                      Costo
                      <input
                        className="inventory-input"
                        type="number"
                        min="0"
                        step="0.01"
                        value={draft.costo}
                        onChange={(event) => updateDraft("costo", event.target.value)}
                      />
                    </label>

                    <label>
                      Precio de venta
                      <input
                        className="inventory-input"
                        type="number"
                        min="0"
                        step="0.01"
                        value={draft.precio}
                        onChange={(event) => updateDraft("precio", event.target.value)}
                      />
                    </label>

                    <label>
                      Precio mayorista
                      <input
                        className="inventory-input"
                        type="number"
                        min="0"
                        step="0.01"
                        value={draft.precioMayorista}
                        onChange={(event) => updateDraft("precioMayorista", event.target.value)}
                      />
                    </label>

                    <label>
                      Stock inicial
                      <input
                        className="inventory-input"
                        type="number"
                        min="0"
                        step="1"
                        value={draft.stock}
                        onChange={(event) => updateDraft("stock", event.target.value)}
                      />
                    </label>

                    <label>
                      Stock minimo
                      <input
                        className="inventory-input"
                        type="number"
                        min="0"
                        step="1"
                        value={draft.stockMinimo}
                        onChange={(event) => updateDraft("stockMinimo", event.target.value)}
                      />
                    </label>
                  </div>

                  {formError && <p className="form-error">{formError}</p>}

                  <div className="modal-actions">
                    <button className="ghost" type="button" onClick={closeModal}>Cancelar</button>
                    <button type="submit">{modalMode === "create" ? "Guardar producto" : "Guardar cambios"}</button>
                  </div>
                </form>
              </>
            ) : (
              <>
                <div>
                  <h2 id="inventory-modal-title">Eliminar producto</h2>
                  <p className="muted">
                    Vas a eliminar <strong>{selectedProduct?.nombre}</strong> con codigo <strong>{selectedProduct?.id}</strong>.
                    Esta accion no se puede deshacer.
                  </p>
                </div>

                <div className="modal-actions">
                  <button className="ghost" type="button" onClick={closeModal}>Cancelar</button>
                  <button className="danger" type="button" onClick={deleteProduct}>Eliminar</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {isAdmin && unknownScanDraft && (
        <QuickScanProductModal
          draft={unknownScanDraft}
          error={unknownScanError}
          submitLabel="Guardar en inventario"
          onClose={closeUnknownScanModal}
          onSubmit={submitUnknownScanProduct}
          onDraftChange={(updater) => setUnknownScanDraft((prev) => (prev ? updater(prev) : prev))}
          onClearError={() => setUnknownScanError("")}
        />
      )}
    </section>
  );
}
