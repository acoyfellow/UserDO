# UserDO

A Durable Object base class for building applications on Cloudflare Workers.

## Philosophy: Simple > Clever

UserDO follows pragmatic coding principles:

- Working simple code > theoretically "better" complex code
- Every line is a liability - more code = more bugs
- Don't fix what isn't broken - if it works reliably, resist refactoring
- Ship then polish - working imperfect code > perfect unshipped code

## What You Get

- Authentication: JWT-based auth with signup, login, password reset
- Organizations: Multi-user teams with roles and member management  
- Database: Type-safe SQLite tables with Zod schemas and query builder
- Key-Value Storage: Per-user KV storage with automatic broadcasting
- Real-time: WebSocket connections with hibernation API support
- Web Server: Pre-built Hono server with all endpoints configured

## Quick Start

### 1. Extend UserDO with Your Business Logic

```ts
import { UserDO, type Env } from "userdo";
import { z } from "zod";

const PostSchema = z.object({
  title: z.string(),
  content: z.string(),
});

export class BlogDO extends UserDO {
  posts: any;

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    this.posts = this.table('posts', PostSchema, { userScoped: true });
  }

  async createPost(title: string, content: string) {
    return await this.posts.create({ title, content });
  }

  async getPosts() {
    return await this.posts.orderBy('createdAt', 'desc').get();
  }
}
```

### 2. Create Your Worker

```ts
import { createUserDOWorker, createWebSocketHandler } from 'userdo';

const app = createUserDOWorker('BLOG_DO');
const wsHandler = createWebSocketHandler('BLOG_DO');

// Add your business endpoints
app.post('/api/posts', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  
  const { title, content } = await c.req.json();
  const blogDO = getUserDOFromContext(c, user.email, 'BLOG_DO') as BlogDO;
  const post = await blogDO.createPost(title, content);
  
  return c.json({ post });
});

// Export with WebSocket support
export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    if (request.headers.get('upgrade') === 'websocket') {
      return wsHandler.fetch(request, env, ctx);
    }
    return app.fetch(request, env, ctx);
  }
};
```

### 3. Configure wrangler.jsonc

```jsonc
{
  "main": "src/index.ts",
  "vars": {
    "JWT_SECRET": "your-jwt-secret-here"
  },
  "durable_objects": {
    "bindings": [
      { "name": "BLOG_DO", "class_name": "BlogDO" }
    ]
  }
}
```

## Built-in API Endpoints

These endpoints work without additional configuration:

### Authentication
- `POST /api/signup` - Create user account
- `POST /api/login` - Authenticate user  
- `POST /api/logout` - End session
- `GET /api/me` - Get current user

### Organizations (Multi-user Teams)
- `POST /api/organizations` - Create organization
- `GET /api/organizations` - Get owned organizations
- `GET /api/organizations/:id` - Get specific organization
- `POST /api/organizations/:id/members` - Add member (auto-invites)
- `DELETE /api/organizations/:id/members/:userId` - Remove member

### Data Storage
- `GET /data` - Get user's key-value data
- `POST /data` - Set user's key-value data

### Real-time
- `GET /api/ws` - WebSocket connection for live updates

## Organization-Scoped Applications

UserDO handles multi-user team applications:

```ts
export class TeamDO extends UserDO {
  projects: any;
  tasks: any;

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    
    // Data automatically isolated per organization
    this.projects = this.table('projects', ProjectSchema, { organizationScoped: true });
    this.tasks = this.table('tasks', TaskSchema, { organizationScoped: true });
  }

  async createProject(name: string, organizationId: string) {
    await this.getOrganization(organizationId); // Built-in access control
    this.setOrganizationContext(organizationId); // Switch data scope
    return await this.projects.create({ name }); // Auto-scoped to org
  }
}

// Member management:
await teamDO.addOrganizationMember(orgId, 'user@example.com', 'admin');
// Stores invitation in target user's UserDO

const { memberOrganizations } = await userDO.getOrganizations();  
// Returns all invitations/memberships for this user
```

## Examples

### [Organizations](examples/organizations/) 
Complete team project management system - Organizations → Projects → Tasks with member management, role-based access control, and real-time collaboration.

### [Hono Integration](examples/hono/)
Full-featured web application - Complete auth flows, data management, WebSocket integration, and browser client usage patterns.

### [Alchemy Deployment](examples/alchemy/)
Production deployment - Ready-to-deploy configuration for Alchemy.run with environment setup and scaling considerations.

### [Effect Integration](examples/effect/)
Functional programming - Integration with Effect library for advanced error handling and functional composition patterns.

### [Multi-tenant](examples/multi-tenant/)
Multiple isolated projects - How to run multiple independent applications using different UserDO binding names.

## Browser Client

```ts
import { UserDOClient } from 'userdo';

const client = new UserDOClient('/api');

// Authentication
await client.signup('user@example.com', 'password');
await client.login('user@example.com', 'password');

// Real-time data
client.onChange('preferences', data => {
  console.log('Preferences updated:', data);
});

// Organizations
const orgs = await client.get('/organizations');
```

## Database Operations

### Simple Tables
```ts
// User-scoped data (private to each user)
this.posts = this.table('posts', PostSchema, { userScoped: true });

// Organization-scoped data (shared within teams)  
this.projects = this.table('projects', ProjectSchema, { organizationScoped: true });
```

### CRUD Operations
```ts
// Create
const post = await this.posts.create({ title, content });

// Read
const posts = await this.posts.orderBy('createdAt', 'desc').get();
const post = await this.posts.findById(id);

// Update  
await this.posts.update(id, { title: 'New Title' });

// Delete
await this.posts.delete(id);

// Query
const results = await this.posts
  .where('title', '==', 'Hello')
  .limit(10)
  .get();
```

## Real-time Events

Data changes automatically broadcast WebSocket events:

```ts
// Listen for specific data changes
client.onChange('preferences', data => console.log('Updated:', data));

// Listen for table changes  
client.onChange('table:posts', event => {
  console.log('Post changed:', event.type, event.data);
});
```

## Decision Framework

Before adding complexity, ask:

1. Is there a measurable problem? (Not theoretical)
2. Is the current solution causing actual pain? (Check metrics)  
3. What's the cost/benefit? (Time investment vs improvement)

### Red Flags
- Refactoring for hypothetical benefits
- Adding patterns without clear current needs
- Replacing working code with more complex solutions
- "The framework docs recommend..." (without context)

### Valid Reasons
- Reproducible bugs affecting users
- Measured performance bottlenecks  
- Blocking required features
- Security vulnerabilities

## Architecture

- Per-user isolation: Each user gets their own Durable Object instance
- Email-based routing: User emails determine Durable Object IDs  
- WebSocket hibernation: Uses Cloudflare's hibernation API for WebSocket handling
- Type-safe schemas: Zod validation for all operations
- Automatic broadcasting: Real-time events for all data changes

## Installation

```bash
npm install userdo
```

## Pragmatic Mantras

- "The perfect is the enemy of the good"
- "You ain't gonna need it" (YAGNI)  
- "Leave it better than you found it" (but only if it's actually better)
- "Working simple code beats theoretically better complex code"

UserDO: A base class for building applications without unnecessary complexity.
