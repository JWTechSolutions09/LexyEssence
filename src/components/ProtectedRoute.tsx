import { Navigate, Outlet, useLocation } from "react-router-dom";
import { isPathAllowedForRole } from "../config/auth";
import { useAuth } from "../context/AuthContext";

export function ProtectedRoute() {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!isPathAllowedForRole(location.pathname, user.role)) {
    return <Navigate to="/punto-venta" replace />;
  }

  return <Outlet />;
}
