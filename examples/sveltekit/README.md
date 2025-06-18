# UserDO SvelteKit Example

This example shows a minimal SvelteKit app using **UserDO** with Durable Objects. It mirrors the Hono example but uses SvelteKit routes and the Cloudflare adapter.

## Features

- `MyAppDO` extends `UserDO` with a user scoped `posts` table
- `/api/*` routes are handled by `createUserDOWorker` in `hooks.server.ts`
- Built with `@sveltejs/adapter-cloudflare` for Worker deployment

## Running

```bash
npm install
npm run dev
```

Deploy with:

```bash
wrangler deploy
```

See `wrangler.jsonc` for Durable Object configuration.
