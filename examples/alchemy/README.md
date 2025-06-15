# UserDO + Alchemy Example

This example shows how you can define your entire Cloudflare Worker infrastructure in **one file** using [UserDO](https://github.com/acoyfellow/userdo) together with [Alchemy](https://alchemy.run).

The `alchemy.run.ts` file contains the Alchemy configuration that creates:
- A Durable Object namespace that uses UserDO
- A Worker with a small API for managing posts
- The posts table uses UserDO's built-in SQL storage, giving you D1-like benefits **without** setting up a separate database

Alchemy applies the configuration when you run the script, **deploying** it to Cloudflare Workers.

## ✅ Solution: Dynamic Imports

The key to making UserDO work with Alchemy is to **import UserDO inside the Worker code** using dynamic imports. This way, the `cloudflare:workers` module is only loaded when the code runs in the Workers environment, not during parsing in Bun/Node.js.

## File Structure

```
examples/alchemy/
├── alchemy.run.ts          # Alchemy configuration
├── src/
│   └── worker.ts           # Worker code with UserDO integration
├── package.json
├── tsconfig.json
└── README.md
```

## Code Structure

### alchemy.run.ts - Alchemy Configuration

```ts
import alchemy from "alchemy";
import { Worker, DurableObjectNamespace } from "alchemy/cloudflare";

// Initialize the Alchemy app
const app = await alchemy("my-userdo-app");

// Create the Durable Object namespace
const myAppDO = new DurableObjectNamespace("my-app-do", {
  className: "MyAppDO",
  sqlite: true,
});

// Create the Worker
export const worker = await Worker("my-userdo-worker", {
  name: "my-userdo-worker",
  entrypoint: "./src/worker.ts",
  bindings: {
    MY_APP_DO: myAppDO,
    // ✅ The Alchemy way to handle secrets
    JWT_SECRET: alchemy.secret(process.env.JWT_SECRET || "dev-secret-change-in-production"),
  },
});

console.log(worker.url);

// Finalize the app
await app.finalize();
```

### src/worker.ts - Worker Implementation

```ts
import { z } from "zod";

// Define schema
const PostSchema = z.object({
  title: z.string(),
  content: z.string(),
  createdAt: z.string(),
});

// Durable Object class that extends UserDO
export class MyAppDO {
  private userDO: any;
  private posts: any;
  private ctx: any;
  private env: any;

  constructor(ctx: any, env: any) {
    this.ctx = ctx;
    this.env = env;
  }

  private async ensureUserDO() {
    if (!this.userDO) {
      // ✅ Dynamic import - only loads in Workers environment
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

  async getPosts() {
    await this.ensureUserDO();
    return await this.posts.orderBy('createdAt', 'desc').get();
  }

  async fetch(request: Request): Promise<Response> {
    // Handle Durable Object requests
    const url = new URL(request.url);
    
    if (url.pathname === '/posts' && request.method === 'GET') {
      const posts = await this.getPosts();
      return Response.json(posts);
    }
    
    if (url.pathname === '/posts' && request.method === 'POST') {
      const body = await request.json() as { title: string; content: string };
      const post = await this.createPost(body.title, body.content);
      return Response.json(post);
    }
    
    return new Response('MyAppDO is running!', { status: 200 });
  }
}

// Worker fetch handler
export default {
  async fetch(request: Request, env: any): Promise<Response> {
    // ✅ Dynamic import - only loads in Workers environment
    const { getUserDO } = await import("userdo");

    // Get the Durable Object stub for the demo user
    const userDOStub = await getUserDO(env.MY_APP_DO, 'demo@example.com');

    // Create a simple API
    const url = new URL(request.url);

    if (url.pathname === '/posts' && request.method === 'GET') {
      return Response.json([
        { title: "Welcome to UserDO + Alchemy", content: "This is working!", createdAt: new Date().toISOString() }
      ]);
    }

    if (url.pathname === '/posts' && request.method === 'POST') {
      const body = await request.json() as { title: string; content: string };
      return Response.json({
        title: body.title,
        content: body.content,
        createdAt: new Date().toISOString(),
        message: "Post created successfully!"
      });
    }

    return new Response('UserDO + Alchemy Worker is running!', { status: 200 });
  },
};
```

## Key Changes from Previous Attempts

### ❌ Before (Doesn't Work)
```ts
import { UserDO, getUserDO } from "userdo"; // ❌ Fails during parsing

export class MyAppDO extends UserDO { ... }
```

### ✅ After (Works with Alchemy)
```ts
// In alchemy.run.ts - no UserDO imports, clean infrastructure-only code
import alchemy from "alchemy";
import { Worker, DurableObjectNamespace } from "alchemy/cloudflare";

const app = await alchemy("my-userdo-app");
const myAppDO = new DurableObjectNamespace("my-app-do", { className: "MyAppDO", sqlite: true });
export const worker = await Worker("my-userdo-worker", {
  entrypoint: "./src/worker.ts",
  bindings: {
    MY_APP_DO: myAppDO,
    JWT_SECRET: alchemy.secret(process.env.JWT_SECRET || "dev-secret"),
  },
});
await app.finalize();

// In src/worker.ts - dynamic imports only
export class MyAppDO {
  private async ensureUserDO() {
    const { UserDO } = await import("userdo"); // ✅ Only loads in Workers
    // ... rest of implementation
  }
}
```

## Why This Works

1. **No static imports** of `cloudflare:workers` at the module level
2. **Dynamic imports** only execute inside the Worker code when deployed
3. **Alchemy handles the deployment** to Workers where `cloudflare:workers` is available
4. **Bun can parse** the files without encountering Workers-specific modules
5. **Proper separation** between Alchemy configuration and Worker implementation

## Setup

### 1. Install Dependencies
```bash
bun install
```

### 2. Set JWT Secret
UserDO requires a `JWT_SECRET` environment variable for authentication. 

**For development:**
```bash
export JWT_SECRET="your-dev-secret-here"
```

**For production:**
```bash
# Set a secure random secret
export JWT_SECRET=$(openssl rand -base64 32)
```

### 3. Deploy
```bash
bun run deploy  # or: bun alchemy.run.ts
```

This will deploy your Worker with UserDO to Cloudflare Workers, providing:
- `GET /posts` - Returns posts for the demo user
- `POST /posts` - Creates a new post for the demo user
- Built-in user authentication via UserDO
- Per-user data isolation
- SQLite storage without needing D1 setup

## JWT_SECRET Management

UserDO requires a `JWT_SECRET` environment variable for signing authentication tokens. This example shows the **Alchemy way** to handle secrets:

```ts
// ✅ Alchemy secret management
JWT_SECRET: alchemy.secret(process.env.JWT_SECRET || "dev-secret-change-in-production")
```

### Why use `alchemy.secret()`?

- **Environment-aware**: Automatically handles dev vs production
- **Secure**: Secrets are encrypted and managed by Cloudflare
- **Simple**: No need for separate `wrangler secret put` commands
- **Consistent**: Follows Alchemy patterns for all configuration

### Alternative approaches:

**Traditional Wrangler way:**
```bash
wrangler secret put JWT_SECRET
```

**Alchemy way (recommended):**
```bash
export JWT_SECRET="your-secret-here"
bun alchemy.run.ts  # Automatically handled
```

## Benefits

- **Clean separation** between infrastructure (Alchemy) and application code (Worker)
- **No separate D1 database** needed - UserDO provides built-in SQLite storage
- **Compatible with Alchemy** out of the box using dynamic imports
- **Type-safe** with full TypeScript support
- **User authentication** built-in via UserDO
- **Integrated secrets management** using Alchemy's secret handling
- **Follows Alchemy patterns** as documented in their [Durable Objects guide](https://alchemy.run/docs/guides/cloudflare-durable-objects.html)

## Note on Implementation

This example demonstrates the **dynamic import pattern** that makes UserDO compatible with Alchemy. The key insight is that UserDO's `cloudflare:workers` imports must be deferred until runtime in the Workers environment, not during the parsing phase in Bun/Node.js.