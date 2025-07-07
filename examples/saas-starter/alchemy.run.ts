import alchemy from "alchemy";
import { Worker, DurableObjectNamespace } from "alchemy/cloudflare";
import { Price } from "alchemy/stripe";

const app = await alchemy("userdo-saas");

// Durable Object storing user accounts and billing info
const SAAS_DO = new DurableObjectNamespace("saas-do", {
  className: "SaaSDO",
  sqlite: true,
});

const monthly = await Price("monthly-plan", {
  apiKey: alchemy.secret(process.env.STRIPE_API_KEY || ""),
  currency: "usd",
  unitAmount: 2000,
  recurring: { interval: "month" },
});

export const worker = await Worker("userdo-saas-worker", {
  entrypoint: "./src/worker.ts",
  bindings: {
    SAAS_DO,
    JWT_SECRET: alchemy.secret(process.env.JWT_SECRET || "dev-secret"),
    STRIPE_API_KEY: alchemy.secret(process.env.STRIPE_API_KEY || ""),
    STRIPE_PRICE_ID: monthly.id,
    STRIPE_WEBHOOK_SECRET: alchemy.secret(process.env.STRIPE_WEBHOOK_SECRET || ""),
    OPENAI_API_KEY: alchemy.secret(process.env.OPENAI_API_KEY || ""),
  },
});

console.log(worker.url);

await app.finalize();
