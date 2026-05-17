export type UserRole = "admin" | "caja";

export type AuthUser = {
  id: string;
  username: string;
  password: string;
  displayName: string;
  role: UserRole;
  active: boolean;
};

export const defaultAuthUsers: AuthUser[] = [
  { id: "user-jere", username: "JereD02", password: "Mjere02", displayName: "Jeremias", role: "admin", active: true },
  { id: "user-gexa", username: "GexaD01", password: "Mgexa01", displayName: "Gexandra", role: "admin", active: true },
  { id: "user-admin", username: "admin", password: "admin090304", displayName: "Administrador", role: "admin", active: true },
  { id: "user-caja", username: "Caja", password: "Caja01", displayName: "Caja", role: "caja", active: true },
];

export const usersStorageKey = "lexy-react-users";

export function normalizeAuthUser(user: Partial<AuthUser>, index: number): AuthUser | null {
  if (!user.username || !user.password || !user.displayName) return null;

  return {
    id: typeof user.id === "string" ? user.id : `user-${index}-${Date.now()}`,
    username: user.username.trim(),
    password: user.password,
    displayName: user.displayName.trim(),
    role: user.role === "caja" ? "caja" : "admin",
    active: user.active !== false,
  };
}

export function loadStoredUsers(): AuthUser[] {
  if (typeof window === "undefined") return defaultAuthUsers;

  try {
    const stored = window.localStorage.getItem(usersStorageKey);
    if (!stored) return defaultAuthUsers;

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return defaultAuthUsers;

    const normalized = parsed
      .map((user, index) => normalizeAuthUser(user as Partial<AuthUser>, index))
      .filter((user): user is AuthUser => Boolean(user));

    return normalized.length > 0 ? normalized : defaultAuthUsers;
  } catch {
    return defaultAuthUsers;
  }
}

export function findUser(users: AuthUser[], username: string, password: string) {
  const normalizedUser = username.trim();
  return users.find(
    (user) => user.active
      && user.username === normalizedUser
      && user.password === password,
  ) ?? null;
}

export function isUsernameTaken(users: AuthUser[], username: string, excludeId?: string) {
  const normalized = username.trim();
  return users.some((user) => user.username === normalized && user.id !== excludeId);
}

export const cajaAllowedPaths = ["/punto-venta", "/inventario", "/agenda"] as const;

export const adminOnlyPaths = [
  "/",
  "/reportes",
  "/configuracion",
] as const;

export function isAdminOnlyPath(pathname: string) {
  return adminOnlyPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export function isPathAllowedForRole(pathname: string, role: UserRole) {
  if (role === "admin") return true;
  if (isAdminOnlyPath(pathname)) return false;
  return cajaAllowedPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export function roleLabel(role: UserRole) {
  return role === "admin" ? "Administrador" : "Caja";
}
