import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { defineConfig } from 'vite'
import tsConfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  server: {
    port: 3000,
  },
  plugins: [
    tsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tanstackStart({
      target: "cloudflare-module",
    }),
  ],
  define: {
    // Define globals for Cloudflare Workers compatibility
    'globalThis.DurableObjectState': 'globalThis.DurableObjectState',
    'globalThis.DurableObjectNamespace': 'globalThis.DurableObjectNamespace',
  },
  ssr: {
    external: ['cloudflare:workers'],
    noExternal: ['userdo'],
  },
  optimizeDeps: {
    exclude: ['userdo', 'cloudflare:workers'],
  },
})
