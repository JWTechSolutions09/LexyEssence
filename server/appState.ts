export {
  loadAppState,
  pushLocalStateToCloud,
  saveAppState,
} from "./database/manager.js";

export type { SaveAppStateResult } from "./database/manager.js";

export {
  hasUserAppData,
  shouldMigrateLocalState,
  type AppStatePayload,
} from "./database/appStateStore.js";
