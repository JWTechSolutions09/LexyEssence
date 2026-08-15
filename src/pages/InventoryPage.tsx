import { useCallback, useState, type FormEvent } from "react";
import { useAppContext } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";
import { useBarcodeCapture } from "../hooks/useBarcodeCapture";
import { findProductByCode, normalizeScanCode } from "../hooks/useBarcodeScanner";
import type { Product } from "../types/domain";
import {
  AMPOOLLA_CATEGORY,
  calcularCajasDisponibles,
  calcularUnidadesSueltas,
  formatAmpollaStockLabel,
  formatAmpollaStockResumen,
  isAmpolla,
  stockFromCajasYSueltas,
} from "../utils/ampolla";
import { currency } from "../utils/format";
import { createStockMovement } from "../utils/stockMovements";

const baseCategories = ["Cosméticos", "Cuidado de Piel", "Herramientas", "Fragancias", "Accesorios", AMPOOLLA_CATEGORY];
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
  esAmpolla: string;
  unidadesPorCaja: string;
  precioCaja: string;
  precioUnidad: string;
  codigoBarraCaja: string;
  stockCajas: string;
  stockSueltas: string;
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
  esAmpolla: "",
  unidadesPorCaja: "12",
  precioCaja: "0",
  precioUnidad: "0",
  codigoBarraCaja: "",
  stockCajas: "0",
  stockSueltas: "0",
};

function syncAmpollaStockFields(form: ProductFormState): ProductFormState {
  const unidadesPorCaja = Math.max(1, Number(form.unidadesPorCaja) || 12);
  const stock = stockFromCajasYSueltas(
    Number(form.stockCajas) || 0,
    Number(form.stockSueltas) || 0,
    unidadesPorCaja,
  );

  return { ...form, stock: String(stock) };
}

function readProductFormFromElement(form: HTMLFormElement): ProductFormState {
  const data = new FormData(form);
  const value = (key: keyof ProductFormState) => String(data.get(key) ?? "").trim();

  return {
    id: value("id"),
    nombre: value("nombre"),
    marca: value("marca"),
    descripcion: value("descripcion"),
    categoria: value("categoria") || baseCategories[0],
    costo: value("costo") || "0",
    precio: value("precio") || "0",
    precioMayorista: value("precioMayorista") || "0",
    stock: value("stock") || "0",
    stockMinimo: value("stockMinimo") || "0",
    esAmpolla: value("esAmpolla"),
    unidadesPorCaja: value("unidadesPorCaja") || "12",
    precioCaja: value("precioCaja") || "0",
    precioUnidad: value("precioUnidad") || "0",
    codigoBarraCaja: value("codigoBarraCaja"),
    stockCajas: value("stockCajas") || "0",
    stockSueltas: value("stockSueltas") || "0",
  };
}

