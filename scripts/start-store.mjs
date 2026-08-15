import { spawn, execSync } from "node:child_process";
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(rootDir, ".env") });
const distIndex = path.join(rootDir, "dist", "index.html");

process.chdir(rootDir);

execSync("node scripts/ensure-api-port.mjs", { stdio: "inherit" });

if (!fs.existsSync(distIndex)) {
  console.log("[store] Compilando aplicacion...");
  execSync("npm run build", { stdio: "inherit", cwd: rootDir });
}

const port = process.env.PORT ?? "3001";
const host = process.env.HOST ?? "127.0.0.1";
const appUrl = `http://${host === "0.0.0.0" ? "localhost" : host}:${port}`;

console.log("[store] Iniciando Lexy Essence en modo tienda...");
console.log(`[store] Abre en el navegador: ${appUrl}`);

const tsxCli = path.join(rootDir, "node_modules", "tsx", "dist", "cli.mjs");

const child = spawn(process.execPath, [tsxCli, "server/index.ts"], {
  cwd: rootDir,
  stdio: "inherit",
  env: {
    ...process.env,
    SERVE_STATIC: "1",
  },
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});

process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
