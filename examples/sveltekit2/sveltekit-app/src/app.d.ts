// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
  namespace App {
    interface Locals {
      user?: {
        id: string;
        email: string;
      } | null;
    }
    interface Platform {
      env: Env
      cf: CfProperties
      ctx: ExecutionContext
    }
  }
}

interface Env {
  MY_DO: DurableObjectNamespace;
  EXAMPLE_KV: KVNamespace;
}

export { };