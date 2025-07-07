# SaaS Starter Example

A minimal template showing how to combine **UserDO**, **Stripe** payments and **Alchemy** deployment to build a SaaS application on Cloudflare.

## What You'll Learn

- Adding a billing table to store Stripe customer/subscription data
- Creating a subscription price using Alchemy's Stripe bindings
- Exposing a `/api/subscribe` endpoint that starts a Stripe Checkout session
- Handling Stripe webhooks to update subscription status
- Adding an `/api/ask` AI endpoint powered by the `ai` package
- Deploying the Worker and Durable Object with Alchemy in a single command

## File Structure

```
examples/saas-starter/
├── alchemy.run.ts      # Infrastructure as code
├── src/
│   └── worker.ts       # Worker + Stripe logic
└── package.json        # Dependencies
```

## Setup

1. Install dependencies

```bash
cd examples/saas-starter
bun install
```

2. Set your environment variables before deploying

```bash
export JWT_SECRET="your-jwt-secret"
export STRIPE_API_KEY="sk_test_..."
export OPENAI_API_KEY="sk-..."
export STRIPE_WEBHOOK_SECRET="whsec_..."
```

Alchemy will create the subscription price automatically.

3. Deploy with Alchemy

```bash
bun run alchemy.run.ts
```

Alchemy will output the deployed Worker URL.

## Learning Points

1. **UserDO handles auth and data** – extend it only where you need business logic.
2. **Alchemy creates your Stripe price** – one line of code, no dashboard needed.
3. **Checkout uses `createStripeClient()`** – minimal code for subscriptions.
4. **Stripe webhooks keep billing in sync** – cancellations immediately disable access and `trialing` or `past_due` states stay active.
5. **The `ai` package powers `/api/ask`** – plug in your API key and start selling.
6. **Prompts are sanitized** – lines starting with `system:`, `assistant:` or `user:` are stripped to reduce prompt injection.
7. **Infrastructure as code** – Alchemy defines everything in TypeScript.

