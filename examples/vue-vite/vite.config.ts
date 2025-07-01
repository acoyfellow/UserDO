import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { cloudflare } from '@cloudflare/vite-plugin';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    cloudflare({
      configPath: './wrangler.jsonc',
      persist: {
        path: '.wrangler/state/v3'
      }
    })
  ]
});
