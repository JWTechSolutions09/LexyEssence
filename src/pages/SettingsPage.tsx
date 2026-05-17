import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { roleLabel, type AuthUser, type UserRole } from "../config/auth";
import { useAppContext } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";

type UserFormMode = "create" | "edit" | "password" | null;

const emptyNewUser = {
  username: "",
  password: "",
  displayName: "",
  role: "caja" as UserRole,
};

export function SettingsPage() {
  const { setNotice } = useAppContext();
  const {
    isAdmin,
    users,
    addUser,
    updateUserPassword,
    updateUserDetails,
  } = useAuth();

  const [storeName, setStoreName] = useState("Lexy Essence");
  const [currencyCode, setCurrencyCode] = useState("DOP");
  const [formMode, setFormMode] = useState<UserFormMode>(null);
  const [selectedUser, setSelectedUser] = useState<AuthUser | null>(null);
  const [formError, setFormError] = useState("");

  const [newUser, setNewUser] = useState(emptyNewUser);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editRole, setEditRole] = useState<UserRole>("caja");
  const [editActive, setEditActive] = useState(true);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [visiblePasswordIds, setVisiblePasswordIds] = useState<Set<string>>(new Set());
  const [showNewUserPassword, setShowNewUserPassword] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);

  const activeUsers = users.filter((entry) => entry.active);
  const inactiveUsers = users.filter((entry) => !entry.active);

  if (!isAdmin) {
    return <Navigate to="/punto-venta" replace />;
  }

  function saveSettings() {
    setNotice(`Configuracion guardada: ${storeName} (${currencyCode}).`);
  }

  function resetSettings() {
    setStoreName("Lexy Essence");
    setCurrencyCode("DOP");
    setNotice("Configuracion restaurada.");
  }

  function closeUserModal() {
    setFormMode(null);
    setSelectedUser(null);
    setFormError("");
    setNewUser(emptyNewUser);
    setNewPassword("");
    setConfirmPassword("");
  }

  function openCreateModal() {
    setNewUser(emptyNewUser);
    setFormError("");
    setSelectedUser(null);
    setFormMode("create");
  }

  function openEditModal(entry: AuthUser) {
    setSelectedUser(entry);
    setEditDisplayName(entry.displayName);
    setEditRole(entry.role);
    setEditActive(entry.active);
    setFormError("");
    setFormMode("edit");
  }

  function openPasswordModal(entry: AuthUser) {
    setSelectedUser(entry);
    setNewPassword(entry.password);
    setConfirmPassword(entry.password);
    setShowChangePassword(false);
    setFormError("");
    setFormMode("password");
  }

  function togglePasswordVisibility(userId: string) {
    setVisiblePasswordIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  async function handleCreateUser(event: FormEvent) {
    event.preventDefault();
    const result = await addUser(newUser);
    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    setNotice(`Usuario ${newUser.username} creado correctamente.`);
    closeUserModal();
  }

  async function handleEditUser(event: FormEvent) {
    event.preventDefault();
    if (!selectedUser) return;

    const result = await updateUserDetails(selectedUser.id, {
      displayName: editDisplayName,
      role: editRole,
      active: editActive,
    });

    if (!result.ok) {
      setFormError(result.error);
      return;
    }

    setNotice(`Usuario ${selectedUser.username} actualizado.`);
    closeUserModal();
  }

  async function handleChangePassword(event: FormEvent) {
    event.preventDefault();
    if (!selectedUser) return;

    if (newPassword !== confirmPassword) {
      setFormError("Las contrasenas no coinciden.");
      return;
    }

    const result = await updateUserPassword(selectedUser.id, newPassword);
    if (!result.ok) {
      setFormError(result.error);
      return;
    }

    setNotice(`Contrasena de ${selectedUser.username} actualizada.`);
    closeUserModal();
  }

  function renderUserRow(entry: AuthUser) {
    const passwordVisible = visiblePasswordIds.has(entry.id);

    return (
      <div className="settings-user-row" key={entry.id}>
        <div>
          <strong>{entry.displayName}</strong>
          <p className="muted">@{entry.username}</p>
        </div>
        <div className="settings-password-cell">
          <code className="settings-password-value">
            {passwordVisible ? entry.password : "••••••••"}
          </code>
          <button
            type="button"
            className="ghost settings-password-toggle"
            aria-label={passwordVisible ? "Ocultar contrasena" : "Ver contrasena"}
            onClick={() => togglePasswordVisibility(entry.id)}
          >
            <span className="material-symbols-outlined">
              {passwordVisible ? "visibility_off" : "visibility"}
            </span>
          </button>
        </div>
        <span className="badge">{roleLabel(entry.role)}</span>
        <span className={`badge ${entry.active ? "success" : "warn"}`}>
          {entry.active ? "Activo" : "Inactivo"}
        </span>
        <div className="actions settings-user-actions">
          <button type="button" className="ghost" onClick={() => openEditModal(entry)}>Editar</button>
          <button type="button" className="ghost" onClick={() => openPasswordModal(entry)}>
            Cambiar
          </button>
        </div>
      </div>
    );
  }

  return (
    <section className="settings-screen">
      <div className="row settings-page-head">
        <div>
          <h1>Configuracion</h1>
          <p className="muted">Ajustes del negocio y gestion de usuarios del sistema.</p>
        </div>
      </div>

      <section className="report-glass-card settings-users-section">
        <div className="row settings-section-head">
          <div>
            <h2>Usuarios del sistema</h2>
            <p className="muted">
              {activeUsers.length} activo(s) · {users.length} en total
            </p>
          </div>
          <button type="button" onClick={openCreateModal}>Agregar usuario</button>
        </div>

        <div className="settings-users-table">
          <div className="settings-users-head">
            <span>Usuario</span>
            <span>Contrasena</span>
            <span>Rol</span>
            <span>Estado</span>
            <span>Acciones</span>
          </div>
          {users.map((entry) => renderUserRow(entry))}
        </div>

        {inactiveUsers.length > 0 && (
          <p className="muted settings-inactive-note">
            Usuarios inactivos no pueden iniciar sesion.
          </p>
        )}
      </section>

      <section className="card settings-form">
        <h2>Negocio</h2>
        <label>
          Nombre del negocio
          <input
            className="settings-input"
            value={storeName}
            onChange={(event) => setStoreName(event.target.value)}
          />
        </label>
        <label>
          Moneda
          <select
            className="settings-input"
            value={currencyCode}
            onChange={(event) => setCurrencyCode(event.target.value)}
          >
            <option value="USD">USD</option>
            <option value="DOP">DOP</option>
            <option value="EUR">EUR</option>
          </select>
        </label>
        <div className="actions">
          <button type="button" className="ghost" onClick={resetSettings}>Restaurar</button>
          <button type="button" onClick={saveSettings}>Guardar</button>
        </div>
      </section>

      {formMode && (
        <div className="modal-backdrop" role="presentation" onClick={closeUserModal}>
          <div
            className="modal-panel card settings-user-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            {formMode === "create" && (
              <>
                <div className="row">
                  <h2>Agregar usuario</h2>
                  <button type="button" className="ghost" onClick={closeUserModal}>Cerrar</button>
                </div>
                <form className="settings-user-form" onSubmit={handleCreateUser}>
                  <label>
                    Nombre visible
                    <input
                      className="settings-input"
                      value={newUser.displayName}
                      onChange={(event) => setNewUser((prev) => ({ ...prev, displayName: event.target.value }))}
                      required
                    />
                  </label>
                  <label>
                    Usuario (login)
                    <input
                      className="settings-input"
                      value={newUser.username}
                      onChange={(event) => setNewUser((prev) => ({ ...prev, username: event.target.value }))}
                      autoComplete="off"
                      required
                    />
                  </label>
                  <label>
                    Contrasena
                    <div className="settings-password-input-wrap">
                      <input
                        className="settings-input"
                        type={showNewUserPassword ? "text" : "password"}
                        value={newUser.password}
                        onChange={(event) => setNewUser((prev) => ({ ...prev, password: event.target.value }))}
                        required
                      />
                      <button
                        type="button"
                        className="ghost settings-password-toggle"
                        onClick={() => setShowNewUserPassword((prev) => !prev)}
                      >
                        <span className="material-symbols-outlined">
                          {showNewUserPassword ? "visibility_off" : "visibility"}
                        </span>
                      </button>
                    </div>
                  </label>
                  <label>
                    Rol
                    <select
                      className="settings-input"
                      value={newUser.role}
                      onChange={(event) => setNewUser((prev) => ({
                        ...prev,
                        role: event.target.value as UserRole,
                      }))}
                    >
                      <option value="admin">Administrador</option>
                      <option value="caja">Caja</option>
                    </select>
                  </label>
                  {formError && <p className="form-error">{formError}</p>}
                  <div className="modal-actions">
                    <button type="button" className="ghost" onClick={closeUserModal}>Cancelar</button>
                    <button type="submit">Crear usuario</button>
                  </div>
                </form>
              </>
            )}

            {formMode === "edit" && selectedUser && (
              <>
                <div className="row">
                  <h2>Editar usuario</h2>
                  <button type="button" className="ghost" onClick={closeUserModal}>Cerrar</button>
                </div>
                <p className="muted">Usuario: <strong>{selectedUser.username}</strong></p>
                <form className="settings-user-form" onSubmit={handleEditUser}>
                  <label>
                    Nombre visible
                    <input
                      className="settings-input"
                      value={editDisplayName}
                      onChange={(event) => setEditDisplayName(event.target.value)}
                      required
                    />
                  </label>
                  <label>
                    Rol
                    <select
                      className="settings-input"
                      value={editRole}
                      onChange={(event) => setEditRole(event.target.value as UserRole)}
                    >
                      <option value="admin">Administrador</option>
                      <option value="caja">Caja</option>
                    </select>
                  </label>
                  <label className="settings-checkbox-label">
                    <input
                      type="checkbox"
                      checked={editActive}
                      onChange={(event) => setEditActive(event.target.checked)}
                    />
                    Usuario activo
                  </label>
                  {formError && <p className="form-error">{formError}</p>}
                  <div className="modal-actions">
                    <button type="button" className="ghost" onClick={closeUserModal}>Cancelar</button>
                    <button type="submit">Guardar cambios</button>
                  </div>
                </form>
              </>
            )}

            {formMode === "password" && selectedUser && (
              <>
                <div className="row">
                  <h2>Cambiar contrasena</h2>
                  <button type="button" className="ghost" onClick={closeUserModal}>Cerrar</button>
                </div>
                <p className="muted">Usuario: <strong>{selectedUser.username}</strong></p>
                <p className="settings-current-password">
                  Contrasena actual: <code>{selectedUser.password}</code>
                </p>
                <form className="settings-user-form" onSubmit={handleChangePassword}>
                  <label>
                    Nueva contrasena
                    <div className="settings-password-input-wrap">
                      <input
                        className="settings-input"
                        type={showChangePassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                        required
                      />
                      <button
                        type="button"
                        className="ghost settings-password-toggle"
                        onClick={() => setShowChangePassword((prev) => !prev)}
                      >
                        <span className="material-symbols-outlined">
                          {showChangePassword ? "visibility_off" : "visibility"}
                        </span>
                      </button>
                    </div>
                  </label>
                  <label>
                    Confirmar contrasena
                    <input
                      className="settings-input"
                      type={showChangePassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      required
                    />
                  </label>
                  {formError && <p className="form-error">{formError}</p>}
                  <div className="modal-actions">
                    <button type="button" className="ghost" onClick={closeUserModal}>Cancelar</button>
                    <button type="submit">Actualizar contrasena</button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
