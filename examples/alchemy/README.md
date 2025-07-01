# Alchemy Deployment Example

Learn how to deploy UserDO applications using Alchemy's infrastructure-as-code approach, defining your entire Cloudflare Workers setup in a single file.

## What You'll Learn

- How to deploy UserDO applications using Alchemy instead of wrangler.jsonc
- Setting up Durable Objects and Workers with code instead of configuration files
- Managing secrets and environment variables through Alchemy
- Using dynamic imports to make UserDO work with Alchemy's deployment process

## Why Use Alchemy with UserDO

- **Infrastructure as Code**: Define your entire deployment in TypeScript
- **Simplified Secrets**: Handle environment variables without manual CLI commands
- **Version Control**: Your infrastructure configuration lives with your code
- **Reproducible Deployments**: Same configuration works across environments

## Key Challenge Solved

Alchemy runs in Node.js/Bun during deployment, but UserDO needs Cloudflare Workers APIs. This example shows how to use dynamic imports to solve this compatibility issue.

## File Structure

```
examples/alchemy/
├── alchemy.run.ts     # Alchemy deployment configuration
├── src/worker.ts      # Worker code with UserDO integration
├── package.json
└── README.md
```

## Deployment Configuration

### alchemy.run.ts

```ts
import alchemy from "alchemy";
import { Worker, DurableObjectNamespace } from "alchemy/cloudflare";

const app = await alchemy("my-userdo-app");

// Create Durable Object namespace
const myAppDO = new DurableObjectNamespace("my-app-do", {
  className: "MyAppDO",
  sqlite: true,
});

// Create Worker with bindings
export const worker = await Worker("my-userdo-worker", {
  name: "my-userdo-worker",
  entrypoint: "./src/worker.ts",
  bindings: {
    MY_APP_DO: myAppDO,
    JWT_SECRET: alchemy.secret(process.env.JWT_SECRET || "dev-secret"),
  },
});

console.log(worker.url);
await app.finalize();
```

## Worker Implementation

### src/worker.ts

The key is using dynamic imports so UserDO only loads when running in Workers:

```ts
export class MyAppDO {
  private userDO: any;
  private posts: any;

  constructor(ctx: any, env: any) {
    this.ctx = ctx;
    this.env = env;
  }

  private async ensureUserDO() {
    if (!this.userDO) {
      // Dynamic import - only loads in Workers environment
      const { UserDO } = await import("userdo");
      this.userDO = new UserDO(this.ctx, this.env);
      this.posts = this.userDO.table('posts', PostSchema, { userScoped: true });
    }
  }

  async createPost(title: string, content: string) {
    await this.ensureUserDO();
    return await this.posts.create({
      title,
      content,
      createdAt: new Date().toISOString(),
    });
  }
}
```

## Running the Example

```bash
cd examples/alchemy

# Install dependencies
bun install

# Set your JWT secret
export JWT_SECRET="your-secret-here"

# Deploy with Alchemy
bun run alchemy.run.ts
```

Alchemy will output the URL where your application is deployed.

## What This Demonstrates

### Traditional Deployment (wrangler.jsonc)
```jsonc
{
  "name": "my-app",
  "main": "src/worker.ts",
  "vars": { "JWT_SECRET": "..." },
  "durable_objects": {
    "bindings": [
      { "name": "MY_APP_DO", "class_name": "MyAppDO" }
    ]
  }
}
```

### Alchemy Deployment (alchemy.run.ts)
```ts
const myAppDO = new DurableObjectNamespace("my-app-do", {
  className: "MyAppDO",
  sqlite: true,
});

export const worker = await Worker("my-userdo-worker", {
  entrypoint: "./src/worker.ts",
  bindings: {
    MY_APP_DO: myAppDO,
    JWT_SECRET: alchemy.secret(process.env.JWT_SECRET),
  },
});
```

## Key Learning Points

1. **Dynamic Imports**: Use `await import("userdo")` inside functions, not at module level
2. **Infrastructure as Code**: Define Workers and Durable Objects programmatically
3. **Secret Management**: Handle environment variables without manual CLI steps
4. **Deployment Automation**: One command deploys everything

## Extending This Example

To use this pattern for your application:

1. Replace the post creation logic with your business logic
2. Add any additional Durable Object namespaces you need
3. Configure environment variables in the Alchemy configuration
4. Add any additional Workers or services your app requires

This approach is especially useful for:
- Teams that prefer infrastructure as code
- Applications with complex deployment requirements
- Projects that need reproducible deployments across environments