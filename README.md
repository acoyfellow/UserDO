# UserDO

A Durable Object base class that provides user authentication, per-user data storage, and real-time updates for Cloudflare Workers applications.

## What it provides

- User authentication with JWT tokens
- Per-user SQLite tables with type-safe schemas
- Per-user key-value storage
- Real-time data synchronization via WebSockets
- HTTP endpoints for authentication and data operations
- Browser client with auto-reconnecting WebSocket support

## Core components

- **UserDO class**: Extend this to add your application logic
- **Worker**: Pre-built Hono server with authentication endpoints
- **Client**: Browser library for API calls and real-time subscriptions
- **Database**: Type-safe tables with query builder

## Basic usage

```ts
import { UserDO, type Env, type Table } from "userdo";
import { z } from "zod";

const PostSchema = z.object({
  title: z.string(),
  content: z.string(),
  createdAt: z.string(),
});

type Post = z.infer<typeof PostSchema>;

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
}
```

## Using the worker factory

```ts
// Simple HTTP-only worker
import { createUserDOWorker } from 'userdo';
export default createUserDOWorker();

// Worker with WebSocket support
import { createUserDOWorker, createWebSocketHandler } from 'userdo';

const app = createUserDOWorker('MY_APP_DO');
const wsHandler = createWebSocketHandler('MY_APP_DO');

export default {
  async fetch(request, env, ctx) {
    // Handle WebSocket upgrades
    if (request.headers.get('upgrade') === 'websocket') {
      return wsHandler.fetch(request, env, ctx);
    }
    
    // Handle HTTP requests
    return app.fetch(request, env, ctx);
  }
};

// Add custom routes
app.post('/api/posts', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  
  const { title, content } = await c.req.json();
  const myAppDO = getUserDOFromContext(c, user.email, 'MY_APP_DO') as MyAppDO;
  const post = await myAppDO.createPost(title, content);
  
  return c.json({ post });
});
```

## HTTP endpoints

All endpoints include request/response validation with Zod schemas.

**Authentication**
- `POST /api/signup` - Create user account
- `POST /api/login` - Authenticate user
- `POST /api/logout` - End user session
- `GET /api/me` - Get current user info

**Password reset**
- `POST /api/password-reset/request` - Generate reset token
- `POST /api/password-reset/confirm` - Reset password with token

**Data**
- `GET /data` - Get user's key-value data
- `POST /data` - Set user's key-value data

**Real-time**
- `GET /api/ws` - WebSocket connection for real-time updates

## Browser client

```ts
import { UserDOClient } from 'userdo';

const client = new UserDOClient('/api');

// Authentication
await client.signup('user@example.com', 'password');
await client.login('user@example.com', 'password');

// Data operations
const posts = client.collection('posts');
await posts.create({ title: 'Hello', content: 'World' });
const list = await posts.query().orderBy('createdAt', 'desc').get();

// Real-time updates via WebSocket
posts.onChange(data => console.log('Post changed:', data));
client.onChange('key', data => console.log('KV changed:', data));
```

## Installation

```bash
npm install userdo
```

## Multiple projects

You can use UserDO in multiple projects without conflicts by using different binding names:

```ts
// Project 1: Blog
const blogWorker = createUserDOWorker('BLOG_DO');

// Project 2: E-commerce
const shopWorker = createUserDOWorker('SHOP_DO');

// Project 3: Default binding
const defaultWorker = createUserDOWorker(); // Uses 'USERDO'
```

Each project will have completely isolated user data and can be deployed to the same Cloudflare account.

## Wrangler configuration

```jsonc
{
  "main": "src/index.ts",
  "vars": {
    "JWT_SECRET": "your-jwt-secret"
  },
  "durable_objects": {
    "bindings": [
      {
        "name": "USERDO", // or any custom name like "MY_APP_DO"
        "class_name": "UserDO" // or your extended class like "MyAppDO"
      }
    ]
  }
}
```


## Authentication methods

```ts
// Create account
const { user, token, refreshToken } = await userDO.signup({ email, password });

// Sign in
const { user, token, refreshToken } = await userDO.login({ email, password });

// Verify token
const result = await userDO.verifyToken({ token });

// Refresh token
const { token: newToken } = await userDO.refreshToken({ refreshToken });

// Change password
await userDO.changePassword({ oldPassword, newPassword });

// Reset password
await userDO.resetPassword({ newPassword });

// End session
await userDO.logout();
```

## Database operations

```ts
// All operations are fully typed with your schema
await this.posts.create({ 
  title: 'Hello', 
  content: 'World', 
  createdAt: new Date().toISOString() 
});
await this.posts.findById(id);
await this.posts.update(id, { title: 'Updated' });
await this.posts.delete(id);

// Queries
await this.posts.where('title', '==', 'Hello').get();
await this.posts.orderBy('createdAt', 'desc').limit(10).get();
await this.posts.count();
```

## Key-value storage

```ts
// Store data
await userDO.set('preferences', { theme: 'dark', language: 'en' });

// Retrieve data
const preferences = await userDO.get('preferences');
```

## Real-time updates

The system broadcasts events when data changes occur. Events are delivered via WebSockets with automatic reconnection.

```ts
// Listen for KV changes
const unsubscribe = client.onChange('preferences', data => {
  console.log('Preferences updated:', data);
});

// Listen for table changes
const posts = client.collection('posts');
const unsubscribe2 = posts.onChange(data => {
  console.log('Post changed:', data);
});

// Cleanup when needed
unsubscribe();
unsubscribe2();
```

## Type safety

All endpoints are fully typed with TypeScript and validated with Zod schemas.

```ts
import type { UserDOEndpoints, EndpointRequest, EndpointResponse } from 'userdo';

type SignupRequest = EndpointRequest<'POST /api/signup'>;
type SignupResponse = EndpointResponse<'POST /api/signup'>;
```

## Examples

See the `examples/` directory for complete implementations:
- [`examples/hono`](examples/hono) - Full Hono integration
- [`examples/alchemy`](examples/alchemy) - Alchemy.run deployment
- [`examples/effect`](examples/effect) - Effect library integration
- [`examples/multi-tenant`](examples/multi-tenant) - Multi-tenant SaaS pattern

## Security features

- Email addresses are hashed for Durable Object IDs
- Passwords use PBKDF2 with WebCrypto
- JWT tokens with configurable expiration
- Rate limiting on authentication endpoints
- User data isolation by default

## Limitations

- Requires Cloudflare Workers environment
- SQLite storage is per-Durable Object instance
- WebSocket connections are per-user (isolated)
- No built-in user management interface
- Must use Cloudflare (Durable Objects, KV, etc.), not self-hosted


### Recent improvements

- ✅ WebSocket real-time support with auto-reconnection
- ✅ Firestore-like onChange API for KV and collections
- ✅ Worker-level WebSocket handling (bypasses Hono serialization issues)
