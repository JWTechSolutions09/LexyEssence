import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Notice } from "./components/Notice";
import { AppProvider } from "./context/AppContext";
import { AgendaPage } from "./pages/AgendaPage";
import { HomePage } from "./pages/HomePage";
import { InventoryPage } from "./pages/InventoryPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { PosPage } from "./pages/PosPage";
import { ReportsPage } from "./pages/ReportsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SuppliersPage } from "./pages/SuppliersPage";

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <Layout>
          <Notice />
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/punto-venta" element={<PosPage />} />
            <Route path="/inventario" element={<InventoryPage />} />
            <Route path="/reportes" element={<ReportsPage />} />
            <Route path="/agenda" element={<AgendaPage />} />
            <Route path="/proveedores" element={<SuppliersPage />} />
            <Route path="/configuracion" element={<SettingsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Layout>
      </AppProvider>
    </BrowserRouter>
  );
}
