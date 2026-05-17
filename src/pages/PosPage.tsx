import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { CashCloseModal } from "../components/CashCloseModal";
import { CashOpenModal } from "../components/CashOpenModal";
import { CashPaymentModal } from "../components/CashPaymentModal";
import { PosOptionPickerModal } from "../components/PosOptionPickerModal";
import { TransferPaymentModal } from "../components/TransferPaymentModal";
import { useAppContext } from "../context/AppContext";
import type { CashCloseSummary } from "../types/cashSession";
import { findProductByCode, isScanTerminator, normalizeScanCode } from "../hooks/useBarcodeScanner";
import type { Product, Transaction } from "../types/domain";
import type { SaleReceipt } from "../types/receipt";
import { currency } from "../utils/format";
import { createStockMovement, movementsFromSale } from "../utils/stockMovements";
import { buildQuickProductFromScan } from "../utils/quickProduct";
import { computeCloseSummary } from "../utils/cashSession";
import { printThermalCashClose } from "../utils/printThermalCashClose";
import { printThermalReceipt } from "../utils/printThermalReceipt";

const availabilityFilters = ["Todos", "Disponibles", "Stock bajo", "Agotados"] as const;
const paymentMethods = ["Efectivo", "Tarjeta", "Transferencia", "Mixto"] as const;
const customerOptions = [
  { value: "Cliente mostrador", label: "Cliente mostrador", hint: "Precio al detalle", pricingMode: "detalle" as const },
  { value: "Cliente Mayorista", label: "Cliente Mayorista", hint: "Precio mayorista", pricingMode: "mayorista" as const },
  { value: "Envio", label: "Envio", hint: "Pedido para entrega", pricingMode: "detalle" as const },
];

const paymentOptions = paymentMethods.map((method) => ({
  value: method,
  label: method,
}));

type SalePickerModal = "customer" | "payment" | null;
type AvailabilityFilter = typeof availabilityFilters[number];
type PricingMode = "detalle" | "mayorista";
type PaymentMethod = typeof paymentMethods[number];

