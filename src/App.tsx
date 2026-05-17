import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AdminRoute } from "./components/AdminRoute";
import { Layout } from "./components/Layout";
import { Notice } from "./components/Notice";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AppProvider } from "./context/AppContext";
import { AuthProvider } from "./context/AuthContext";
import { AgendaPage } from "./pages/AgendaPage";
import { CashReportsPage } from "./pages/CashReportsPage";
import { HomePage } from "./pages/HomePage";
import { InventoryPage } from "./pages/InventoryPage";
import { InventoryReportsPage } from "./pages/InventoryReportsPage";
import { LoginPage } from "./pages/LoginPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { PosPage } from "./pages/PosPage";
import { ReportsHomePage } from "./pages/ReportsHomePage";
import { SettingsPage } from "./pages/SettingsPage";
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppProvider>
          <Notice />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="/punto-venta" element={<PosPage />} />
                <Route path="/inventario" element={<InventoryPage />} />
                <Route path="/agenda" element={<AgendaPage />} />
                <Route element={<AdminRoute />}>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/reportes" element={<ReportsHomePage />} />
                  <Route path="/reportes/caja" element={<CashReportsPage />} />
                  <Route path="/reportes/inventario" element={<InventoryReportsPage />} />
                  <Route path="/proveedores" element={<Navigate to="/" replace />} />
                  <Route path="/configuracion" element={<SettingsPage />} />
                </Route>
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </AppProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
