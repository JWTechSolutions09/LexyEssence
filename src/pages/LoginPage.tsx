import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function LoginPage() {
  const { login, isAuthenticated, isCaja, isAuthLoading } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  if (isAuthenticated) {
    return <Navigate to={isCaja ? "/punto-venta" : "/"} replace />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");

    const success = await login(username, password);
    if (!success) {
      setError("Usuario o contrasena incorrectos. Verifica que el servidor este activo.");
      return;
    }

    const trimmed = username.trim();
    const isCajaUser = trimmed === "Caja";
    navigate(isCajaUser ? "/punto-venta" : "/", { replace: true });
  }

  return (
    <section className="login-screen">
      <div className="login-card card">
        <div className="login-brand">
          <img src="/logo.jpeg" alt="Logo Lexy Essence" />
          <div>
            <h1>Lexy Essence</h1>
            <p className="muted">Inicia sesion para continuar</p>
          </div>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            Usuario
            <input
              className="login-input"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              autoFocus
              required
            />
          </label>

          <label>
            Contrasena
            <input
              className="login-input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          {error && <p className="form-error">{error}</p>}

          <button type="submit" className="login-submit-btn" disabled={isAuthLoading}>
            {isAuthLoading ? "Conectando..." : "Ingresar"}
          </button>
        </form>
      </div>
    </section>
  );
}
