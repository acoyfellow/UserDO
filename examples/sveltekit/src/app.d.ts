declare global {
  namespace App {
    interface Platform {
      env: Env;
      cf: CfProperties;
      ctx: ExecutionContext;
    }
  }
}

interface Env {
  MY_APP_DO: DurableObjectNamespace;
}

export {};
