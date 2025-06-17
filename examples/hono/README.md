# UserDO Hono Example

This example demonstrates how to extend UserDO with custom business logic using modern patterns and best practices.

## Key Features

- **Extends UserDO**: Custom Durable Object with business-specific methods
- **Type-safe Tables**: Uses Zod schemas for data validation
- **Real-time Events**: Automatic broadcasting of table operations
- **DRY Patterns**: Helper functions to reduce code duplication
- **Unified Endpoints**: Single endpoints that handle both JSON and form data
- **Modern UI**: Clean, responsive interface

## Architecture

### 1. Schema Definition

```ts
const PostSchema = z.object({
  title: z.string(),
  content: z.string(),
  createdAt: z.string(),
});

type Post = z.infer<typeof PostSchema>;
```

### 2. Extended UserDO

```ts
export class MyAppDO extends UserDO {
  posts: Table<Post>;

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    this.posts = this.table('posts', PostSchema, { userScoped: true });
  }

  async createPost(title: string, content: string) {
    return await this.posts.create({
      title,
      content,
      createdAt: new Date().toISOString(),
    });
  }

  async getPosts() {
    return await this.posts.orderBy('createdAt', 'desc').get();
  }

  async deletePost(id: string) {
    await this.posts.delete(id);
    return { ok: true };
  }
}
```

### 3. Worker with Helper Functions

```ts
import { createUserDOWorker, createWebSocketHandler, getUserDOFromContext } from 'userdo'

const userDOWorker = createUserDOWorker('MY_APP_DO');
const webSocketHandler = createWebSocketHandler('MY_APP_DO');

// DRY helper functions
const getMyAppDO = (c: any, email: string) => {
  return getUserDOFromContext(c, email, 'MY_APP_DO') as MyAppDO;
}

const requireAuth = (c: any) => {
  const user = c.get('user');
  if (!user) {
    return { error: c.json({ error: 'Unauthorized' }, 401), user: null };
  }
  return { user, error: null };
}

const broadcastPostChange = (email: string, action: string, data: any, env: any) => {
  broadcastToUser(email, {
    event: 'table:posts',
    data: { action, ...data },
    timestamp: Date.now()
  }, 'MY_APP_DO', env);
}
```

### 4. Unified Endpoints

```ts
// Single endpoint handles both JSON and form data
userDOWorker.post("/posts", async (c) => {
  const { user, error } = requireAuth(c);
  if (error) return error;

  let title: string, content: string;

  // Support both JSON and form data
  const contentType = c.req.header('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = await c.req.json();
    ({ title, content } = data);
  } else {
    const formData = await c.req.formData();
    title = formData.get('title') as string;
    content = formData.get('content') as string;
  }

  if (!title || !content) {
    return c.json({ error: "Missing title or content" }, 400);
  }

  const myAppDO = getMyAppDO(c, user!.email);
  const post = await myAppDO.createPost(title, content);

  // Broadcast real-time update
  broadcastPostChange(user!.email, 'create', { data: post }, c.env);

  // Return appropriate response based on request type
  if (contentType.includes('application/json')) {
    return c.json({ ok: true, data: post });
  } else {
    return c.redirect('/');
  }
});
```

## API Endpoints

### Built-in (from createUserDOWorker)
- `POST /api/signup` - Create user account
- `POST /api/login` - Authenticate user  
- `POST /api/logout` - End user session
- `GET /api/me` - Get current user info
- `POST /api/password-reset/request` - Generate reset token
- `POST /api/password-reset/confirm` - Reset password with token
- `GET /data` - Get user's key-value data
- `POST /data` - Set user's key-value data

### Custom (added by this example)
- `GET /posts` - List user's posts
- `POST /posts` - Create post (handles both JSON and form data)
- `DELETE /posts/:id` - Delete a post
- `POST /api/posts` - JSON-only post creation endpoint

### WebSocket
- `GET /api/ws` - Real-time event stream

## Database Operations

### Table Operations (with automatic events)
```ts
// Create - broadcasts 'table:posts' event
const post = await this.posts.create({ title, content, createdAt });

// Update - broadcasts 'table:posts' event  
const updated = await this.posts.update(id, { title, content });

// Delete - broadcasts 'table:posts' event
await this.posts.delete(id);

// Query - no events
const posts = await this.posts.orderBy('createdAt', 'desc').get();
```

### Key-Value Storage (with automatic events)
```ts
// Set - broadcasts 'kv:{key}' event
await this.set('preferences', { theme: 'dark', language: 'en' });

// Get - no events
const preferences = await this.get('preferences');
```

## Real-time Events

All data operations automatically broadcast WebSocket events:

- `table:posts` - When posts are created, updated, or deleted
- `kv:{key}` - When key-value data is stored

## DRY Improvements

This example demonstrates several patterns to reduce code duplication:

### 1. Authentication Helper
```ts
const requireAuth = (c: any) => {
  const user = c.get('user');
  if (!user) {
    return { error: c.json({ error: 'Unauthorized' }, 401), user: null };
  }
  return { user, error: null };
}
```

### 2. Broadcasting Helper
```ts
const broadcastPostChange = (email: string, action: string, data: any, env: any) => {
  broadcastToUser(email, {
    event: 'table:posts',
    data: { action, ...data },
    timestamp: Date.now()
  }, 'MY_APP_DO', env);
}
```

### 3. Client-side API Helper
```ts
const apiCall = async (url, options = {}) => {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  
  if (!response.ok) throw new Error('Request failed');
  return await response.json();
};
```

### 4. Unified Content-Type Handling
Single endpoints that handle both JSON API calls and form submissions.

## Running the Example

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Deploy to Cloudflare
npm run deploy
```

## Configuration

### wrangler.jsonc
```jsonc
{
  "name": "userdo-hono-example",
  "main": "index.tsx",
  "vars": {
    "JWT_SECRET": "your-jwt-secret-here"
  },
  "durable_objects": {
    "bindings": [
      {
        "name": "MY_APP_DO",
        "class_name": "MyAppDO"
      }
    ]
  }
}
```

## Files Structure

- `index.tsx` - Main application with extended UserDO class
- `wrangler.example.jsonc` - Configuration template
- `wrangler.jsonc` - Local configuration (gitignored)
- `package.json` - Dependencies
- `tsconfig.json` - TypeScript configuration

## Quick Start

### Prerequisites
- [Bun](https://bun.sh) or [Node.js](https://nodejs.org)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)
- Cloudflare account

### Steps
1. **Copy the example**
   ```bash
   cp -r examples/hono my-userdo-app
   cd my-userdo-app
   ```

2. **Set up configuration**
   ```bash
   cp wrangler.example.jsonc wrangler.jsonc
   ```

3. **Install dependencies**
   ```bash
   bun install  # or npm install
   ```

4. **Set JWT secret**
   ```bash
   # For local development (add to wrangler.jsonc):
   "vars": { "JWT_SECRET": "your-local-dev-secret" }
   
   # For production:
   wrangler secret put JWT_SECRET
   ```

5. **Run locally**
   ```bash
   bun run dev  # or npm run dev
   ```

6. **Deploy (optional)**
   ```bash
   bun run deploy  # or npm run deploy
   ```

Visit `http://localhost:8787` to see your app!

## Key Benefits

- **Minimal Boilerplate**: Start with complete auth system
- **Type Safety**: Zod schemas ensure data integrity
- **Real-time Ready**: Automatic event broadcasting
- **Scalable**: Per-user data isolation via Durable Objects
- **Extensible**: Add business logic without touching core auth
- **DRY Code**: Helper functions reduce duplication
- **Flexible**: Endpoints handle multiple content types 