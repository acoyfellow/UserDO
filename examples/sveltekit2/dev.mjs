import { fork, execSync } from "node:child_process";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Use absolute path for shared persistence
const sharedPersistPath = resolve(__dirname, ".wrangler", "shared");

let wranglerDevResolve;
const wranglerDevPromise = new Promise((r) => (wranglerDevResolve = r));

const wranglerDevProcess = fork(
  join(__dirname, "node_modules", "wrangler", "bin", "wrangler.js"),
  ["dev", "--config", "wrangler.toml", "--persist-to", sharedPersistPath],
  {
    cwd: resolve(__dirname, "do-worker"),
    env: { BROWSER: "none", ...process.env },
    stdio: ["ignore", process.stdout, process.stderr, "ipc"],
  }
).on("message", () => {
  wranglerDevResolve();
});

wranglerDevProcess.on("SIGINT", () => {
  wranglerDevProcess.exit();
});

wranglerDevProcess.on("SIGTERM", () => {
  wranglerDevProcess.exit();
});

await wranglerDevPromise;

execSync("npm run dev", {
  cwd: resolve(__dirname, "sveltekit-app"),
  stdio: "inherit",
  env: {
    ...process.env,
    WRANGLER_CONFIG_PATH: "wrangler.toml",
    SHARED_PERSIST_PATH: sharedPersistPath
  }
});
