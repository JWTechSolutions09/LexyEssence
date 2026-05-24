import type { AuthSession } from "../context/AuthContext";
import type { CashSession } from "../types/cashSession";
import type {
  Appointment,
  Product,
  StockMovement,
  Transaction,
  WholesaleClient,
} from "../types/domain";
import type { AuthUser } from "../config/auth";

const TOKEN_KEY = "lexy-api-token";

export type AppStatePayload = {
  products: Product[];
  transactions: Transaction[];
  appointments: Appointment[];
  stockMovements: StockMovement[];
  currentCashSession: CashSession | null;
  cashSessionHistory: CashSession[];
  wholesaleClients: WholesaleClient[];
};

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function getApiBase() {
  return import.meta.env.VITE_API_URL ?? "";
}

export function getApiToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setApiToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
    return;
  }
  localStorage.removeItem(TOKEN_KEY);
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body) {
    headers.set("Content-Type", "application/json");
  }

  const token = getApiToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${getApiBase()}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(
      typeof data.error === "string" ? data.error : `Error ${response.status}`,
      response.status,
    );
  }

  return data as T;
}

export async function fetchAuthMe() {
  return apiFetch<{ user: AuthSession }>("/api/auth/me");
}

export async function checkApiHealth() {
  return apiFetch<{ ok: boolean }>("/api/health");
}

export async function loginRequest(username: string, password: string) {
  return apiFetch<{ token: string; user: AuthSession }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export async function fetchUsers() {
  return apiFetch<{ users: AuthUser[] }>("/api/users");
}

export async function createUserRequest(input: {
  username: string;
  password: string;
  displayName: string;
  role: "admin" | "caja";
}) {
  return apiFetch<{ user: AuthUser }>("/api/users", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateUserPasswordRequest(userId: string, password: string) {
  return apiFetch<{ ok: true }>(`/api/users/${userId}/password`, {
    method: "PATCH",
    body: JSON.stringify({ password }),
  });
}

export async function updateUserDetailsRequest(
  userId: string,
  input: { displayName: string; role: "admin" | "caja"; active: boolean },
) {
  return apiFetch<{ user: AuthUser }>(`/api/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function fetchAppState() {
  return apiFetch<AppStatePayload>("/api/app-state");
}

export async function saveAppState(payload: AppStatePayload) {
  return apiFetch<{ ok: true }>("/api/app-state", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function migrateAppState(payload: AppStatePayload) {
  return apiFetch<{ migrated: boolean; state: AppStatePayload }>("/api/app-state/migrate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
