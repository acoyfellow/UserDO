# UserDO

A Durable Object base class for building applications on Cloudflare Workers.



## What You Get

- Authentication: Email based (JWT) auth with signup, login, password reset
- Key-Value Storage: Per-user KV storage with automatic broadcasting
- Database: Type-safe SQLite tables with Zod schemas and query builder
- Web Server: Pre-built Hono server with all endpoints configured
- Real-time: WebSocket connections with hibernation API support
- Organizations: Multi-user teams with roles and member management  

## Installation

```bash
bun install userdo
```

## Quick Start

### 1. Create Your Durable Object (Your Database + Logic)

A Durable Object is like a mini-server that lives on Cloudflare's edge. Each user gets their own instance with their own database. You extend `UserDO` to add your business logic:

```ts
import { UserDO, type Env } from "userdo";
import { z } from "zod";

// Define your data schema
const PostSchema = z.object({
  title: z.string(),
  content: z.string(),
});

// This is your Durable Object - each user gets one instance
export class BlogDO extends UserDO {
  posts: any;

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    // Create a table that's private to this user
    this.posts = this.table('posts', PostSchema, { userScoped: true });
  }

  // Add your business methods
  async createPost(title: string, content: string) {
    return await this.posts.create({ title, content });
  }

  async getPosts() {
    return await this.posts.orderBy('createdAt', 'desc').get();
  }
}
```

### 2. Create Your Worker (Your HTTP Gateway)

The Worker handles HTTP requests and routes them to the right user's Durable Object. It comes with built-in auth endpoints and you add your own:

```ts
import { createUserDOWorker, createWebSocketHandler } from 'userdo';

// Create the HTTP server with built-in auth endpoints
const app = createUserDOWorker('BLOG_DO');
const wsHandler = createWebSocketHandler('BLOG_DO');

// Add your custom endpoints
app.post('/api/posts', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  
  const { title, content } = await c.req.json();
  
  // Get this user's Durable Object instance
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

**Built-in HTTP endpoints** (no code needed):
- `POST /api/signup` - Create account
- `POST /api/login` - Sign in  
- `GET /api/me` - Get current user
- `GET /api/ws` - WebSocket connection
- [See all endpoints](#built-in-api-endpoints)

### 3. Configure wrangler.jsonc

```jsonc
{
  "main": "src/index.ts",
  "compatibility_flags": ["nodejs_compat"],
  "vars": {
    "JWT_SECRET": "your-jwt-secret-here"
  },
  "durable_objects": {
    "bindings": [
      { "name": "BLOG_DO", "class_name": "BlogDO" }
    ]
  },
  "migrations": [
    {
      "tag": "v1",
      "new_sqlite_classes": ["BlogDO"]
    }
  ]
}
```

**Important**: The `migrations` section with `new_sqlite_classes` is required to enable SQL database functionality. Without it, you'll get errors about SQL not being enabled.

### 4. Build Your Frontend

UserDO provides the backend API - you bring your own frontend (React, Vue, vanilla JS, etc.). Check out our [examples](examples/) for complete applications with frontend code.

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

### [React + Vite](examples/react-vite/)
Modern React application with Vite - Full-stack task management app with authentication, real-time updates, and beautiful Tailwind UI. Shows proper Vite/Wrangler development workflow.

### [Vue + Vite](examples/vue-vite/)
Modern Vue application with Vite - Task management app showing the same features as the React example.


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



## Architecture

- Per-user isolation: Each user gets their own Durable Object instance
- Email-based routing: User emails determine Durable Object IDs  
- WebSocket hibernation: Uses Cloudflare's hibernation API for WebSocket handling
- Type-safe schemas: Zod validation for all operations
- Automatic broadcasting: Real-time events for all data changes

## Getting Started

Ready to build? Check out the [examples](examples/) directory for complete applications, or start with the quick start guide above.

For questions and support, open an issue on GitHub.
