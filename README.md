# UserDO

A Durable Object base class that provides user authentication, per-user data storage, and real-time updates for Cloudflare Workers applications.

## Features

- **Authentication**: JWT-based user auth with signup, login, logout, and password reset
- **Database Tables**: Type-safe SQLite tables with Zod schemas and query builder
- **Key-Value Storage**: Per-user KV storage with automatic broadcasting
- **Real-time Updates**: WebSocket connections with hibernation API support
- **Worker Factory**: Pre-built Hono server with configurable binding names
- **Browser Client**: Auto-reconnecting WebSocket client with change listeners

## Core Components

- **UserDO**: Extend this class to add your business logic
- **createUserDOWorker()**: Creates a Hono server with auth endpoints
- **createWebSocketHandler()**: Handles WebSocket upgrades separately
- **UserDOClient**: Browser client for API calls and real-time subscriptions

## Quick Start

### 1. Define Your Schema

```ts
import { UserDO, type Env, type Table } from "userdo";
import { z } from "zod";

const PostSchema = z.object({
  title: z.string(),
  content: z.string(),
  createdAt: z.string(),
});

type Post = z.infer<typeof PostSchema>;
```

### 2. Extend UserDO

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
}
```

### 3. Create Your Worker

```ts
import { createUserDOWorker, createWebSocketHandler, getUserDOFromContext } from 'userdo';

// Create worker with custom binding name
const app = createUserDOWorker('MY_APP_DO');
const wsHandler = createWebSocketHandler('MY_APP_DO');

// Add custom routes
app.post('/api/posts', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  
  const { title, content } = await c.req.json();
  const myAppDO = getUserDOFromContext(c, user.email, 'MY_APP_DO') as MyAppDO;
  const post = await myAppDO.createPost(title, content);
  
  return c.json({ post });
});

// Export worker with WebSocket support
export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    if (request.headers.get('upgrade') === 'websocket') {
      return wsHandler.fetch(request, env, ctx);
    }
    return app.fetch(request, env, ctx);
  }
};
```

## Built-in API Endpoints

### Authentication
- `POST /api/signup` - Create user account
- `POST /api/login` - Authenticate user
- `POST /api/logout` - End user session
- `GET /api/me` - Get current user info

### Password Reset
- `POST /api/password-reset/request` - Generate reset token
- `POST /api/password-reset/confirm` - Reset password with token

### Data Operations
- `GET /data` - Get user's key-value data
- `POST /data` - Set user's key-value data

### Real-time
- `GET /api/ws` - WebSocket connection for live updates

## Browser Client

```ts
import { UserDOClient } from 'userdo';

const client = new UserDOClient('/api');

// Authentication
await client.signup('user@example.com', 'password');
await client.login('user@example.com', 'password');

// Key-value operations
await client.set('preferences', { theme: 'dark' });
const prefs = await client.get('preferences');

// Watch for changes
const unsubscribe = client.onChange('preferences', data => {
  console.log('Preferences updated:', data);
});

// Collections (if you have custom endpoints)
const posts = client.collection('posts');
await posts.create({ title: 'Hello', content: 'World' });
```

## Database Operations

### Table Creation
```ts
// In your UserDO constructor
this.posts = this.table('posts', PostSchema, { userScoped: true });
```

### CRUD Operations
```ts
// Create
const post = await this.posts.create({ title, content, createdAt });

// Read
const post = await this.posts.findById(id);
const posts = await this.posts.get();

// Update
const updated = await this.posts.update(id, { title: 'New Title' });

// Delete
await this.posts.delete(id);
```

### Queries
```ts
// Filter and sort
const posts = await this.posts
  .where('title', '==', 'Hello')
  .orderBy('createdAt', 'desc')
  .limit(10)
  .get();

// Count
const count = await this.posts.count();
```

## Real-time Events

Data changes automatically broadcast WebSocket events:

- `kv:{key}` - When key-value data changes
- `table:{tableName}` - When table data changes (create/update/delete)

```ts
// Listen for specific events
client.onChange('preferences', data => console.log('Prefs changed:', data));

// Listen for table changes
const posts = client.collection('posts');
posts.onChange(data => console.log('Post changed:', data));
```

## Multiple Projects

Use different binding names to isolate projects:

```ts
// Project 1: Blog
const blogWorker = createUserDOWorker('BLOG_DO');

// Project 2: Shop
const shopWorker = createUserDOWorker('SHOP_DO');

// Default binding
const defaultWorker = createUserDOWorker(); // Uses 'USERDO'
```

## Configuration

### wrangler.jsonc
```jsonc
{
  "main": "src/index.ts",
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

### Environment Variables
- `JWT_SECRET` (required) - Secret for signing JWT tokens

## Authentication Methods

```ts
// All methods return { user, token, refreshToken }
await userDO.signup({ email, password });
await userDO.login({ email, password });

// Token operations
await userDO.verifyToken({ token });
await userDO.refreshToken({ refreshToken });

// Password management
await userDO.changePassword({ oldPassword, newPassword });
await userDO.resetPassword({ newPassword });

// Session management
await userDO.logout();
```

## Type Safety

All endpoints are typed with TypeScript and validated with Zod:

```ts
import type { UserDOEndpoints, EndpointRequest, EndpointResponse } from 'userdo';

type SignupRequest = EndpointRequest<'POST /api/signup'>;
type SignupResponse = EndpointResponse<'POST /api/signup'>;
```

## Installation

```bash
npm install userdo
```

## Examples

Complete working examples:
- [`examples/hono`](examples/hono) - Full-featured Hono integration
- [`examples/alchemy`](examples/alchemy) - Alchemy.run deployment
- [`examples/effect`](examples/effect) - Effect library integration
- [`examples/multi-tenant`](examples/multi-tenant) - Multi-tenant patterns

## Architecture

- **Per-user isolation**: Each user gets their own Durable Object instance
- **Email-based routing**: User emails are hashed to generate Durable Object IDs
- **WebSocket hibernation**: Uses Cloudflare's hibernation API for efficient WebSocket handling
- **Type-safe schemas**: Zod validation for all data operations
- **Automatic broadcasting**: Real-time events for all data changes

## Security

- PBKDF2 password hashing with WebCrypto
- JWT tokens with configurable expiration
- HTTP-only cookies for token storage
- Per-user data isolation by default
- Rate limiting on authentication endpoints

## Limitations

- Requires Cloudflare Workers environment
- SQLite storage is per-Durable Object instance
- WebSocket connections are limited by Durable Object hibernation limits
- No built-in admin interface
- Cannot be self-hosted (requires Cloudflare infrastructure)

## Recent Updates

- ✅ WebSocket hibernation API support
- ✅ Configurable Durable Object binding names
- ✅ Auto-reconnecting browser client
- ✅ Real-time change listeners for KV and tables
- ✅ Separate WebSocket handler to avoid Hono serialization issues
