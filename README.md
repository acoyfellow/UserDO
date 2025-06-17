# UserDO

A Durable Object base class that provides user authentication, per-user data storage, and real-time updates for Cloudflare Workers applications.

## What it provides

- User authentication with JWT tokens
- Per-user SQLite tables with type-safe schemas
- Per-user key-value storage
- Real-time data synchronization via Server-Sent Events
- HTTP endpoints for authentication and data operations
- Browser client for frontend integration

## Core components

**UserDO class**: Extend this to add your application logic
**Worker**: Pre-built Hono server with authentication endpoints
**Client**: Browser library for API calls and real-time subscriptions
**Database**: Type-safe tables with query builder

## Basic usage

```ts
import { UserDO } from "userdo";
import { z } from "zod";

const PostSchema = z.object({
  title: z.string(),
  content: z.string(),
  createdAt: z.string(),
});

export class MyAppDO extends UserDO {
  posts = this.table('posts', PostSchema, { userScoped: true });

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

## Using the built-in worker

```ts
// Use as-is
import { userDOWorker } from 'userdo/worker';
export default userDOWorker;

// Or extend with your routes
import { userDOWorker, getUserDO } from 'userdo/worker';

userDOWorker.post('/api/posts', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  
  const { title, content } = await c.req.json();
  const myAppDO = getUserDO(c, user.email) as MyAppDO;
  const post = await myAppDO.createPost(title, content);
  
  return c.json({ post });
});

export default userDOWorker;
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
- `GET /api/events` - Server-sent events for real-time updates

## Browser client

```ts
import { UserDOClient } from 'userdo/client';

const client = new UserDOClient('/api');

// Authentication
await client.signup('user@example.com', 'password');
await client.login('user@example.com', 'password');

// Data operations
const posts = client.collection('posts');
await posts.create({ title: 'Hello', content: 'World' });
const list = await posts.query().orderBy('createdAt', 'desc').get();

// Real-time updates
client.on('table:posts:create', data => console.log('New post:', data));
client.connectRealtime();
```

## Installation

```bash
npm install userdo
```

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
        "name": "USERDO",
        "class_name": "UserDO"
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
// Create table
const posts = this.table('posts', PostSchema, { userScoped: true });

// CRUD operations
await posts.create(data);
await posts.findById(id);
await posts.update(id, updates);
await posts.delete(id);

// Queries
await posts.where('status', '==', 'published').get();
await posts.orderBy('createdAt', 'desc').limit(10).get();
await posts.count();
```

## Key-value storage

```ts
// Store data
await userDO.set('preferences', { theme: 'dark', language: 'en' });

// Retrieve data
const preferences = await userDO.get('preferences');
```

## Real-time events

The system broadcasts events when data changes occur. Events are delivered via Server-Sent Events to connected clients.

```ts
// Listen for events in browser
client.on('table:posts:create', data => {
  // Handle new post creation
});

// Connect to event stream
client.connectRealtime();
```

## Type safety

All endpoints are fully typed with TypeScript and validated with Zod schemas.

```ts
import type { UserDOEndpoints, EndpointRequest, EndpointResponse } from 'userdo/worker';

type SignupRequest = EndpointRequest<'POST /api/signup'>;
type SignupResponse = EndpointResponse<'POST /api/signup'>;
```

## Examples

See the `examples/` directory for complete implementations:
- `examples/hono` - Full Hono integration
- `examples/alchemy` - Alchemy.run deployment
- `examples/effect` - Effect library integration

## Security features

- Email addresses are hashed for Durable Object IDs
- Passwords use PBKDF2 with WebCrypto
- JWT tokens with configurable expiration
- Rate limiting on authentication endpoints
- User data isolation by default

## Limitations

- Requires Cloudflare Workers environment
- SQLite storage is per-Durable Object instance
- Real-time events use polling, not WebSockets
- No built-in user management interface


TODO:
- event system cleanup
- client cleanup
- websocket system?