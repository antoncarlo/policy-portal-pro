// Runs the browser scenarios (e2e/*.e2e.mjs) against the Vite dev server with the network mocked:
// Supabase and /api are answered by each scenario, so nothing real is touched and no account is needed.
//
//   npm run test:e2e                 every scenario
//   npm run test:e2e -- renewals     only the ones whose name contains "renewals"
//
// Needs Chromium: `npx playwright install chromium` (the CI job does it).
import { spawn } from "node:child_process";
import { mkdirSync, readdirSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const PORT = Number(process.env.E2E_PORT ?? 5300);
const BASE = `http://127.0.0.1:${PORT}`;
const here = new URL("./", import.meta.url).pathname;
mkdirSync(`${here}artifacts`, { recursive: true });

const filters = process.argv.slice(2);
const scenarios = readdirSync(here)
  .filter((name) => name.endsWith(".e2e.mjs") && (filters.length === 0 || filters.some((filter) => name.includes(filter))))
  .sort();
if (scenarios.length === 0) {
  console.error("No scenario matches", filters);
  process.exit(2);
}

// The scenarios intercept the Supabase address of the project: the app must be built for that address.
const env = {
  ...process.env,
  VITE_SUPABASE_URL: "https://nesblhtjqiavdfsrtfom.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "e2e-publishable-key",
};

const server = spawn("npx", ["vite", "--host", "127.0.0.1", "--port", String(PORT), "--strictPort"], { env, stdio: ["ignore", "pipe", "pipe"], detached: true });
let serverLog = "";
server.stdout.on("data", (chunk) => (serverLog += chunk));
server.stderr.on("data", (chunk) => (serverLog += chunk));
const stopServer = () => {
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {
    // already gone
  }
};
process.on("exit", stopServer);
process.on("SIGINT", () => process.exit(130));

async function waitForServer() {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await fetch(BASE);
      if (response.ok) return;
    } catch {
      // not up yet
    }
    await sleep(500);
  }
  console.error("The dev server did not start:\n" + serverLog.slice(-2000));
  process.exit(1);
}

function runScenario(name) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [`${here}${name}`], { env: { ...env, E2E_BASE: BASE }, stdio: "inherit" });
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

await waitForServer();
const failed = [];
for (const name of scenarios) {
  console.log(`\n=== ${name}`);
  const code = await runScenario(name);
  if (code !== 0) failed.push(name);
}
console.log(failed.length === 0 ? `\nAll ${scenarios.length} scenarios passed.` : `\nFailed: ${failed.join(", ")}`);
process.exit(failed.length === 0 ? 0 : 1);