function getProductStatus(product: Product) {
  if (product.stock <= 0) return { label: "Agotado", className: "danger" };
  if (product.stock <= product.stockMinimo) return { label: "Stock bajo", className: "warn" };
  return { label: "Disponible", className: "success" };
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-DO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function PosPage() {
  const {
    cart,
    setCart,
    products,
    setProducts,
    appendStockMovements,
    transactions,
    setTransactions,
    cashierOpen,
    currentCashSession,
    openCashSession,
    closeCashSession,
    setNotice,
  } = useAppContext();

  const [categoryFilter, setCategoryFilter] = useState("Todos");
  const [availabilityFilter, setAvailabilityFilter] = useState<AvailabilityFilter>("Todos");
  const [search, setSearch] = useState("");
  const [customerName, setCustomerName] = useState("Cliente mostrador");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Efectivo");
  const [pricingMode, setPricingMode] = useState<PricingMode>("detalle");
  const [discountInput, setDiscountInput] = useState("0");
  const [saleNote, setSaleNote] = useState("");
  const [lastReceipt, setLastReceipt] = useState<SaleReceipt | null>(null);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [scanCount, setScanCount] = useState(0);
  const [unknownScanDraft, setUnknownScanDraft] = useState<{
    id: string;
    nombre: string;
    precio: string;
    stock: string;
  } | null>(null);
  const [unknownScanError, setUnknownScanError] = useState("");
  const [salePickerModal, setSalePickerModal] = useState<SalePickerModal>(null);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferConfirmed, setTransferConfirmed] = useState<boolean | null>(null);
  const [cashOpenModalOpen, setCashOpenModalOpen] = useState(false);
  const [cashCloseModalOpen, setCashCloseModalOpen] = useState(false);
  const [cashPaymentModalOpen, setCashPaymentModalOpen] = useState(false);
  const [closeSummaryPreview, setCloseSummaryPreview] = useState<CashCloseSummary | null>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);
  const unknownNameInputRef = useRef<HTMLInputElement>(null);

  const categories = useMemo(
    () => ["Todos", ...new Set(products.map((product) => product.categoria))],
    [products],
  );

  function getSalePrice(product: Product, mode = pricingMode) {
    return mode === "mayorista" ? product.precioMayorista : product.precio;
  }

  useEffect(() => {
    setCart((prev) => prev
      .map((item) => {
        const source = products.find((product) => product.id === item.id);
        if (!source) return item;

        return {
          ...source,
          cantidad: Math.min(item.cantidad, source.stock),
          precio: getSalePrice(source, pricingMode),
        };
      })
      .filter((item) => item.cantidad > 0));
  }, [pricingMode, products, setCart]);

  const cartItemCount = useMemo(
    () => cart.reduce((acc, item) => acc + item.cantidad, 0),
    [cart],
  );

  const subtotal = useMemo(
    () => cart.reduce((acc, item) => acc + item.precio * item.cantidad, 0),
    [cart],
  );

  const discount = Math.min(Math.max(Number(discountInput) || 0, 0), subtotal);
  const total = Math.max(0, subtotal - discount);

  const visibleProducts = useMemo(() => products.filter((product) => {
    const categoryMatch = categoryFilter === "Todos" || product.categoria === categoryFilter;
    const availabilityMatch =
      availabilityFilter === "Todos"
      || (availabilityFilter === "Disponibles" && product.stock > product.stockMinimo)
      || (availabilityFilter === "Stock bajo" && product.stock > 0 && product.stock <= product.stockMinimo)
      || (availabilityFilter === "Agotados" && product.stock <= 0);
    const searchMatch = `${product.nombre} ${product.id} ${product.marca} ${product.categoria}`
      .toLowerCase()
      .includes(search.toLowerCase());

    return categoryMatch && availabilityMatch && searchMatch;
  }), [availabilityFilter, categoryFilter, products, search]);

  function getCartQty(productId: string) {
    return cart.find((item) => item.id === productId)?.cantidad ?? 0;
  }

  const addToCart = useCallback((product: Product, options?: { fromScanner?: boolean }) => {
    if (product.stock <= 0) {
      setNotice("No hay stock disponible para ese producto.");
      return false;
    }

    if (lastReceipt) {
      setLastReceipt(null);
    }

    setCart((prev) => {
      const found = prev.find((item) => item.id === product.id);

      if (found && found.cantidad >= product.stock) {
        setNotice(`Solo quedan ${product.stock} unidades disponibles.`);
        return prev;
      }

      if (found) {
        return prev.map((item) => (
          item.id === product.id
            ? { ...item, cantidad: item.cantidad + 1, precio: getSalePrice(product) }
            : item
        ));
      }

      return [...prev, { ...product, precio: getSalePrice(product), cantidad: 1 }];
    });

    if (options?.fromScanner) {
      setLastScannedCode(product.id);
      setScanCount((prev) => prev + 1);
    }

    setNotice(`Producto agregado: ${product.nombre}`);
    return true;
  }, [lastReceipt, pricingMode, setCart, setNotice]);

  const registerScannedCode = useCallback((rawCode: string) => {
    const code = normalizeScanCode(rawCode);
    if (!code) return;

    if (!cashierOpen) {
      setNotice("Abre la caja antes de escanear productos.");
      return;
    }

    const product = findProductByCode(products, code);
    if (!product) {
      setLastScannedCode(code);
      setUnknownScanError("");
      setUnknownScanDraft({
        id: code.toUpperCase(),
        nombre: "",
        precio: "0",
        stock: "1",
      });
      return;
    }

    addToCart(product, { fromScanner: true });
    setSearch("");
    scanInputRef.current?.focus();
  }, [addToCart, cashierOpen, products]);

  const closeUnknownScanModal = useCallback(() => {
    setUnknownScanDraft(null);
    setUnknownScanError("");
    window.setTimeout(() => scanInputRef.current?.focus(), 80);
  }, []);

  function submitUnknownScanProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!unknownScanDraft) return;

    const result = buildQuickProductFromScan(unknownScanDraft, products);
    if ("error" in result) {
      setUnknownScanError(result.error);
      return;
    }

    const product = result.product;
    if (product.stock <= 0) {
      setUnknownScanError("Indica stock inicial de al menos 1 unidad para venderlo ahora.");
      return;
    }
    setProducts((prev) => [...prev, product]);
    appendStockMovements([createStockMovement({
      tipo: "entrada",
      productId: product.id,
      nombre: product.nombre,
      cantidad: product.stock,
      motivo: "Registro por escaneo (POS)",
      fecha: new Date().toISOString(),
    })]);
    addToCart(product, { fromScanner: true });
    setUnknownScanDraft(null);
    setUnknownScanError("");
    setSearch("");
    setNotice(`Producto registrado y agregado: ${product.nombre}`);
    window.setTimeout(() => scanInputRef.current?.focus(), 80);
  }

  function selectCustomer(value: string) {
    const option = customerOptions.find((entry) => entry.value === value);
    setCustomerName(value);
    if (option) setPricingMode(option.pricingMode);
    setSalePickerModal(null);
  }

  function selectPayment(value: string) {
    const method = value as PaymentMethod;
    setPaymentMethod(method);
    setSalePickerModal(null);

    if (method === "Transferencia") {
      setTransferConfirmed(null);
      setTransferModalOpen(true);
      return;
    }

    setTransferConfirmed(null);
  }

  function handleTransferConfirm(confirmed: boolean) {
    setTransferConfirmed(confirmed);
    setTransferModalOpen(false);
    setNotice(
      confirmed
        ? "Transferencia confirmada. Puedes completar la venta."
        : "Pago pendiente. La venta se registrara sin confirmar la transferencia.",
    );
  }

  function closeTransferModal() {
    setTransferModalOpen(false);
    if (transferConfirmed === null) {
      setPaymentMethod("Efectivo");
      setNotice("Metodo de pago restablecido a Efectivo.");
    }
  }

  const paymentMethodLabel = useMemo(() => {
    if (paymentMethod === "Transferencia" && transferConfirmed === false) {
      return "Transferencia (Pendiente)";
    }
    if (paymentMethod === "Transferencia" && transferConfirmed === true) {
      return "Transferencia (Confirmada)";
    }
    return paymentMethod;
  }, [paymentMethod, transferConfirmed]);

  function requestOpenCash() {
    if (cashierOpen) {
      setNotice("La caja ya esta abierta.");
      return;
    }
    setCashOpenModalOpen(true);
  }

  function requestCloseCash() {
    if (!cashierOpen || !currentCashSession) {
      setNotice("No hay una sesion de caja abierta.");
      return;
    }
    const closedAt = new Date().toISOString();
    const summary = computeCloseSummary(
      transactions,
      currentCashSession.openingAmount,
      currentCashSession.openedAt,
      closedAt,
    );
    setCloseSummaryPreview(summary);
    setCashCloseModalOpen(true);
  }

  function handleCashOpenConfirm(openingAmount: number, openedAt: string) {
    openCashSession(openingAmount, openedAt);
    setCashOpenModalOpen(false);
    setNotice(`Caja abierta con ${currency(openingAmount)} el ${formatDateTime(openedAt)}.`);
  }

  async function handleCashCloseConfirm() {
    if (!currentCashSession || !closeSummaryPreview) return;

    const closedAt = new Date().toISOString();
    const summary = computeCloseSummary(
      transactions,
      currentCashSession.openingAmount,
      currentCashSession.openedAt,
      closedAt,
    );

    closeCashSession(summary, closedAt);
    setCashCloseModalOpen(false);
    setCloseSummaryPreview(null);

    const printed = await printThermalCashClose({
      sessionId: currentCashSession.id,
      openedAt: currentCashSession.openedAt,
      closedAt,
      summary,
    });

    setNotice(
      printed
        ? "Caja cerrada. Imprimiendo recibo de cierre..."
        : "Caja cerrada. No se pudo abrir la impresion del cierre.",
    );
  }

  const shouldRefocusScanner = useCallback(() => {
    if (unknownScanDraft || salePickerModal || transferModalOpen || cashOpenModalOpen || cashCloseModalOpen) {
      return false;
    }
    const active = document.activeElement;
    if (!active) return true;
    if (active === scanInputRef.current) return false;
    return !active.closest("[data-manual-input]");
  }, [cashCloseModalOpen, cashOpenModalOpen, cashPaymentModalOpen, salePickerModal, transferModalOpen, unknownScanDraft]);

  useEffect(() => {
    if (!unknownScanDraft) return;
    unknownNameInputRef.current?.focus();
  }, [unknownScanDraft]);

  useEffect(() => {
    if (!unknownScanDraft) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") closeUnknownScanModal();
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [unknownScanDraft, closeUnknownScanModal]);

  const focusScannerCapture = useCallback(() => {
    scanInputRef.current?.focus();
    setNotice("Lector USB listo. Escanea un codigo de barras.");
  }, [setNotice]);

  useEffect(() => {
    const refocus = () => {
      if (shouldRefocusScanner()) scanInputRef.current?.focus();
    };

    refocus();
    const timer = window.setInterval(refocus, 600);
    const onVisibility = () => {
      if (document.visibilityState === "visible") refocus();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", refocus);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", refocus);
    };
  }, [shouldRefocusScanner]);

  function processScanFromInput(
    event: React.KeyboardEvent<HTMLInputElement>,
    options?: { clearSearch?: boolean },
  ) {
    if (!isScanTerminator(event.key)) return;

    const code = normalizeScanCode(event.currentTarget.value);
    if (!code) return;

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.value = "";
    if (options?.clearSearch) setSearch("");
    registerScannedCode(code);
  }

  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    processScanFromInput(event, { clearSearch: true });
  }

  function handleCaptureKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    processScanFromInput(event);
  }

  function handleCaptureBlur() {
    window.setTimeout(() => {
      if (shouldRefocusScanner()) scanInputRef.current?.focus();
    }, 80);
  }

  function updateQty(id: string, next: number) {
    const source = products.find((product) => product.id === id);
    if (!source) return;

    if (next > source.stock) {
      setNotice(`Solo hay ${source.stock} unidades disponibles para ${source.nombre}.`);
    }

    const safeNext = Math.min(next, source.stock);
    setCart((prev) => prev.flatMap((item) => {
      if (item.id !== id) return [item];
      if (safeNext <= 0) return [];
      return [{ ...source, precio: getSalePrice(source), cantidad: safeNext }];
    }));
  }

  function clearSale() {
    setCart([]);
    setCustomerName("Cliente mostrador");
    setPaymentMethod("Efectivo");
    setTransferConfirmed(null);
    setTransferModalOpen(false);
    setCashPaymentModalOpen(false);
    setDiscountInput("0");
    setSaleNote("");
    setScanCount(0);
    setLastScannedCode(null);
    setNotice("Venta limpiada.");
  }

  async function printReceipt(receipt: SaleReceipt | null = lastReceipt) {
    if (!receipt) {
      setNotice("Primero completa una venta para imprimir la factura.");
      return;
    }

    const printed = await printThermalReceipt(receipt);
    if (printed) {
      setNotice(`Factura ${receipt.invoiceNumber} enviada a imprimir. Elige "Gexa Lexy" en el dialogo si no es la predeterminada.`);
      return;
    }

    setNotice("No se pudo abrir la impresion. Permite ventanas emergentes o imprime desde Imprimir factura.");
  }

  function completeSale(amountPaid?: number, changeAmount?: number) {
    if (!cashierOpen) {
      setNotice("Primero debes abrir la caja.");
      return;
    }

    if (cart.length === 0) {
      setNotice("Agrega productos antes de completar la venta.");
      return;
    }

    if (paymentMethod === "Transferencia" && transferConfirmed === null) {
      setTransferModalOpen(true);
      setNotice("Confirma si la transferencia fue recibida.");
      return;
    }

    if (paymentMethod === "Efectivo" && (amountPaid === undefined || changeAmount === undefined)) {
      setCashPaymentModalOpen(true);
      return;
    }

    const soldAt = new Date().toISOString();
    const invoiceNumber = `FAC-${Date.now().toString().slice(-6)}`;
    const receipt: SaleReceipt = {
      invoiceNumber,
      soldAt,
      customerName: customerName.trim() || "Cliente mostrador",
      paymentMethod,
      pricingMode,
      subtotal,
      discount,
      tax: 0,
      total,
      amountPaid: paymentMethod === "Efectivo" ? amountPaid : undefined,
      change: paymentMethod === "Efectivo" ? changeAmount : 0,
      note: saleNote.trim(),
      items: cart.map((item) => ({
        id: item.id,
        nombre: item.nombre,
        marca: item.marca,
        cantidad: item.cantidad,
        precioUnitario: item.precio,
        subtotal: item.precio * item.cantidad,
      })),
    };

    setProducts((prev) => prev.map((product) => {
      const inCart = cart.find((item) => item.id === product.id);
      if (!inCart) return product;
      return { ...product, stock: Math.max(0, product.stock - inCart.cantidad) };
    }));

    const isPendingTransfer = paymentMethod === "Transferencia" && transferConfirmed === false;
    const trx: Transaction = {
      id: invoiceNumber,
      cliente: receipt.customerName,
      monto: total,
      metodo: paymentMethod,
      estado: isPendingTransfer ? "Pendiente" : "Completada",
      soldAt,
      items: isPendingTransfer
        ? undefined
        : receipt.items.map((item) => ({
            productId: item.id,
            nombre: item.nombre,
            cantidad: item.cantidad,
          })),
    };

    setTransactions((prev) => [trx, ...prev]);

    if (trx.items?.length) {
      appendStockMovements(movementsFromSale(trx, trx.items));
    }

    setLastReceipt(receipt);
    setCart([]);
    setScanCount(0);
    setLastScannedCode(null);
    setDiscountInput("0");
    setSaleNote("");
    setCustomerName("Cliente mostrador");
    setPaymentMethod("Efectivo");
    setTransferConfirmed(null);
    setCashPaymentModalOpen(false);
    setNotice(
      isPendingTransfer
        ? `Venta registrada como pago pendiente por ${currency(total)}.`
        : paymentMethod === "Efectivo" && changeAmount !== undefined && changeAmount > 0
          ? `Venta completada. Cambio a devolver: ${currency(changeAmount)}.`
          : `Venta completada por ${currency(total)}. Imprimiendo factura...`,
    );
    if (!isPendingTransfer) {
      void printReceipt(receipt);
    }
  }

  return (
    <section className="pos-screen">
      <section className="pos-catalog">
        <div className="pos-header">
          <div>
            <h1>Punto de Venta</h1>
            <p className="muted">Escanea con el lector USB (abre la caja primero) o busca en el catalogo.</p>
          </div>
          <article className="card pos-cart-total-card">
            <span className="muted">En carrito</span>
            <strong>{currency(total)}</strong>
          </article>
        </div>

        <input
          ref={scanInputRef}
          type="text"
          className="pos-barcode-capture"
          aria-label="Captura de lector de codigos USB"
          autoComplete="off"
          tabIndex={0}
          onKeyDown={handleCaptureKeyDown}
          onBlur={handleCaptureBlur}
        />

        <div className="card pos-toolbar">
          <div className="pos-toolbar-main">
            <input
              className="pos-input"
              data-manual-input
              placeholder="Buscar o escanear codigo aqui..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={handleSearchKeyDown}
              onBlur={handleCaptureBlur}
            />
            <button type="button" className="ghost" onClick={() => setSearch("")}>Limpiar</button>
            <button type="button" className="ghost pos-scan-focus-btn" onClick={focusScannerCapture}>
              <span className="material-symbols-outlined">barcode_scanner</span>
              Lector
            </button>
          </div>

          <div className="pos-scanner-status" role="status">
            <span className={`badge ${cashierOpen ? "success" : "warn"}`}>
              <span className="material-symbols-outlined">usb</span>
              {cashierOpen ? "Lector USB activo" : "Abre la caja para escanear"}
            </span>
            {scanCount > 0 && (
              <span className="muted">
                Escaneados en esta venta: <strong>{scanCount}</strong>
                {lastScannedCode && <> · Ultimo: <strong>{lastScannedCode}</strong></>}
              </span>
            )}
          </div>

          <div className="pos-toolbar-filters">
            <div className="actions">
              {categories.map((category) => (
                <button
                  key={category}
                  className={categoryFilter === category ? "" : "ghost"}
                  onClick={() => setCategoryFilter(category)}
                >
                  {category}
                </button>
              ))}
            </div>

            <div className="actions">
              {availabilityFilters.map((filter) => (
                <button
                  key={filter}
                  className={availabilityFilter === filter ? "" : "ghost"}
                  onClick={() => setAvailabilityFilter(filter)}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <div className="row">
            <span className="muted">Mostrando {visibleProducts.length} productos</span>
            <span className="muted">Modo de precio: {pricingMode === "detalle" ? "Cliente" : "Mayorista"}</span>
          </div>
        </div>

        <div className="pos-grid">
          {visibleProducts.map((product) => {
            const currentQty = getCartQty(product.id);
            const status = getProductStatus(product);
            const salePrice = getSalePrice(product);

            return (
              <article className={`pos-product-card ${product.stock <= 0 ? "is-disabled" : ""}`} key={product.id}>
                <div className="pos-product-content">
                  <div className="row">
                    <h3>{product.nombre}</h3>
                    <span className={`badge ${status.className}`}>{status.label}</span>
                  </div>
                  <p className="muted">{product.marca} · {product.categoria}</p>
                  <p className="pos-code">Codigo {product.id}</p>
                  <div className="pos-product-meta">
                    <span className="badge">Stock {product.stock}</span>
                    <span className="badge">Min. {product.stockMinimo}</span>
                    {currentQty > 0 && <span className="badge success">x{currentQty} en carrito</span>}
                  </div>
                  {product.stock > 0 && product.stock <= product.stockMinimo && (
                    <p className="pos-warning">Quedan pocas unidades. Reponer pronto.</p>
                  )}
                </div>

                <div className="pos-product-footer">
                  <div className="pos-price-block">
                    <strong>{currency(salePrice)}</strong>
                    <span className="muted">{pricingMode === "detalle" ? "Precio cliente" : "Precio mayorista"}</span>
                  </div>
                  <div className="actions pos-card-actions">
                    <button
                      className="ghost"
                      onClick={() => updateQty(product.id, currentQty - 1)}
                      disabled={currentQty === 0}
                    >
                      -
                    </button>
                    <button onClick={() => addToCart(product)} disabled={product.stock <= 0}>
                      <span className="material-symbols-outlined">add_shopping_cart</span>
                    </button>
                  </div>
                </div>
              </article>
            );
          })}

          {visibleProducts.length === 0 && (
            <div className="card pos-empty-state">
              <h3>No se encontraron productos</h3>
              <p className="muted">Prueba otra busqueda o cambia los filtros del catalogo.</p>
            </div>
          )}
        </div>
      </section>

      <aside className="pos-cart-panel">
        <div className="pos-cart-head compact">
          <div className="row pos-cart-title-row">
            <h2>Venta actual</h2>
            <span className={`badge ${cashierOpen ? "success" : "danger"}`}>
              Caja {cashierOpen ? "abierta" : "cerrada"}
            </span>
          </div>

          <section className="pos-sale-section">
            <h3 className="pos-section-label">Datos de la venta</h3>
            <div className="pos-picker-grid">
              <button
                type="button"
                className="pos-picker-trigger"
                onClick={() => setSalePickerModal("customer")}
              >
                <span className="pos-picker-trigger-label">Cliente</span>
                <span className="pos-picker-trigger-value">{customerName}</span>
                <span className="material-symbols-outlined pos-picker-trigger-icon">expand_more</span>
              </button>
              <button
                type="button"
                className="pos-picker-trigger"
                onClick={() => setSalePickerModal("payment")}
              >
                <span className="pos-picker-trigger-label">Metodo de pago</span>
                <span className="pos-picker-trigger-value">{paymentMethodLabel}</span>
                <span className="material-symbols-outlined pos-picker-trigger-icon">expand_more</span>
              </button>
            </div>
          </section>

          <section className="pos-sale-section">
            <h3 className="pos-section-label">Precio y caja</h3>
            <div className="actions pos-toggle-group compact">
              <button
                type="button"
                className={pricingMode === "detalle" ? "" : "ghost"}
                onClick={() => setPricingMode("detalle")}
              >
                Cliente
              </button>
              <button
                type="button"
                className={pricingMode === "mayorista" ? "" : "ghost"}
                onClick={() => setPricingMode("mayorista")}
              >
                Mayorista
              </button>
            </div>
            {currentCashSession && (
              <p className="pos-cash-session-info muted">
                Abierta: {formatDateTime(currentCashSession.openedAt)} ·
                {" "}Fondo {currency(currentCashSession.openingAmount)}
              </p>
            )}
            <div className="actions pos-drawer-actions">
              <button type="button" className="ghost" onClick={requestOpenCash} disabled={cashierOpen}>
                Abrir caja
              </button>
              <button type="button" className="ghost" onClick={requestCloseCash} disabled={!cashierOpen}>
                Cerrar caja
              </button>
            </div>
          </section>

          <div className="pos-mini-summary">
            <div>
              <span className="muted">Items</span>
              <strong>{cartItemCount}</strong>
            </div>
            <div>
              <span className="muted">Subtotal</span>
              <strong>{currency(subtotal)}</strong>
            </div>
            <div>
              <span className="muted">Total</span>
              <strong>{currency(total)}</strong>
            </div>
          </div>
        </div>

        <div className="pos-cart-items">
          {cart.length === 0 && !lastReceipt && (
            <div className="pos-empty-state">
              <h3>Carrito vacio</h3>
              <p className="muted">Escanea un codigo con el lector USB o selecciona productos del catalogo.</p>
            </div>
          )}

          {cart.map((item) => (
            <div className="pos-cart-item compact" key={item.id}>
              <div className="row">
                <div className="pos-item-meta">
                  <strong>{item.nombre}</strong>
                  <span className="muted">{item.id} · {item.marca}</span>
                </div>
                <span className="pos-line-price">{currency(item.precio * item.cantidad)}</span>
              </div>

              <div className="row pos-cart-item-bottom">
                <div className="actions compact">
                  <button className="ghost" onClick={() => updateQty(item.id, item.cantidad - 1)}>-</button>
                  <span className="badge">{item.cantidad}</span>
                  <button className="ghost" onClick={() => updateQty(item.id, item.cantidad + 1)}>+</button>
                  <button className="ghost" onClick={() => updateQty(item.id, 0)}>
                    <span className="material-symbols-outlined">delete</span>
                  </button>
                </div>
                <span className="muted">Unitario {currency(item.precio)}</span>
              </div>
            </div>
          ))}

          {lastReceipt && (
            <div className="card pos-success-card">
              <div className="pos-success-head">
                <span className="material-symbols-outlined">check_circle</span>
                <div>
                  <strong>Venta cobrada correctamente</strong>
                  <p className="muted">Factura {lastReceipt.invoiceNumber} lista para imprimir.</p>
                </div>
              </div>

              <div className="pos-success-details">
                <span className="badge success">{currency(lastReceipt.total)}</span>
                <span className="badge">{lastReceipt.customerName}</span>
                <span className="badge">{formatDateTime(lastReceipt.soldAt)}</span>
              </div>

              <div className="actions pos-secondary-actions">
                <button onClick={() => printReceipt(lastReceipt)}>Imprimir factura</button>
                <button className="ghost" onClick={() => setLastReceipt(null)}>Cerrar confirmacion</button>
              </div>
            </div>
          )}
        </div>

        <div className="pos-cart-footer compact">
          <h3 className="pos-section-label">Cobro</h3>
          <label className="pos-field pos-field-full">
            Descuento
            <input
              className="pos-input"
              data-manual-input
              type="number"
              min="0"
              step="0.01"
              value={discountInput}
              onChange={(event) => setDiscountInput(event.target.value)}
              onBlur={handleCaptureBlur}
              placeholder="0.00"
            />
          </label>

          <label className="pos-field pos-field-full pos-note-field">
            Nota de la venta
            <textarea
              className="pos-input pos-textarea pos-note-input"
              data-manual-input
              value={saleNote}
              onChange={(event) => setSaleNote(event.target.value)}
              onBlur={handleCaptureBlur}
              placeholder="Ej. entrega inmediata, pago mixto, direccion de envio..."
              rows={3}
            />
          </label>

          <div className="pos-summary-row">
            <span>Subtotal</span>
            <span>{currency(subtotal)}</span>
          </div>
          {discount > 0 && (
            <div className="pos-summary-row">
              <span>Descuento</span>
              <span>{currency(discount)}</span>
            </div>
          )}
          <div className="pos-summary-row pos-total-row">
            <strong>Total a cobrar</strong>
            <strong>{currency(total)}</strong>
          </div>

          <button onClick={() => completeSale()} disabled={!cashierOpen || cart.length === 0}>
            Cobrar ahora
          </button>

          <div className="actions pos-secondary-actions">
            <button className="ghost" onClick={clearSale}>Limpiar</button>
            <button className="ghost" onClick={() => printReceipt()} disabled={!lastReceipt}>
              Imprimir factura
            </button>
            <button className="ghost" onClick={() => setNotice(saleNote || "No hay notas cargadas para esta venta.")}>
              Ver nota
            </button>
          </div>
        </div>
      </aside>


      {salePickerModal === "customer" && (
        <PosOptionPickerModal
          title="Tipo de cliente"
          description="Selecciona el tipo de venta. Mayorista aplica precio mayorista automaticamente."
          options={customerOptions}
          selectedValue={customerName}
          onSelect={selectCustomer}
          onClose={() => setSalePickerModal(null)}
        />
      )}

      {salePickerModal === "payment" && (
        <PosOptionPickerModal
          title="Metodo de pago"
          description="Elige como se realizara el cobro."
          options={paymentOptions}
          selectedValue={paymentMethod}
          onSelect={selectPayment}
          onClose={() => setSalePickerModal(null)}
        />
      )}

      {transferModalOpen && (
        <TransferPaymentModal
          onConfirm={handleTransferConfirm}
          onClose={closeTransferModal}
        />
      )}

      {cashPaymentModalOpen && (
        <CashPaymentModal
          total={total}
          onConfirm={(amountPaid, change) => completeSale(amountPaid, change)}
          onClose={() => setCashPaymentModalOpen(false)}
        />
      )}

      {cashOpenModalOpen && (
        <CashOpenModal
          onConfirm={handleCashOpenConfirm}
          onClose={() => setCashOpenModalOpen(false)}
        />
      )}

      {cashCloseModalOpen && currentCashSession && closeSummaryPreview && (
        <CashCloseModal
          openedAt={currentCashSession.openedAt}
          summary={closeSummaryPreview}
          onConfirm={() => { void handleCashCloseConfirm(); }}
          onClose={() => {
            setCashCloseModalOpen(false);
            setCloseSummaryPreview(null);
          }}
        />
      )}

      {unknownScanDraft && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={closeUnknownScanModal}
        >
          <div
            className="modal-panel card pos-scan-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pos-scan-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="row">
              <div>
                <h2 id="pos-scan-modal-title">Producto no registrado</h2>
                <p className="muted">
                  El codigo <strong>{unknownScanDraft.id}</strong> no esta en inventario.
                  Agregalo para continuar la venta.
                </p>
              </div>
              <button className="ghost" type="button" onClick={closeUnknownScanModal}>Cerrar</button>
            </div>

            <form className="inventory-form" onSubmit={submitUnknownScanProduct}>
              <div className="inventory-form-grid">
                <label>
                  Codigo escaneado
                  <input
                    className="inventory-input"
                    data-manual-input
                    value={unknownScanDraft.id}
                    readOnly
                  />
                </label>

                <label>
                  Stock inicial
                  <input
                    className="inventory-input"
                    data-manual-input
                    type="number"
                    min="0"
                    step="1"
                    value={unknownScanDraft.stock}
                    onChange={(event) => {
                      setUnknownScanError("");
                      setUnknownScanDraft((prev) => (
                        prev ? { ...prev, stock: event.target.value } : prev
                      ));
                    }}
                  />
                </label>

                <label className="field-span-2">
                  Nombre del producto
                  <input
                    ref={unknownNameInputRef}
                    className="inventory-input"
                    data-manual-input
                    value={unknownScanDraft.nombre}
                    onChange={(event) => {
                      setUnknownScanError("");
                      setUnknownScanDraft((prev) => (
                        prev ? { ...prev, nombre: event.target.value } : prev
                      ));
                    }}
                    placeholder="Ej. Crema hidratante 50ml"
                    autoComplete="off"
                  />
                </label>

                <label className="field-span-2">
                  Precio de venta
                  <input
                    className="inventory-input"
                    data-manual-input
                    type="number"
                    min="0"
                    step="0.01"
                    value={unknownScanDraft.precio}
                    onChange={(event) => {
                      setUnknownScanError("");
                      setUnknownScanDraft((prev) => (
                        prev ? { ...prev, precio: event.target.value } : prev
                      ));
                    }}
                  />
                </label>
              </div>

              {unknownScanError && <p className="form-error">{unknownScanError}</p>}

              <div className="modal-actions">
                <button className="ghost" type="button" onClick={closeUnknownScanModal}>Cancelar</button>
                <button type="submit">Guardar y agregar al carrito</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
