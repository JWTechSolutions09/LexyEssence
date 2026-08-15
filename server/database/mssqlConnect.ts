import type { ConnectionPool, config as MssqlConfig } from "mssql";
import { getMssqlConfig, getMssqlPort } from "./config.js";

const CONNECTION_TIMEOUT_MS = 15_000;

export function buildMssqlConnectionConfig(): MssqlConfig {
  const { server: serverRaw, database, user, password, trusted } = getMssqlConfig();
  const port = getMssqlPort();

  let host = serverRaw;
  let instanceName: string | undefined;
  const slashIndex = serverRaw.indexOf("\\");

  if (slashIndex >= 0) {
    host = serverRaw.slice(0, slashIndex) || "localhost";
    instanceName = serverRaw.slice(slashIndex + 1);
  }

  if (host === "." || host.toLowerCase() === "(local)") {
    host = "localhost";
  }

  const useWindowsAuth = trusted || (!user && !password);
  const useNativeDriver = useWindowsAuth && process.platform === "win32";

  const baseOptions = {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
    ...(instanceName && !port ? { instanceName } : {}),
  };

  if (useNativeDriver) {
    return {
      server: host,
      database,
      port,
      driver: "msnodesqlv8",
      options: {
        ...baseOptions,
        trustedConnection: true,
      },
      connectionTimeout: CONNECTION_TIMEOUT_MS,
      requestTimeout: 60_000,
      pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30_000,
      },
    };
  }

  const config: MssqlConfig = {
    server: host,
    database,
    port,
    options: baseOptions,
    connectionTimeout: CONNECTION_TIMEOUT_MS,
    requestTimeout: 60_000,
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30_000,
    },
  };

  if (useWindowsAuth) {
    config.authentication = { type: "default", options: {} };
  } else {
    config.user = user;
    config.password = password ?? "";
  }

  return config;
}

export async function createMssqlPool(): Promise<ConnectionPool> {
  const connectionConfig = buildMssqlConnectionConfig();
  const useNative = connectionConfig.driver === "msnodesqlv8";

  if (useNative) {
    try {
      const sql = (await import("mssql/msnodesqlv8.js")).default;
      return new sql.ConnectionPool(connectionConfig);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn("[local] Windows integrada no disponible (ODBC):", message);
      console.warn("[local] Usa MSSQL_USER/MSSQL_PASSWORD en .env o instala ODBC Driver 18 for SQL Server.");
    }
  }

  const sql = (await import("mssql")).default;
  return new sql.ConnectionPool(connectionConfig);
}

export function formatMssqlConnectionLog(config: MssqlConfig) {
  const host = config.server;
  const port = config.port;
  const instanceName = config.options?.instanceName;
  const auth = config.driver === "msnodesqlv8"
    ? "Windows (integrada)"
    : config.user
      ? `SQL (${config.user})`
      : "Windows";

  return `host=${host}`
    + `${instanceName && !port ? ` instance=${instanceName}` : ""}`
    + `${port ? ` port=${port}` : ""}`
    + ` db=${config.database} auth=${auth}`;
}
