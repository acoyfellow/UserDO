# Svelte + Vite + UserDO Example

A task management app built with Svelte and UserDO on Cloudflare Workers. It mirrors the React example but uses Svelte for the UI.

## Project Structure

```
examples/svelte-vite/
├── src/
│   ├── svelte-app/          # Svelte frontend
│   │   └── App.svelte       # Main component
│   └── worker/              # Cloudflare Worker backend
│       └── index.ts         # Worker logic (same as React example)
├── wrangler.jsonc           # Cloudflare Worker configuration
├── package.json             # Dependencies and scripts
├── vite.config.ts           # Vite + Cloudflare plugin
└── README.md
```

## Quick Start

```bash
# From examples/svelte-vite
npm install   # or bun install

# In one terminal start the Worker
npx wrangler dev --port 8787

# In another start the Svelte dev server
npm run dev
```

The Svelte app runs at http://localhost:5173 and proxies API requests to the Worker on port 8787.
