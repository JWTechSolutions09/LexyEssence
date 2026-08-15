import { execSync } from "node:child_process";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env") });

function readRegistryPort(valueName) {
  const key = "HKLM\\SOFTWARE\\Microsoft\\Microsoft SQL Server\\MSSQL17.SQLEXPRESS\\MSSQLServer\\SuperSocketNetLib\\Tcp\\IPAll";
  const out = execSync(`reg query "${key}" /v ${valueName}`, { encoding: "utf8" });
  const match = out.match(new RegExp(`${valueName}\\s+REG_SZ\\s+(\\d+)`, "i"));
  if (match?.[1] && match[1] !== "0") {
    return Number(match[1]);
  }
  return undefined;
}

function detectTcpPort() {
  if (process.env.MSSQL_PORT) {
    return Number(process.env.MSSQL_PORT);
  }
  try {
    return readRegistryPort("TcpDynamicPorts") ?? readRegistryPort("TcpPort");
  } catch {
    return undefined;
  }
}

const port = detectTcpPort();
const database = process.env.MSSQL_DATABASE ?? "LexyLocal";
const trusted = process.env.MSSQL_TRUSTED_CONNECTION === "1"
  || process.env.MSSQL_TRUSTED_CONNECTION === "true";
const user = process.env.MSSQL_USER?.trim();
const password = process.env.MSSQL_PASSWORD ?? "";
const useWindows = trusted || (!user && !password);

if (!port) {
  console.log("No se detecto puerto TCP en el registro.");
  console.log("Ejecuta como Admin: scripts\\sqlserver\\habilitar-tcp-sql.ps1");
  process.exit(1);
}

const host = "127.0.0.1";
const baseOptions = {
  encrypt: false,
  trustServerCertificate: true,
  enableArithAbort: true,
};

console.log(`Probando SQL Server (puerto TCP ${port}, base ${database})...\n`);

const attempts = [];

if (useWindows && process.platform === "win32") {
  const sqlNative = (await import("mssql/msnodesqlv8.js")).default;
  attempts.push({
    label: `${host}:${port} + Windows integrada (msnodesqlv8)`,
    pool: new sqlNative.ConnectionPool({
      server: host,
      port,
      database,
      driver: "msnodesqlv8",
      options: { ...baseOptions, trustedConnection: true },
      connectionTimeout: 15_000,
    }),
  });
}

if (user) {
  const sql = (await import("mssql")).default;
  attempts.push({
    label: `${host}:${port} + SQL (${user})`,
    pool: new sql.ConnectionPool({
      server: host,
      port,
      database,
      user,
      password,
      options: baseOptions,
      connectionTimeout: 15_000,
    }),
  });
}

for (const entry of attempts) {
  try {
    await entry.pool.connect();
    const row = await entry.pool.request().query("SELECT DB_NAME() AS db, SYSTEM_USER AS usr");
    console.log(`OK (${entry.label})`);
    console.log("   ", row.recordset[0]);
    await entry.pool.close();
    console.log("\nPuerto dinamico:", port);
    if (useWindows) {
      console.log("En .env usa: MSSQL_TRUSTED_CONNECTION=true (sin MSSQL_USER).");
    }
    process.exit(0);
  } catch (error) {
    console.log(`FAIL (${entry.label}):`, error instanceof Error ? error.message : error);
  }
}

console.log("\nUsuario Windows:", `${process.env.USERDOMAIN}\\${process.env.USERNAME}`);
console.log("\nSolucion rapida:");
console.log("1. En SSMS ejecuta: scripts/sqlserver/crear-login-windows.sql");
console.log("2. En .env: MSSQL_TRUSTED_CONNECTION=true y quita MSSQL_USER/MSSQL_PASSWORD");
console.log("\nAlternativa SQL:");
console.log("1. Modo mixto en SSMS + ejecuta scripts/sqlserver/crear-login-sql.sql");
console.log("2. En .env: MSSQL_USER=lexy_app MSSQL_PASSWORD=LexyLocal2026! MSSQL_TRUSTED_CONNECTION=false");
process.exit(1);
