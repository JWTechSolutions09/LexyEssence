import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  createUserRequest,
  fetchAuthMe,
  fetchUsers,
  getApiToken,
  loginRequest,
  setApiToken,
  updateUserDetailsRequest,
  updateUserPasswordRequest,
  ApiError,
} from "../api/client";
import {
  defaultAuthUsers,
  type AuthUser,
  type UserRole,
} from "../config/auth";

export type AuthSession = {
  username: string;
  displayName: string;
  role: UserRole;
};

type NewUserInput = {
  username: string;
  password: string;
  displayName: string;
  role: UserRole;
};

type AuthContextValue = {
  user: AuthSession | null;
  users: AuthUser[];
  isAuthenticated: boolean;
  isAdmin: boolean;
  isCaja: boolean;
  isAuthLoading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  refreshUsers: () => Promise<void>;
  addUser: (input: NewUserInput) => Promise<{ ok: true } | { ok: false; error: string }>;
  updateUserPassword: (userId: string, password: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  updateUserDetails: (
    userId: string,
    input: { displayName: string; role: UserRole; active: boolean },
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const authStorageKey = "lexy-react-auth";

function loadStoredSession(): AuthSession | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = window.localStorage.getItem(authStorageKey);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as AuthSession;
    if (!parsed?.username || !parsed?.displayName || !parsed?.role) return null;
    if (parsed.role !== "admin" && parsed.role !== "caja") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = useState<AuthUser[]>(defaultAuthUsers);
  const [user, setUser] = useState<AuthSession | null>(loadStoredSession);
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  useEffect(() => {
    async function validateSession() {
      if (!user) return;

      if (!getApiToken()) {
        setUser(null);
        return;
      }

      try {
        await fetchAuthMe();
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          setApiToken(null);
          setUser(null);
        }
      }
    }

    void validateSession();
  }, []);

  useEffect(() => {
    if (user) {
      localStorage.setItem(authStorageKey, JSON.stringify(user));
      return;
    }
    localStorage.removeItem(authStorageKey);
  }, [user]);

  const refreshUsers = useCallback(async () => {
    if (!user || user.role !== "admin") return;
    try {
      const response = await fetchUsers();
      setUsers(response.users);
    } catch {
      // Mantener lista actual si falla la recarga.
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setUsers(defaultAuthUsers);
      return;
    }

    if (user.role === "admin") {
      refreshUsers();
    }
  }, [user, refreshUsers]);

  const login = useCallback(async (username: string, password: string) => {
    setIsAuthLoading(true);
    try {
      const response = await loginRequest(username, password);
      setApiToken(response.token);
      setUser(response.user);
      return true;
    } catch {
      return false;
    } finally {
      setIsAuthLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setApiToken(null);
    setUser(null);
  }, []);

  const addUser = useCallback(async (input: NewUserInput) => {
    const username = input.username.trim();
    const displayName = input.displayName.trim();
    const password = input.password.trim();

    if (!username || !displayName || !password) {
      return { ok: false as const, error: "Completa usuario, nombre y contrasena." };
    }

    try {
      const response = await createUserRequest({
        username,
        password,
        displayName,
        role: input.role,
      });
      setUsers((prev) => [...prev, response.user]);
      return { ok: true as const };
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : "No se pudo crear el usuario.",
      };
    }
  }, []);

  const updateUserPassword = useCallback(async (userId: string, password: string) => {
    const nextPassword = password.trim();
    if (!nextPassword) {
      return { ok: false as const, error: "La contrasena no puede estar vacia." };
    }

    try {
      await updateUserPasswordRequest(userId, nextPassword);
      setUsers((prev) => prev.map((entry) => (
        entry.id === userId ? { ...entry, password: nextPassword } : entry
      )));
      return { ok: true as const };
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : "No se pudo actualizar la contrasena.",
      };
    }
  }, []);

  const updateUserDetails = useCallback(async (
    userId: string,
    input: { displayName: string; role: UserRole; active: boolean },
  ) => {
    const displayName = input.displayName.trim();
    if (!displayName) {
      return { ok: false as const, error: "El nombre es obligatorio." };
    }

    const target = users.find((entry) => entry.id === userId);
    if (!target) {
      return { ok: false as const, error: "Usuario no encontrado." };
    }

    if (user?.username === target.username && !input.active) {
      return { ok: false as const, error: "No puedes desactivar tu propia cuenta." };
    }

    try {
      const response = await updateUserDetailsRequest(userId, input);
      setUsers((prev) => prev.map((entry) => (entry.id === userId ? response.user : entry)));

      if (user?.username === target.username) {
        setUser({
          username: target.username,
          displayName,
          role: input.role,
        });
      }

      return { ok: true as const };
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : "No se pudo actualizar el usuario.",
      };
    }
  }, [user, users]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    users,
    isAuthenticated: Boolean(user),
    isAdmin: user?.role === "admin",
    isCaja: user?.role === "caja",
    isAuthLoading,
    login,
    logout,
    refreshUsers,
    addUser,
    updateUserPassword,
    updateUserDetails,
  }), [user, users, isAuthLoading, login, logout, refreshUsers, addUser, updateUserPassword, updateUserDetails]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth debe usarse dentro de AuthProvider.");
  return context;
}

export function resetUsersToDefaults() {
  return defaultAuthUsers;
}
