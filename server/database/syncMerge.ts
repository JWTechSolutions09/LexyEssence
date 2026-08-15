import type { AppStatePayload } from "./appStateStore.js";

function mergeById<T extends { id: string }>(localItems: T[], cloudItems: T[]): T[] {
  const map = new Map(localItems.map((item) => [item.id, item]));
  for (const item of cloudItems) {
    if (!map.has(item.id)) {
      map.set(item.id, item);
    }
  }
  return Array.from(map.values());
}

function mergeCashSessions(
  local: AppStatePayload,
  cloud: AppStatePayload,
): Pick<AppStatePayload, "currentCashSession" | "cashSessionHistory"> {
  const history = mergeById(local.cashSessionHistory, cloud.cashSessionHistory)
    .sort((a, b) => b.openedAt.localeCompare(a.openedAt));

  const current = local.currentCashSession ?? cloud.currentCashSession;
  const currentId = current?.id;

  return {
    currentCashSession: current,
    cashSessionHistory: history.filter((session) => session.id !== currentId),
  };
}

export function mergeAppStates(local: AppStatePayload, cloud: AppStatePayload): AppStatePayload {
  const cash = mergeCashSessions(local, cloud);

  return {
    // Inventario: la tienda local es fuente de verdad para respetar altas/bajas.
    products: local.products,
    transactions: mergeById(local.transactions, cloud.transactions),
    appointments: mergeById(local.appointments, cloud.appointments),
    stockMovements: mergeById(local.stockMovements, cloud.stockMovements),
    wholesaleClients: mergeById(local.wholesaleClients ?? [], cloud.wholesaleClients ?? []),
    currentCashSession: cash.currentCashSession,
    cashSessionHistory: cash.cashSessionHistory,
  };
}

export function countCloudOnlyAdded(local: AppStatePayload, merged: AppStatePayload) {
  const localTransactionIds = new Set(local.transactions.map((item) => item.id));
  const localAppointmentIds = new Set(local.appointments.map((item) => item.id));
  const localMovementIds = new Set(local.stockMovements.map((item) => item.id));
  const localClientIds = new Set((local.wholesaleClients ?? []).map((item) => item.id));

  return {
    products: 0,
    transactions: merged.transactions.filter((item) => !localTransactionIds.has(item.id)).length,
    appointments: merged.appointments.filter((item) => !localAppointmentIds.has(item.id)).length,
    stockMovements: merged.stockMovements.filter((item) => !localMovementIds.has(item.id)).length,
    wholesaleClients: (merged.wholesaleClients ?? []).filter((item) => !localClientIds.has(item.id)).length,
  };
}

export function hasInboundCloudChanges(added: ReturnType<typeof countCloudOnlyAdded>) {
  return added.transactions > 0
    || added.appointments > 0
    || added.stockMovements > 0
    || added.wholesaleClients > 0;
}

export function statesDiffer(before: AppStatePayload, after: AppStatePayload) {
  return JSON.stringify(before) !== JSON.stringify(after);
}
