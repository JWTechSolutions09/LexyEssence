import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { AmpollaSaleModal } from "../components/AmpollaSaleModal";
import { CashCloseModal } from "../components/CashCloseModal";
import { CashOpenModal } from "../components/CashOpenModal";
import { CashPaymentModal } from "../components/CashPaymentModal";
import { PosOptionPickerModal } from "../components/PosOptionPickerModal";
import { TransferPaymentModal } from "../components/TransferPaymentModal";
import { WholesaleClientModal } from "../components/WholesaleClientModal";
import { useAppContext } from "../context/AppContext";
import type { CashCloseSummary } from "../types/cashSession";
import { findProductByCode, isScanTerminator, normalizeScanCode } from "../hooks/useBarcodeScanner";
import type { AmpollaVentaTipo, Product, Transaction, WholesaleClient, WholesaleDiscountPercent } from "../types/domain";
import {
  buildAmpollaCartItem,
  getAmpollaCartLineId,
  getAmpollaPrecioBase,
  getAmpollaSalePrice,
  formatAmpollaStockLabel,
  getMaxCantidadVenta,
  getUnidadesDescontadasFromCartItem,
  isAmpolla,
  matchesAmpollaSearch,
  validarStockAmpollaEnCarrito,
} from "../utils/ampolla";
import type { SaleReceipt } from "../types/receipt";
import { currency } from "../utils/format";
import { createStockMovement, movementsFromSale } from "../utils/stockMovements";
import { buildQuickProductFromScan } from "../utils/quickProduct";
import { computeCloseSummary } from "../utils/cashSession";
import { printThermalCashClose } from "../utils/printThermalCashClose";
import { printThermalReceipt } from "../utils/printThermalReceipt";
import {
  computeWholesaleUnitPrice,
  formatWholesaleCustomerLabel,
} from "../utils/wholesaleClient";

const WHOLESALE_CUSTOMER_VALUE = "Cliente Mayorista";

const POS_CATALOG_PREVIEW = 6;

