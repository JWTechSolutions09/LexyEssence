import { execSync } from "node:child_process";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
dotenv.config({ path: path.join(projectRoot, ".env") });

export type DatabaseMode = "cloud" | "dual" | "local";
export function getDatabaseMode(): DatabaseMode {
  const raw = (process.env.DATABASE_MODE ?? "cloud").trim().toLowerCase();
  if (raw === "dual" || raw === "local") return raw;
  return "cloud";
}

export function isDualDatabaseMode() {
  return getDatabaseMode() === "dual";
}

export function usesLocalSqlServer() {
  return getDatabaseMode() === "dual" || getDatabaseMode() === "local";
}

export function usesCloudPostgres() {
  return getDatabaseMode() === "cloud" || getDatabaseMode() === "dual";
}

export function getMssqlConfig() {
  let server = (process.env.MSSQL_SERVER ?? "localhost\\SQLEXPRESS").trim();
  // En .env un solo \ puede perderse (localhost\SQLEXPRESS -> localhostSQLEXPRESS)
  if (/^localhost\s*sqlexpress$/i.test(server.replace(/\\/g, ""))) {
    server = "localhost\\SQLEXPRESS";
  }
  const database = process.env.MSSQL_DATABASE ?? "LexyLocal";
  const user = process.env.MSSQL_USER?.trim();
  const password = process.env.MSSQL_PASSWORD;
  const trusted = process.env.MSSQL_TRUSTED_CONNECTION === "1"
    || process.env.MSSQL_TRUSTED_CONNECTION === "true";

  return { server, database, user, password, trusted };
}

function readRegistryPort(valueName: "TcpDynamicPorts" | "TcpPort") {
  const key = "HKLM\\SOFTWARE\\Microsoft\\Microsoft SQL Server\\MSSQL17.SQLEXPRESS\\MSSQLServer\\SuperSocketNetLib\\Tcp\\IPAll";
  const out = execSync(`reg query "${key}" /v ${valueName}`, { encoding: "utf8" });
  const match = out.match(new RegExp(`${valueName}\\s+REG_SZ\\s+(\\d+)`, "i"));
  if (match?.[1] && match[1] !== "0") {
    return Number(match[1]);
  }
  return undefined;
}

export function getMssqlPort(): number | undefined {
  if (process.env.MSSQL_PORT) {
    return Number(process.env.MSSQL_PORT);
  }

  try {
    return readRegistryPort("TcpDynamicPorts") ?? readRegistryPort("TcpPort");
  } catch {
    return undefined;
  }
}
