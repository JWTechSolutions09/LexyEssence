import { execSync } from "node:child_process";

const port = Number(process.env.PORT ?? 3001);

try {
  const output = execSync(`netstat -ano | findstr :${port}`, { encoding: "utf8" }).trim();
  if (!output) process.exit(0);

  const pids = new Set(
    output
      .split(/\r?\n/)
      .map((line) => line.trim().split(/\s+/).pop())
      .filter((pid) => pid && /^\d+$/.test(pid)),
  );

  for (const pid of pids) {
  if (pid === String(process.pid)) continue;
    console.log(`Liberando puerto ${port} (PID ${pid})...`);
    execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
  }
} catch {
  // No process on port.
}
