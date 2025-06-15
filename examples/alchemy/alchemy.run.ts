import alchemy from "alchemy";
import { Worker, DurableObjectNamespace } from "alchemy/cloudflare";

// Initialize the Alchemy app
const app = await alchemy("my-userdo-app");

// Create the Durable Object namespace (note: uses 'new', not 'await')
const myAppDO = new DurableObjectNamespace("my-app-do", {
  className: "MyAppDO",
  sqlite: true,
});

// Create the Worker (note: uses 'await')
export const worker = await Worker("my-userdo-worker", {
  name: "my-userdo-worker",
  entrypoint: "./src/worker.ts",
  bindings: {
    MY_APP_DO: myAppDO,
    JWT_SECRET: alchemy.secret(process.env.JWT_SECRET || "dev-secret-change-in-production"),
  },
});

console.log(worker.url);

// Finalize the app
await app.finalize();