const availabilityFilters = ["Todos", "Disponibles", "Stock bajo", "Agotados"] as const;
const paymentMethods = ["Efectivo", "Tarjeta", "Transferencia", "Mixto"] as const;
const customerOptions = [
  { value: "Cliente mostrador", label: "Cliente mostrador", hint: "Precio al detalle", pricingMode: "detalle" as const },
  { value: WHOLESALE_CUSTOMER_VALUE, label: "Cliente Mayorista", hint: "Buscar por cedula y descuento", pricingMode: "mayorista" as const },
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
    forceSave,
    wholesaleClients,
    addWholesaleClient,
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
  const [wholesaleModalOpen, setWholesaleModalOpen] = useState(false);
  const [wholesaleClient, setWholesaleClient] = useState<WholesaleClient | null>(null);
  const [wholesaleDiscountPercent, setWholesaleDiscountPercent] = useState<WholesaleDiscountPercent | null>(null);
  const [checkoutExtrasOpen, setCheckoutExtrasOpen] = useState(false);
  const [posCatalogView, setPosCatalogView] = useState<"catalog" | "ampollas">("catalog");
  const [ampollaSaleProduct, setAmpollaSaleProduct] = useState<Product | null>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);
  const unknownNameInputRef = useRef<HTMLInputElement>(null);

  const catalogProducts = useMemo(
    () => products.filter((product) => !isAmpolla(product)),
    [products],
  );

  const ampollaProducts = useMemo(
    () => products.filter((product) => isAmpolla(product)),
    [products],
  );

  const categories = useMemo(
    () => ["Todos", ...new Set(catalogProducts.map((product) => product.categoria))],
    [catalogProducts],
  );

  const getSalePrice = useCallback((product: Product, mode = pricingMode) => {
    if (mode === "mayorista" && wholesaleDiscountPercent) {
      return computeWholesaleUnitPrice(product, wholesaleDiscountPercent);
    }
    if (mode === "mayorista") {
      return product.precioMayorista;
    }
    return product.precio;
  }, [pricingMode, wholesaleDiscountPercent]);

  const customerDisplayLabel = useMemo(() => {
    if (wholesaleClient && wholesaleDiscountPercent) {
      return formatWholesaleCustomerLabel(
        wholesaleClient.salon,
        wholesaleClient.cedula,
        wholesaleDiscountPercent,
      );
    }
    return customerName;
  }, [wholesaleClient, wholesaleDiscountPercent, customerName]);

  function resetWholesaleSelection() {
    setWholesaleClient(null);
    setWholesaleDiscountPercent(null);
  }

  const getAmpollaPrice = useCallback((product: Product, tipo: AmpollaVentaTipo) => (
    getAmpollaSalePrice(product, tipo, pricingMode, wholesaleDiscountPercent)
  ), [pricingMode, wholesaleDiscountPercent]);

  useEffect(() => {
    setCart((prev) => prev
      .map((item) => {
        const source = products.find((product) => product.id === item.id);
        if (!source) return item;

        const cartLineId = item.cartLineId ?? item.id;
        const maxQty = item.ampollaVentaTipo
          ? getMaxCantidadVenta(source, item.ampollaVentaTipo)
          : source.stock;
        const precio = item.ampollaVentaTipo
          ? getAmpollaPrice(source, item.ampollaVentaTipo)
          : getSalePrice(source, pricingMode);

        return {
          ...item,
          ...source,
          cartLineId,
          cantidad: Math.min(item.cantidad, maxQty),
          precio,
          nombre: item.ampollaVentaTipo
            ? `${source.nombre} - ${item.ampollaVentaTipo === "caja" ? "Caja" : "Unidad"}`
            : source.nombre,
        };
      })
      .filter((item) => item.cantidad > 0));
  }, [getAmpollaPrice, getSalePrice, pricingMode, products, setCart]);

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

  const searchQuery = search.trim().toLowerCase();

  const filteredProducts = useMemo(() => {
    const source = posCatalogView === "ampollas" ? ampollaProducts : catalogProducts;

    return source.filter((product) => {
      const categoryMatch = posCatalogView === "ampollas"
        || categoryFilter === "Todos"
        || product.categoria === categoryFilter;
      const availabilityMatch =
        availabilityFilter === "Todos"
        || (availabilityFilter === "Disponibles" && product.stock > product.stockMinimo)
        || (availabilityFilter === "Stock bajo" && product.stock > 0 && product.stock <= product.stockMinimo)
        || (availabilityFilter === "Agotados" && product.stock <= 0);
      const searchMatch = posCatalogView === "ampollas"
        ? matchesAmpollaSearch(product, searchQuery)
        : (!searchQuery
          || `${product.nombre} ${product.id} ${product.marca} ${product.categoria}`
            .toLowerCase()
            .includes(searchQuery));

      return categoryMatch && availabilityMatch && searchMatch;
    });
  }, [ampollaProducts, availabilityFilter, catalogProducts, categoryFilter, posCatalogView, products, searchQuery]);

  const visibleProducts = useMemo(() => {
    if (searchQuery || posCatalogView === "ampollas") return filteredProducts;
    return filteredProducts.slice(0, POS_CATALOG_PREVIEW);
  }, [filteredProducts, posCatalogView, searchQuery]);

  const hiddenCatalogCount = searchQuery
    ? 0
    : Math.max(0, filteredProducts.length - visibleProducts.length);

  function getCartQty(cartLineId: string) {
    return cart.find((item) => item.cartLineId === cartLineId)?.cantidad ?? 0;
  }

  const addAmpollaToCart = useCallback((product: Product, tipo: AmpollaVentaTipo) => {
    const lineId = getAmpollaCartLineId(product.id, tipo);
    const check = validarStockAmpollaEnCarrito(product, cart, tipo, 1);
    if (!check.ok) {
      setNotice(check.error);
      return false;
    }

    if (lastReceipt) setLastReceipt(null);

    setCart((prev) => {
      const found = prev.find((item) => item.cartLineId === lineId);
      const nextQty = (found?.cantidad ?? 0) + 1;
      const stockCheck = validarStockAmpollaEnCarrito(product, prev, tipo, nextQty, lineId);
      if (!stockCheck.ok) {
        setNotice(stockCheck.error);
        return prev;
      }

      const precio = getAmpollaPrice(product, tipo);
      if (found) {
        return prev.map((item) => (
          item.cartLineId === lineId
            ? { ...item, cantidad: nextQty, precio }
            : item
        ));
      }

      return [...prev, buildAmpollaCartItem(product, tipo, 1, precio)];
    });

    setAmpollaSaleProduct(null);
    setNotice(`${product.nombre} (${tipo === "caja" ? "caja" : "unidad"}) agregado al carrito.`);
    return true;
  }, [cart, getAmpollaPrice, lastReceipt, setCart, setNotice]);

  const addToCart = useCallback((product: Product, options?: { fromScanner?: boolean }) => {
    if (isAmpolla(product)) {
      setAmpollaSaleProduct(product);
      return false;
    }

    if (product.stock <= 0) {
      setNotice("No hay stock disponible para ese producto.");
      return false;
    }

    if (lastReceipt) {
      setLastReceipt(null);
    }

    setCart((prev) => {
      const lineId = product.id;
      const found = prev.find((item) => item.cartLineId === lineId);

      if (found && found.cantidad >= product.stock) {
        setNotice(`Solo quedan ${product.stock} unidades disponibles.`);
        return prev;
      }

      if (found) {
        return prev.map((item) => (
          item.cartLineId === lineId
            ? { ...item, cantidad: item.cantidad + 1, precio: getSalePrice(product) }
            : item
        ));
      }

      return [...prev, {
        ...product,
        cartLineId: lineId,
        precio: getSalePrice(product),
        cantidad: 1,
      }];
    });

    if (options?.fromScanner) {
      setLastScannedCode(product.id);
      setScanCount((prev) => prev + 1);
    }

    setNotice(`Producto agregado: ${product.nombre}`);
    return true;
  }, [getSalePrice, lastReceipt, setCart, setNotice]);

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

    if (isAmpolla(product)) {
      setAmpollaSaleProduct(product);
      setSearch("");
      scanInputRef.current?.focus();
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
    setSalePickerModal(null);

    if (value === WHOLESALE_CUSTOMER_VALUE) {
      setWholesaleModalOpen(true);
      return;
    }

    resetWholesaleSelection();
    const option = customerOptions.find((entry) => entry.value === value);
    setCustomerName(value);
    if (option) setPricingMode(option.pricingMode);
  }

  function handleWholesaleConfirm(client: WholesaleClient, discountPercent: WholesaleDiscountPercent) {
    setWholesaleClient(client);
    setWholesaleDiscountPercent(discountPercent);
    setCustomerName(WHOLESALE_CUSTOMER_VALUE);
    setPricingMode("mayorista");
    setWholesaleModalOpen(false);
    setNotice(`Mayorista: ${client.salon} con ${discountPercent}% de descuento en todos los productos.`);
    void forceSave();
  }

  function handleWholesaleAddClient(cedula: string, salon: string) {
    return addWholesaleClient(cedula, salon);
  }

  function closeWholesaleModal() {
    setWholesaleModalOpen(false);
  }

  function openWholesaleModal() {
    setWholesaleModalOpen(true);
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
    void forceSave();
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
    void forceSave();
  }

  const shouldRefocusScanner = useCallback(() => {
    if (unknownScanDraft || salePickerModal || transferModalOpen || cashOpenModalOpen || cashCloseModalOpen || wholesaleModalOpen) {
      return false;
    }
    const active = document.activeElement;
    if (!active) return true;
    if (active === scanInputRef.current) return false;
    return !active.closest("[data-manual-input]");
  }, [cashCloseModalOpen, cashOpenModalOpen, cashPaymentModalOpen, salePickerModal, transferModalOpen, unknownScanDraft, wholesaleModalOpen]);

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

  function updateQty(cartLineId: string, next: number) {
    const item = cart.find((entry) => entry.cartLineId === cartLineId);
    if (!item) return;

    const source = products.find((product) => product.id === item.id);
    if (!source) return;

    if (next <= 0) {
      setCart((prev) => prev.filter((entry) => entry.cartLineId !== cartLineId));
      return;
    }

    if (item.ampollaVentaTipo) {
      const check = validarStockAmpollaEnCarrito(source, cart, item.ampollaVentaTipo, next, cartLineId);
      if (!check.ok) {
        setNotice(check.error);
        return;
      }
      setCart((prev) => prev.map((entry) => (
        entry.cartLineId === cartLineId
          ? {
            ...entry,
            cantidad: next,
            precio: getAmpollaPrice(source, item.ampollaVentaTipo!),
          }
          : entry
      )));
      return;
    }

    if (next > source.stock) {
      setNotice(`Solo hay ${source.stock} unidades disponibles para ${source.nombre}.`);
    }

    const safeNext = Math.min(next, source.stock);
    setCart((prev) => prev.map((entry) => (
      entry.cartLineId === cartLineId
        ? { ...entry, precio: getSalePrice(source), cantidad: safeNext }
        : entry
    )));
  }

  function clearSale() {
    setCart([]);
    setCustomerName("Cliente mostrador");
    resetWholesaleSelection();
    setPricingMode("detalle");
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
      customerName: customerDisplayLabel.trim() || "Cliente mostrador",
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
      const lines = cart.filter((item) => item.id === product.id);
      if (!lines.length) return product;

      const unitsToDeduct = lines.reduce(
        (acc, item) => acc + getUnidadesDescontadasFromCartItem(item, product),
        0,
      );

      return { ...product, stock: Math.max(0, product.stock - unitsToDeduct) };
    }));

    const listSubtotal = cart.reduce((acc, item) => {
      const source = products.find((product) => product.id === item.id);
      const listPrice = source?.precio ?? item.precio;
      return acc + listPrice * item.cantidad;
    }, 0);

    const wholesaleDiscountAmount = wholesaleDiscountPercent
      ? Math.max(0, Math.round((listSubtotal - subtotal) * 100) / 100)
      : undefined;

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
        : cart.map((item) => {
            const source = products.find((product) => product.id === item.id);
            const unidadesDescontadas = source
              ? getUnidadesDescontadasFromCartItem(item, source)
              : item.cantidad;
            const precioLista = source && item.ampollaVentaTipo
              ? getAmpollaPrecioBase(source, item.ampollaVentaTipo)
              : (source?.precio ?? item.precio);

            return {
              productId: item.id,
              nombre: item.nombre,
              cantidad: item.cantidad,
              precioUnitario: item.precio,
              precioLista,
              ampollaVentaTipo: item.ampollaVentaTipo,
              unidadesDescontadas,
            };
          }),
      pricingMode,
      subtotal,
      listSubtotal,
      discountAmount: discount > 0 ? discount : undefined,
      wholesaleDiscountPercent: wholesaleDiscountPercent ?? undefined,
      wholesaleDiscountAmount,
      wholesaleClientId: wholesaleClient?.id,
      wholesaleSalon: wholesaleClient?.salon,
      wholesaleCedula: wholesaleClient?.cedula,
      note: saleNote.trim() || undefined,
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
    resetWholesaleSelection();
    setPricingMode("detalle");
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
    void forceSave();
  }

  return (
    <section className="pos-screen">
      <section className="pos-catalog">
        <div className="pos-header">
          <div>
            <h1>Punto de Venta</h1>
            <p className="muted">Escanea codigos o busca por nombre, codigo o marca en el catalogo.</p>
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
              placeholder="Buscar por nombre, codigo o marca..."
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

          <div className="pos-catalog-tabs actions">
            <button
              type="button"
              className={posCatalogView === "catalog" ? "" : "ghost"}
              onClick={() => setPosCatalogView("catalog")}
            >
              Catalogo
            </button>
            <button
              type="button"
              className={posCatalogView === "ampollas" ? "" : "ghost"}
              onClick={() => setPosCatalogView("ampollas")}
            >
              Ampollas
            </button>
          </div>

          <div className="pos-toolbar-filters">
            {posCatalogView === "catalog" && (
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
            )}

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

          <div className="row pos-catalog-meta">
            <span className="muted">
              {posCatalogView === "ampollas"
                ? `Ampollas: ${visibleProducts.length} producto(s)`
                : searchQuery
                  ? `Resultados: ${visibleProducts.length} de ${filteredProducts.length}`
                  : hiddenCatalogCount > 0
                    ? `Vista rapida: ${visibleProducts.length} de ${filteredProducts.length} productos`
                    : `Mostrando ${visibleProducts.length} productos`}
              {posCatalogView === "catalog" && !searchQuery && hiddenCatalogCount > 0 && " · escribe para buscar mas"}
            </span>
            <span className="muted">Modo de precio: {pricingMode === "detalle" ? "Cliente" : wholesaleDiscountPercent ? `Mayorista (${wholesaleDiscountPercent}% desc.)` : "Mayorista"}</span>
          </div>
        </div>

        <div className="pos-catalog-results">
          <div className="pos-grid">
          {visibleProducts.map((product) => {
            const lineId = isAmpolla(product) ? getAmpollaCartLineId(product.id, "unidad") : product.id;
            const currentQty = getCartQty(lineId);
            const status = getProductStatus(product);
            const salePrice = isAmpolla(product)
              ? (product.precioUnidad ?? product.precio)
              : getSalePrice(product);

            return (
              <article className={`pos-product-card ${product.stock <= 0 ? "is-disabled" : ""}`} key={product.id}>
                <div className="pos-product-content">
                  <div className="row">
                    <h3>{product.nombre}</h3>
                    <span className={`badge ${status.className}`}>{status.label}</span>
                  </div>
                  <p className="muted">{product.marca} · {product.categoria}</p>
                  <p className="pos-code">
                    Codigo {isAmpolla(product) ? (product.codigoBarraCaja ?? product.id) : product.id}
                  </p>
                  <div className="pos-product-meta">
                    <span className="badge">Stock {product.stock} u.</span>
                    {isAmpolla(product) && (
                      <span className="badge">{formatAmpollaStockLabel(product)}</span>
                    )}
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
                    <span className="muted">
                      {isAmpolla(product)
                        ? `Caja ${currency(product.precioCaja ?? 0)}`
                        : pricingMode === "detalle"
                          ? "Precio cliente"
                          : wholesaleDiscountPercent
                            ? `Precio con ${wholesaleDiscountPercent}% desc.`
                            : "Precio mayorista"}
                    </span>
                  </div>
                  <div className="actions pos-card-actions">
                    {!isAmpolla(product) && (
                      <button
                        className="ghost"
                        onClick={() => updateQty(lineId, currentQty - 1)}
                        disabled={currentQty === 0}
                      >
                        -
                      </button>
                    )}
                    <button
                      onClick={() => (isAmpolla(product) ? setAmpollaSaleProduct(product) : addToCart(product))}
                      disabled={product.stock <= 0}
                    >
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
              <p className="muted">Prueba por nombre, codigo o marca, o cambia los filtros.</p>
            </div>
          )}
          </div>
        </div>
      </section>

      <aside className="pos-cart-panel">
        <div className="pos-cart-top">
          <div className="row pos-cart-title-row">
            <h2>Venta actual</h2>
            <span className={`badge ${cashierOpen ? "success" : "danger"}`}>
              Caja {cashierOpen ? "abierta" : "cerrada"}
            </span>
          </div>

          <div className="pos-cart-quick-picks">
            <button
              type="button"
              className="pos-picker-trigger pos-picker-trigger-compact"
              onClick={() => {
                if (wholesaleClient) {
                  openWholesaleModal();
                  return;
                }
                setSalePickerModal("customer");
              }}
            >
              <span className="pos-picker-trigger-label">Cliente</span>
              <span className="pos-picker-trigger-value">{customerDisplayLabel}</span>
              <span className="material-symbols-outlined pos-picker-trigger-icon">expand_more</span>
            </button>
            <button
              type="button"
              className="pos-picker-trigger pos-picker-trigger-compact"
              onClick={() => setSalePickerModal("payment")}
            >
              <span className="pos-picker-trigger-label">Pago</span>
              <span className="pos-picker-trigger-value">{paymentMethodLabel}</span>
              <span className="material-symbols-outlined pos-picker-trigger-icon">expand_more</span>
            </button>
          </div>

          <div className="actions pos-cart-toolbar">
            <button
              type="button"
              className={pricingMode === "detalle" ? "" : "ghost"}
              onClick={() => {
                resetWholesaleSelection();
                setCustomerName("Cliente mostrador");
                setPricingMode("detalle");
              }}
            >
              Detalle
            </button>
            <button
              type="button"
              className={pricingMode === "mayorista" ? "" : "ghost"}
              onClick={openWholesaleModal}
            >
              Mayorista
            </button>
            <button type="button" className="ghost" onClick={requestOpenCash} disabled={cashierOpen}>
              Abrir caja
            </button>
            <button type="button" className="ghost" onClick={requestCloseCash} disabled={!cashierOpen}>
              Cerrar caja
            </button>
          </div>

          {wholesaleClient && wholesaleDiscountPercent && (
            <p className="pos-wholesale-active muted">
              {wholesaleClient.salon} · {wholesaleDiscountPercent}% descuento
            </p>
          )}

          <div className="pos-mini-summary pos-mini-summary-inline">
            <div>
              <span className="muted">Items</span>
              <strong>{cartItemCount}</strong>
            </div>
            <div>
              <span className="muted">Total</span>
              <strong>{currency(total)}</strong>
            </div>
          </div>
        </div>

        <div className="pos-cart-body">
          <div className="pos-cart-items-head">
            <h3 className="pos-cart-items-title">Productos en la venta</h3>
            <span className="badge">{cartItemCount} {cartItemCount === 1 ? "item" : "items"}</span>
          </div>

          <div className="pos-cart-items">
          {cart.length === 0 && !lastReceipt && (
            <div className="pos-empty-state">
              <h3>Carrito vacio</h3>
              <p className="muted">Escanea un codigo con el lector USB o selecciona productos del catalogo.</p>
            </div>
          )}

          {cart.map((item) => {
            const source = products.find((product) => product.id === item.id);
            const stockNote = source && item.ampollaVentaTipo
              ? getUnidadesDescontadasFromCartItem(item, source)
              : item.cantidad;

            return (
            <div className="pos-cart-item" key={item.cartLineId}>
              <div className="row">
                <div className="pos-item-meta">
                  <strong>{item.nombre}</strong>
                  <span className="muted">{item.id} · {item.marca}</span>
                  {item.ampollaVentaTipo && (
                    <span className="muted">Descuento stock: {stockNote} unidad(es)</span>
                  )}
                </div>
                <span className="pos-line-price">{currency(item.precio * item.cantidad)}</span>
              </div>

              <div className="row pos-cart-item-bottom">
                <div className="actions compact">
                  <button className="ghost" onClick={() => updateQty(item.cartLineId, item.cantidad - 1)}>-</button>
                  <span className="badge">{item.cantidad}</span>
                  <button className="ghost" onClick={() => updateQty(item.cartLineId, item.cantidad + 1)}>+</button>
                  <button className="ghost" onClick={() => updateQty(item.cartLineId, 0)}>
                    <span className="material-symbols-outlined">delete</span>
                  </button>
                </div>
                <span className="muted">Unitario {currency(item.precio)}</span>
              </div>
            </div>
            );
          })}

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
        </div>

        <div className="pos-cart-footer">
          <button
            type="button"
            className="ghost pos-footer-toggle"
            onClick={() => setCheckoutExtrasOpen((open) => !open)}
          >
            <span className="material-symbols-outlined">
              {checkoutExtrasOpen ? "expand_less" : "expand_more"}
            </span>
            {checkoutExtrasOpen ? "Ocultar descuento y nota" : "Descuento y nota"}
          </button>

          {checkoutExtrasOpen && (
            <div className="pos-checkout-extras">
              {!wholesaleDiscountPercent && (
                <label className="pos-field">
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
              )}
              <label className="pos-field pos-note-field">
                Nota
                <textarea
                  className="pos-input pos-textarea pos-note-input"
                  data-manual-input
                  value={saleNote}
                  onChange={(event) => setSaleNote(event.target.value)}
                  onBlur={handleCaptureBlur}
                  placeholder="Nota opcional..."
                  rows={2}
                />
              </label>
            </div>
          )}

          <div className="pos-footer-totals">
            <div className="pos-summary-row">
              <span>Subtotal</span>
              <span>{currency(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="pos-summary-row">
                <span>Descuento</span>
                <span>-{currency(discount)}</span>
              </div>
            )}
            <div className="pos-summary-row pos-total-row">
              <strong>Total a cobrar</strong>
              <strong>{currency(total)}</strong>
            </div>
          </div>

          <button
            type="button"
            className="pos-checkout-btn"
            onClick={() => completeSale()}
            disabled={!cashierOpen || cart.length === 0}
          >
            Cobrar ahora
          </button>

          <div className="actions pos-footer-actions">
            <button type="button" className="ghost" onClick={clearSale}>Limpiar</button>
            <button type="button" className="ghost" onClick={() => printReceipt()} disabled={!lastReceipt}>
              Imprimir
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => setNotice(saleNote || "No hay notas cargadas para esta venta.")}
            >
              Ver nota
            </button>
          </div>
        </div>
      </aside>


      {ampollaSaleProduct && (
        <AmpollaSaleModal
          product={ampollaSaleProduct}
          pricingMode={pricingMode}
          wholesaleDiscountPercent={wholesaleDiscountPercent}
          getSalePrice={getAmpollaPrice}
          onClose={() => setAmpollaSaleProduct(null)}
          onSelect={(tipo) => addAmpollaToCart(ampollaSaleProduct, tipo)}
        />
      )}

      {salePickerModal === "customer" && (
        <PosOptionPickerModal
          title="Tipo de cliente"
          description="Mayorista abre el registro por cedula y aplica descuento del 5% o 10%."
          options={customerOptions}
          selectedValue={wholesaleClient ? WHOLESALE_CUSTOMER_VALUE : customerName}
          onSelect={selectCustomer}
          onClose={() => setSalePickerModal(null)}
        />
      )}

      {wholesaleModalOpen && (
        <WholesaleClientModal
          clients={wholesaleClients}
          onConfirm={handleWholesaleConfirm}
          onAddClient={handleWholesaleAddClient}
          onClose={closeWholesaleModal}
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
