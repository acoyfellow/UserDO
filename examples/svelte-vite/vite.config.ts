import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { cloudflare } from '@cloudflare/vite-plugin';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    svelte(),
    tailwindcss(),
    cloudflare({
      configPath: './wrangler.jsonc',
      persist: {
        path: '.wrangler/state/v3'
      }
    })
  ]
});