function buildProductFromFormState(
  formState: ProductFormState,
  products: Product[],
  editingProductId: string | null,
): ProductDraftResult {
  const id = formState.id.trim().toUpperCase();
  const nombre = formState.nombre.trim();
  const marca = formState.marca.trim();
  const descripcion = formState.descripcion.trim();
  const categoria = formState.categoria.trim();
  const costo = Number(formState.costo);
  const precio = Number(formState.precio);
  const precioMayorista = Number(formState.precioMayorista);
  const stockInput = Number(formState.stock);
  const stockMinimo = Number(formState.stockMinimo);
  const esAmpolla = formState.esAmpolla === "on" || formState.esAmpolla === "true";
  const unidadesPorCaja = Number(formState.unidadesPorCaja);
  const precioCaja = Number(formState.precioCaja);
  const precioUnidad = Number(formState.precioUnidad);
  const codigoBarraCaja = (formState.codigoBarraCaja || id).trim().toUpperCase();
  const stockCajas = Number(formState.stockCajas);
  const stockSueltas = Number(formState.stockSueltas);

  if (!id || !nombre || !marca || !categoria) {
    return { error: "Completa codigo, nombre, marca y categoria." };
  }

  if (esAmpolla) {
    if (!codigoBarraCaja) {
      return { error: "Indica el codigo de barras de la caja." };
    }
    if (!Number.isInteger(unidadesPorCaja) || unidadesPorCaja < 1) {
      return { error: "Unidades por caja debe ser un entero mayor o igual a 1." };
    }
    if (!Number.isFinite(precioCaja) || precioCaja < 0) {
      return { error: "Precio caja invalido." };
    }
    if (!Number.isFinite(precioUnidad) || precioUnidad < 0) {
      return { error: "Precio unidad invalido." };
    }

    const costoPorCaja = costo;
    const costoUnitario = costoPorCaja / unidadesPorCaja;

    if (!Number.isFinite(costoPorCaja) || costoPorCaja < 0) {
      return { error: "Costo por caja invalido." };
    }
    if (precioUnidad < costoUnitario) {
      return { error: "Precio unidad no puede ser menor al costo por unidad." };
    }
    if (precioCaja < costoPorCaja) {
      return { error: "Precio caja no puede ser menor al costo de la caja." };
    }
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

  let stock = stockInput;
  if (esAmpolla) {
    if (!Number.isInteger(stockCajas) || stockCajas < 0) {
      return { error: "Las cajas en stock deben ser un entero mayor o igual a 0." };
    }
    if (!Number.isInteger(stockSueltas) || stockSueltas < 0) {
      return { error: "Las unidades sueltas deben ser un entero mayor o igual a 0." };
    }
    if (stockSueltas >= unidadesPorCaja) {
      return {
        error: `Las unidades sueltas deben ser menor a ${unidadesPorCaja}. Suma una caja completa en lugar de mas unidades sueltas.`,
      };
    }
    stock = stockFromCajasYSueltas(stockCajas, stockSueltas, unidadesPorCaja);
  }

  if (!Number.isInteger(stock) || stock < 0) {
    return { error: "El stock debe ser un numero entero mayor o igual a 0." };
  }

  if (!Number.isInteger(stockMinimo) || stockMinimo < 0) {
    return { error: "El stock minimo debe ser un numero entero mayor o igual a 0." };
  }

  if (!esAmpolla && precio < costo) {
    return { error: "El precio de venta no puede ser menor al costo." };
  }

  if (!esAmpolla && precioMayorista < costo) {
    return { error: "El precio mayorista no puede ser menor al costo." };
  }

  if (!esAmpolla && precioMayorista > precio) {
    return { error: "El precio de venta debe ser mayor o igual al precio mayorista." };
  }

  const resolvedId = esAmpolla ? codigoBarraCaja : id;

  const duplicate = products.some((product) => {
    if (editingProductId && product.id === editingProductId) return false;
    if (product.id.toLowerCase() === resolvedId.toLowerCase()) return true;
    if (esAmpolla && product.codigoBarraCaja?.toLowerCase() === codigoBarraCaja.toLowerCase()) return true;
    return false;
  });

  if (duplicate) {
    return { error: "Ya existe un producto con ese codigo." };
  }

  const costoGuardado = esAmpolla
    ? Math.round((costo / unidadesPorCaja) * 100) / 100
    : costo;
  const costoCajaFinal = esAmpolla ? costo : undefined;
  const costoUnidadFinal = esAmpolla ? costoGuardado : undefined;
  const precioVenta = esAmpolla ? precioUnidad : precio;
  const precioMayoristaFinal = esAmpolla
    ? (precioMayorista > 0 ? precioMayorista : Math.round(precioUnidad * 0.85 * 100) / 100)
    : precioMayorista;

  return {
    product: {
      id: resolvedId,
      nombre,
      marca,
      descripcion,
      categoria: esAmpolla ? AMPOOLLA_CATEGORY : categoria,
      costo: costoGuardado,
      costoCaja: costoCajaFinal,
      costoUnidad: costoUnidadFinal,
      precio: precioVenta,
      precioMayorista: precioMayoristaFinal,
      stock,
      stockMinimo,
      esAmpolla: esAmpolla || undefined,
      unidadesPorCaja: esAmpolla ? unidadesPorCaja : undefined,
      precioCaja: esAmpolla ? precioCaja : undefined,
      precioUnidad: esAmpolla ? precioUnidad : undefined,
      codigoBarraCaja: esAmpolla ? codigoBarraCaja : undefined,
    } satisfies Product,
  };
}

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
  const [isScanCreate, setIsScanCreate] = useState(false);
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
    setIsScanCreate(false);
    setModalMode("create");
  }

  function openCreateModalFromScan(code: string) {
    setDraft({
      ...emptyProductForm,
      id: code.toUpperCase(),
      stock: "1",
      stockCajas: "0",
      stockSueltas: "1",
      stockMinimo: "1",
    });
    setEditingProductId(null);
    setSelectedProduct(null);
    setFormError("");
    setIsScanCreate(true);
    setModalMode("create");
  }

  function openEditModal(product: Product) {
    setDraft({
      id: product.id,
      nombre: product.nombre,
      marca: product.marca,
      descripcion: product.descripcion,
      categoria: product.categoria,
      costo: String(
        isAmpolla(product)
          ? (product.costoCaja ?? (product.costo * (product.unidadesPorCaja ?? 1)))
          : product.costo,
      ),
      precio: String(isAmpolla(product) ? (product.precioUnidad ?? product.precio) : product.precio),
      precioMayorista: String(product.precioMayorista),
      stock: String(product.stock),
      stockMinimo: String(product.stockMinimo),
      esAmpolla: isAmpolla(product) ? "true" : "",
      unidadesPorCaja: String(product.unidadesPorCaja ?? 12),
      precioCaja: String(product.precioCaja ?? 0),
      precioUnidad: String(product.precioUnidad ?? product.precio),
      codigoBarraCaja: product.codigoBarraCaja ?? product.id,
      stockCajas: String(
        isAmpolla(product)
          ? calcularCajasDisponibles(product.stock, product.unidadesPorCaja ?? 1)
          : 0,
      ),
      stockSueltas: String(
        isAmpolla(product)
          ? calcularUnidadesSueltas(product.stock, product.unidadesPorCaja ?? 1)
          : 0,
      ),
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
    setIsScanCreate(false);
  }

  function updateDraft(field: keyof ProductFormState, value: string) {
    if (formError) setFormError("");
    setDraft((prev) => {
      const next = { ...prev, [field]: value };
      if (
        next.esAmpolla === "true" &&
        (field === "stockCajas" || field === "stockSueltas" || field === "unidadesPorCaja")
      ) {
        return syncAmpollaStockFields(next);
      }
      return next;
    });
  }

  function submitProduct(event: FormEvent<HTMLFormElement>): boolean {
    event.preventDefault();

    const formState = readProductFormFromElement(event.currentTarget);
    const result = buildProductFromFormState(formState, products, editingProductId);
    if ("error" in result) {
      setFormError(result.error);
      setDraft(formState);
      return false;
    }

    setDraft(formState);
    const savedFromScan = isScanCreate && modalMode === "create";

    if (modalMode === "create") {
      const fromScan = isScanCreate;
      setProducts((prev) => [result.product, ...prev]);
      if (result.product.stock > 0) {
        appendStockMovements([createStockMovement({
          tipo: "entrada",
          productId: result.product.id,
          nombre: result.product.nombre,
          cantidad: result.product.stock,
          motivo: fromScan ? "Registro por escaneo" : "Alta de producto",
          fecha: new Date().toISOString(),
        })]);
      }
      setQuery(result.product.id);
      setNotice(
        fromScan
          ? `Producto registrado en inventario: ${result.product.nombre}`
          : `Producto ${result.product.nombre} agregado correctamente.`,
      );
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
    return savedFromScan;
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
    window.setTimeout(() => { void forceSave(); }, 0);
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

    openCreateModalFromScan(code);
  }, [isAdmin, quickScanMode, products, setNotice]);

  const {
    scanInputRef,
    handleCaptureKeyDown,
    handleCaptureBlur,
    focusScannerCapture,
    handleSearchKeyDown,
  } = useBarcodeCapture({
    onScan: registerScannedCode,
    isPaused: () => modalMode !== null,
  });

  const closeModalWithScannerRefocus = useCallback(() => {
    const shouldRefocus = isScanCreate;
    closeModal();
    if (shouldRefocus) {
      window.setTimeout(() => focusScannerCapture(), 80);
    }
  }, [isScanCreate, focusScannerCapture]);

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
              ? "Modo escaneo rapido: cada codigo conocido suma +1 al stock. Los nuevos abren el formulario completo."
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

                {isAmpolla(product) && (
                  <p className="inventory-description">
                    <span className="badge">Ampolla</span>
                    {" "}Caja {currency(product.precioCaja ?? 0)} · Unidad {currency(product.precioUnidad ?? product.precio)}
                    {" "}· {product.unidadesPorCaja ?? 1} u/caja
                  </p>
                )}

                <div className="inventory-meta-grid">
                  <div className="inventory-metric-card highlight">
                    <span className="muted">{isAmpolla(product) ? "Precio unidad" : "Precio venta"}</span>
                    <strong>{currency(isAmpolla(product) ? (product.precioUnidad ?? product.precio) : product.precio)}</strong>
                  </div>
                  <div className="inventory-metric-card">
                    <span className="muted">Precio mayorista</span>
                    <strong>{currency(product.precioMayorista)}</strong>
                  </div>
                  {isAdmin && (
                    <div className="inventory-metric-card">
                      <span className="muted">{isAmpolla(product) ? "Costo unidad" : "Costo"}</span>
                      <strong>{currency(isAmpolla(product) ? (product.costoUnidad ?? product.costo) : product.costo)}</strong>
                    </div>
                  )}
                  {isAdmin && isAmpolla(product) && (
                    <div className="inventory-metric-card">
                      <span className="muted">Costo caja</span>
                      <strong>{currency(product.costoCaja ?? ((product.costoUnidad ?? product.costo) * (product.unidadesPorCaja ?? 1)))}</strong>
                    </div>
                  )}
                  <div className="inventory-metric-card stock">
                    <span className="muted">{isAmpolla(product) ? "Stock" : "Stock unidades"}</span>
                    {isAmpolla(product) ? (
                      <>
                        <strong>
                          {calcularCajasDisponibles(product.stock, product.unidadesPorCaja ?? 1)} cajas
                          {" + "}
                          {calcularUnidadesSueltas(product.stock, product.unidadesPorCaja ?? 1)} sueltas
                        </strong>
                        <span className="muted">{product.stock} u. en total</span>
                      </>
                    ) : (
                      <strong>{product.stock}</strong>
                    )}
                  </div>
                </div>

                <div className="inventory-details-row">
                  {isAmpolla(product) && (
                    <span className="badge success">{formatAmpollaStockLabel(product)}</span>
                  )}
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
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={isScanCreate && modalMode === "create" ? closeModalWithScannerRefocus : closeModal}
        >
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
                    <h2 id="inventory-modal-title">
                      {modalMode === "create"
                        ? (isScanCreate ? "Agregar producto escaneado" : "Agregar producto")
                        : "Editar producto"}
                    </h2>
                    <p className="muted">
                      {modalMode === "create" && isScanCreate
                        ? (
                          <>
                            El codigo <strong>{draft.id}</strong> no esta en inventario.
                            Completa marca, costos, precios y stock como al agregar manualmente.
                          </>
                        )
                        : modalMode === "create"
                          ? "Registra codigo, precios y stock inicial como en un panel de inventario real."
                          : "Actualiza costos, precios, stock y datos generales del producto."}
                    </p>
                  </div>
                  <button
                    className="ghost"
                    type="button"
                    onClick={isScanCreate && modalMode === "create" ? closeModalWithScannerRefocus : closeModal}
                  >
                    Cerrar
                  </button>
                </div>

                <form
                  className="inventory-form"
                  autoComplete="off"
                  onSubmit={(event) => {
                    const refocusAfterSave = isScanCreate && modalMode === "create";
                    if (submitProduct(event) && refocusAfterSave) {
                      window.setTimeout(() => focusScannerCapture(), 80);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && event.target !== event.currentTarget) {
                      event.stopPropagation();
                    }
                  }}
                >
                  <div className="inventory-form-grid">
                    <label>
                      Codigo
                      <input
                        className="inventory-input"
                        data-manual-input
                        name="id"
                        value={draft.id}
                        onChange={(event) => updateDraft("id", event.target.value)}
                        placeholder="Ej. LEX-CM-100"
                      />
                    </label>

                    <label>
                      Categoria
                      <input
                        className="inventory-input"
                        data-manual-input
                        name="categoria"
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
                        data-manual-input
                        name="nombre"
                        value={draft.nombre}
                        onChange={(event) => updateDraft("nombre", event.target.value)}
                        placeholder="Nombre visible del producto"
                      />
                    </label>

                    <label>
                      Marca
                      <input
                        className="inventory-input"
                        data-manual-input
                        name="marca"
                        value={draft.marca}
                        onChange={(event) => updateDraft("marca", event.target.value)}
                        placeholder="Marca del producto"
                      />
                    </label>

                    <label className="field-span-2">
                      Descripcion
                      <textarea
                        className="inventory-input inventory-textarea"
                        data-manual-input
                        name="descripcion"
                        value={draft.descripcion}
                        onChange={(event) => updateDraft("descripcion", event.target.value)}
                        placeholder="Describe el producto para identificarlo rapido."
                        rows={3}
                      />
                    </label>

                    <label className="field-span-2 inventory-checkbox">
                      <input
                        type="checkbox"
                        name="esAmpolla"
                        data-manual-input
                        checked={draft.esAmpolla === "true"}
                        onChange={(event) => {
                          const checked = event.target.checked;
                          setDraft((prev) => {
                            const next: ProductFormState = {
                              ...prev,
                              esAmpolla: checked ? "true" : "",
                              categoria: checked ? AMPOOLLA_CATEGORY : prev.categoria,
                            };
                            if (!checked) return next;

                            const upc = Math.max(1, Number(next.unidadesPorCaja) || 12);
                            const total = Math.max(0, Number(next.stock) || 0);
                            return syncAmpollaStockFields({
                              ...next,
                              stockCajas: String(calcularCajasDisponibles(total, upc)),
                              stockSueltas: String(calcularUnidadesSueltas(total, upc)),
                            });
                          });
                          if (formError) setFormError("");
                        }}
                      />
                      ¿Es una ampolla?
                    </label>

                    {draft.esAmpolla === "true" && (
                      <>
                        <label>
                          Codigo barras caja
                          <input
                            className="inventory-input"
                            data-manual-input
                            name="codigoBarraCaja"
                            value={draft.codigoBarraCaja || draft.id}
                            onChange={(event) => {
                              updateDraft("codigoBarraCaja", event.target.value);
                              updateDraft("id", event.target.value);
                            }}
                            placeholder="Ej. 7894561230001"
                          />
                        </label>
                        <label>
                          Unidades por caja
                          <input
                            className="inventory-input"
                            data-manual-input
                            name="unidadesPorCaja"
                            type="number"
                            min="1"
                            step="1"
                            value={draft.unidadesPorCaja}
                            onChange={(event) => updateDraft("unidadesPorCaja", event.target.value)}
                          />
                        </label>
                        <label>
                          Precio caja
                          <input
                            className="inventory-input"
                            data-manual-input
                            name="precioCaja"
                            type="number"
                            min="0"
                            step="0.01"
                            value={draft.precioCaja}
                            onChange={(event) => updateDraft("precioCaja", event.target.value)}
                          />
                        </label>
                        <label>
                          Precio unidad
                          <input
                            className="inventory-input"
                            data-manual-input
                            name="precioUnidad"
                            type="number"
                            min="0"
                            step="0.01"
                            value={draft.precioUnidad}
                            onChange={(event) => updateDraft("precioUnidad", event.target.value)}
                          />
                        </label>
                        <div className="field-span-2 ampolla-stock-panel">
                          <p className="ampolla-stock-panel-title">Inventario en almacen</p>
                          <p className="muted ampolla-stock-hint">
                            Cada caja trae {draft.unidadesPorCaja || "—"} unidades.
                            {" "}Indica cuantas cajas selladas tienes y cuantas ampollas sueltas (fuera de caja).
                          </p>
                          <div className="ampolla-stock-inputs">
                            <label>
                              Cajas completas
                              <input
                                className="inventory-input"
                                data-manual-input
                                name="stockCajas"
                                type="number"
                                min="0"
                                step="1"
                                value={draft.stockCajas}
                                onChange={(event) => updateDraft("stockCajas", event.target.value)}
                              />
                            </label>
                            <label>
                              Unidades sueltas
                              <input
                                className="inventory-input"
                                data-manual-input
                                name="stockSueltas"
                                type="number"
                                min="0"
                                max={Math.max(0, Number(draft.unidadesPorCaja) - 1) || undefined}
                                step="1"
                                value={draft.stockSueltas}
                                onChange={(event) => updateDraft("stockSueltas", event.target.value)}
                              />
                              <span className="muted">
                                Ampollas sueltas (max. {Math.max(0, Number(draft.unidadesPorCaja || 12) - 1)} por caja)
                              </span>
                            </label>
                          </div>
                          <input type="hidden" name="stock" value={draft.stock} />
                          <div className="ampolla-stock-summary" aria-live="polite">
                            <span className="muted">Total en inventario</span>
                            <strong>
                              {formatAmpollaStockResumen(
                                Number(draft.stock) || 0,
                                Number(draft.unidadesPorCaja) || 12,
                              )}
                            </strong>
                          </div>
                        </div>
                      </>
                    )}

                    <label>
                      {draft.esAmpolla === "true" ? "Costo por caja" : "Costo"}
                      <input
                        className="inventory-input"
                        data-manual-input
                        name="costo"
                        type="number"
                        min="0"
                        step="0.01"
                        value={draft.costo}
                        onChange={(event) => updateDraft("costo", event.target.value)}
                      />
                      {draft.esAmpolla === "true" && draft.costo && draft.unidadesPorCaja && (
                        <span className="muted">
                          Costo por unidad: {currency(Number(draft.costo) / Number(draft.unidadesPorCaja))}
                        </span>
                      )}
                    </label>

                    {draft.esAmpolla !== "true" && (
                    <label>
                      Precio de venta
                      <input
                        className="inventory-input"
                        data-manual-input
                        name="precio"
                        type="number"
                        min="0"
                        step="0.01"
                        value={draft.precio}
                        onChange={(event) => updateDraft("precio", event.target.value)}
                      />
                    </label>
                    )}

                    {draft.esAmpolla !== "true" && (
                    <label>
                      Precio mayorista
                      <input
                        className="inventory-input"
                        data-manual-input
                        name="precioMayorista"
                        type="number"
                        min="0"
                        step="0.01"
                        value={draft.precioMayorista}
                        onChange={(event) => updateDraft("precioMayorista", event.target.value)}
                      />
                    </label>
                    )}

                    {draft.esAmpolla !== "true" && (
                    <label>
                      Stock inicial
                      <input
                        className="inventory-input"
                        data-manual-input
                        name="stock"
                        type="number"
                        min="0"
                        step="1"
                        value={draft.stock}
                        onChange={(event) => updateDraft("stock", event.target.value)}
                      />
                    </label>
                    )}

                    <label>
                      Stock minimo
                      <input
                        className="inventory-input"
                        data-manual-input
                        name="stockMinimo"
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
                    <button
                      className="ghost"
                      type="button"
                      onClick={isScanCreate && modalMode === "create" ? closeModalWithScannerRefocus : closeModal}
                    >
                      Cancelar
                    </button>
                    <button type="submit">
                      {modalMode === "create"
                        ? (isScanCreate ? "Guardar en inventario" : "Guardar producto")
                        : "Guardar cambios"}
                    </button>
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

    </section>
  );
}
