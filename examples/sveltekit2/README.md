# UserDO + SvelteKit Example

A complete full-stack blog application demonstrating UserDO integration with SvelteKit.

## What This Example Shows

- **Authentication**: User signup, login, logout using UserDO
- **Per-user Data**: Each user has their own isolated blog posts
- **Real-time Updates**: WebSocket connections for live data changes
- **Type-safe Database**: SQLite tables with Zod schema validation
- **Local Development**: Both processes running locally with shared persistence

## Features Demonstrated

- ✅ UserDO authentication system
- ✅ Custom business logic (blog posts)
- ✅ SvelteKit frontend with UserDOClient
- ✅ Real-time WebSocket updates
- ✅ Per-user data isolation
- ✅ Type-safe schemas with Zod

## Architecture

```
SvelteKit App (port 5173) ──HTTP/WS──> UserDO Worker (port 8787)
                                              │
                                              ├── Authentication (JWT)
                                              ├── Per-user SQLite Tables
                                              ├── WebSocket Hibernation
                                              └── Real-time Broadcasting
```

## Running the Example

```bash
# Install dependencies
npm install

# Start both DO worker and SvelteKit app
node dev.mjs
```

This starts:
- **UserDO Worker** on `http://localhost:8787` (with auth + blog APIs)
- **SvelteKit App** on `http://localhost:5173` (frontend)

## Try It Out

1. **Sign Up**: Create a new account with email/password
2. **Create Posts**: Add blog posts (stored per-user in SQLite)
3. **Real-time**: Open multiple browser tabs to see live updates
4. **Authentication**: Login/logout, data persists per user

## Key Files

### DO Worker (`do-worker/`)
- `src/index.ts` - UserDO extension with blog logic
- `wrangler.toml` - Worker configuration with JWT_SECRET
- `package.json` - Dependencies (userdo, zod)

### SvelteKit App (`sveltekit-app/`)
- `src/routes/+page.svelte` - Complete blog UI with auth
- `package.json` - Dependencies (userdo for client)
- `wrangler.toml` - DO binding configuration

### Development
- `dev.mjs` - Starts both processes with shared persistence

## UserDO Features Used

```ts
// Custom UserDO class
export class BlogDO extends UserDO {
  posts: Table<Post>;
  
  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    this.posts = this.table('posts', PostSchema, { userScoped: true });
  }
}

// Pre-built worker with auth endpoints
const app = createUserDOWorker('BLOG_DO');

// Custom business logic routes
app.get('/api/posts', async (c) => {
  const user = c.get('user');
  const blogDO = getUserDOFromContext(c, user.email, 'BLOG_DO');
  return c.json({ posts: await blogDO.getPosts() });
});
```

## Client-Side Usage

```ts
// UserDOClient handles auth + API calls
const client = new UserDOClient('http://localhost:8787/api');

// Authentication
await client.signup(email, password);
await client.login(email, password);

// Real-time updates
client.onChange('posts', (data) => {
  console.log('Posts updated:', data);
});
```

## Production Deployment

For production, you would:
1. Deploy the DO worker to Cloudflare Workers
2. Deploy the SvelteKit app to Cloudflare Pages
3. Configure proper JWT_SECRET in production
4. Use direct DO bindings instead of HTTP calls

This example focuses on local development workflow and UserDO feature demonstration.