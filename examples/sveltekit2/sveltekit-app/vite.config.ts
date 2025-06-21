import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    sveltekit(),
    {
      name: 'cloudflare-workers-mock',
      resolveId(id) {
        if (id === 'cloudflare:workers') {
          return id;
        }
      },
      load(id) {
        if (id === 'cloudflare:workers') {
          return `
            export class DurableObject {
              constructor(state, env) {
                this.state = state;
                this.env = env;
              }
            }
            export class DurableObjectState {
              constructor() {
                this.storage = {
                  get: () => Promise.resolve(null),
                  put: () => Promise.resolve(),
                  delete: () => Promise.resolve()
                };
              }
            }
          `;
        }
      }
    }
  ],
  optimizeDeps: {
    exclude: ['userdo']
  },
  ssr: {
    noExternal: ['userdo']
  }
});
