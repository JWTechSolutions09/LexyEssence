export type QueryResult = {
  rows: Record<string, unknown>[];
  rowCount: number;
};

export interface DatabaseBackend {
  readonly label: string;
  ready: boolean;
  init(): Promise<string>;
  ping(): Promise<string>;
  reset(): Promise<void>;
  query(text: string, params?: unknown[]): Promise<QueryResult>;
  withTransaction<T>(fn: (tx: DatabaseBackend) => Promise<T>): Promise<T>;
}
