# UserDO Hono Example

This example shows how to extend UserDO with custom business logic using the modern approach.

## Key Features

- **Extends the base worker**: Uses `userDOWorker` as the foundation
- **Custom Durable Object**: Extends `UserDO` with business-specific methods
- **Type-safe tables**: Uses Zod schemas for data validation
- **Real-time events**: Automatic broadcasting of table operations
- **Modern UI**: Clean, responsive interface

## How it works

### 1. Define your schemas

```ts
const PostSchema = z.object({
  title: z.string(),
  content: z.string(),
  createdAt: z.string(),
});

const PreferencesSchema = z.object({
  theme: z.enum(['light', 'dark']),
  language: z.enum(['en', 'es', 'fr']),
});
```

### 2. Extend UserDO

```ts
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

  async updateUserPreferences(preferences: z.infer<typeof PreferencesSchema>) {
    await this.set('preferences', preferences);
    return { ok: true };
  }
}
```

### 3. Use the configurable worker factory

```ts
import { createUserDOWorker, getUserDOFromContext } from 'userdo'

// Create worker with your custom binding name
const userDOWorker = createUserDOWorker('MY_APP_DO');

// Helper to get your extended DO
const getMyAppDO = (c: any, email: string) => {
  return getUserDOFromContext(c, email, 'MY_APP_DO') as MyAppDO;
}

// Add your custom endpoints
app.post('/api/posts', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  
  const { title, content } = await c.req.json();
  const myAppDO = getMyAppDO(c, user.email);
  const post = await myAppDO.createPost(title, content);
  
  return c.json({ ok: true, post });
});
```

## What you get

### Built-in endpoints (from userDOWorker)
- `POST /api/signup` - Create user account
- `POST /api/login` - Authenticate user  
- `POST /api/logout` - End user session
- `GET /api/me` - Get current user info
- `POST /api/password-reset/request` - Generate reset token
- `POST /api/password-reset/confirm` - Reset password with token
- `GET /data` - Get user's key-value data
- `POST /data` - Set user's key-value data
- `GET /api/events` - Real-time events for data changes

### Custom endpoints (added by this example)
- `GET /api/posts` - List user's posts
- `POST /api/posts` - Create a new post
- `PUT /api/posts/:id` - Update a post
- `DELETE /api/posts/:id` - Delete a post
- `GET /api/preferences` - Get user preferences
- `POST /api/preferences` - Update user preferences

## Database operations

The example demonstrates both table operations and key-value storage:

### Table operations (with automatic events)
```ts
// Create
const post = await this.posts.create({ title, content, createdAt });
// → Broadcasts: table:posts:create

// Update  
const updated = await this.posts.update(id, { title, content });
// → Broadcasts: table:posts:update

// Delete
await this.posts.delete(id);
// → Broadcasts: table:posts:delete

// Query
const posts = await this.posts.orderBy('createdAt', 'desc').get();
```

### Key-value storage (with automatic events)
```ts
// Set
await this.set('preferences', { theme: 'dark', language: 'en' });
// → Broadcasts: kv:set

// Get
const preferences = await this.get('preferences');
```

## Real-time events

All data operations automatically broadcast events that can be consumed by connected clients:

- `table:posts:create` - When a post is created
- `table:posts:update` - When a post is updated  
- `table:posts:delete` - When a post is deleted
- `kv:set` - When key-value data is stored

## Running the example

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Deploy to Cloudflare
npm run deploy
```

## Configuration

Update `wrangler.jsonc` with your settings:

```jsonc
{
  "name": "userdo-hono-example",
  "main": "index.tsx",
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

## Architecture benefits

- **Minimal boilerplate**: Start with full auth system
- **Type safety**: Zod schemas ensure data integrity
- **Real-time ready**: Automatic event broadcasting
- **Scalable**: Per-user data isolation via Durable Objects
- **Extensible**: Add your business logic without touching core auth

## Files

- `index.tsx` - Main Hono app with extended UserDO class
- `wrangler.example.jsonc` - Example configuration template (safe for version control)
- `wrangler.jsonc` - Your local configuration (gitignored, created from example)
- `package.json` - Dependencies
- `tsconfig.json` - TypeScript configuration

## 🚀 Quick Start (Copy-Paste Ready!)

### Prerequisites
- [Bun](https://bun.sh) or [Node.js](https://nodejs.org)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)
- Cloudflare account

### Step 1: Copy the Files
Copy this entire `examples/hono/` directory to your project:
```bash
# Copy the example
cp -r examples/hono my-userdo-app
cd my-userdo-app
```

### Step 2: Set Up Configuration
Create your local configuration file:
```bash
# Copy the example config (this file is gitignored for security)
cp wrangler.example.jsonc wrangler.jsonc
```

### Step 3: Install Dependencies
```bash
bun install
# or: npm install
```

### Step 4: Set Up JWT Secret

**For local development:**
Add a JWT secret to your `wrangler.jsonc` for local testing:
```jsonc
{
  // ... other config
  "vars": {
    "JWT_SECRET": "your-local-dev-secret-here"
  }
}
```

**For production deployment:**
```bash
# Set a secure JWT secret (never use the dev one in production!)
wrangler secret put JWT_SECRET
# When prompted, enter a secure random string
```

> **💡 Tip**: Use `openssl rand -base64 32` to generate a secure secret

### Step 5: Run Locally
```bash
bun run dev
# or: npm run dev
```

Visit `http://localhost:8787` to see your app!

### Step 6: Deploy (Optional)
```bash
bun run deploy
# or: npm run deploy
```

## 🛠️ Development Setup

If you want to modify and develop:

1. **TypeScript checking**:
   ```bash
   bun run type-check
   ```

2. **Local development with hot reload**:
   ```bash
   bun run dev
   ```

## 🔧 Configuration Options

### JWT Secret Management
- **For local dev**: Add `JWT_SECRET` to the `vars` section in your local `wrangler.jsonc`
- **For production**: Use `wrangler secret put JWT_SECRET` (never commit secrets to git!)

### Binding Architecture
This example uses a separate Durable Object binding (`MY_APP_DO`) instead of the default `USERDO` binding. This allows you to:
- Deploy this example alongside the main UserDO library without conflicts
- Have completely isolated data storage per application
- Use different DO class implementations (`MyAppDO` vs `UserDO`)

### Customizing the App
- Modify `MyAppDO` class in `index.tsx` to add your business logic
- Update your local `wrangler.jsonc` to change the app name and configuration
- Customize the HTML/CSS in the route handlers

## Key Features Demonstrated

### 🔐 Authentication (Inherited)
- User signup/login/logout (clears refresh tokens)
- JWT token management with refresh tokens
- Protected routes with middleware

### 🗄️ Data Storage (Inherited)
- Per-user key-value storage
- Secure, isolated data per user
- No reserved key conflicts

### 🗃️ Database Tables (New)
- Posts stored in a D1-backed table
- Query with `where()` and `orderBy()` helpers

### 🧬 Custom Logic (Extended)
- Post creation and management
- User preferences system
- Your own business methods

### 🎨 UI/UX
- Clean, responsive design
- Form handling and validation
- Real-time data display

## Extending Further

Add your own methods to `MyAppDO`:

```ts
export class MyAppDO extends UserDO {
  async createTodo(title: string, completed = false) {
    const todos = await this.get('todos') || [];
    const newTodo = { id: Date.now(), title, completed };
    todos.push(newTodo);
    await this.set('todos', todos);
    return newTodo;
  }

  async updateTodo(id: number, updates: Partial<Todo>) {
    const todos = await this.get('todos') || [];
    const index = todos.findIndex(todo => todo.id === id);
    if (index !== -1) {
      todos[index] = { ...todos[index], ...updates };
      await this.set('todos', todos);
    }
    return todos[index];
  }
}
```

Then add routes in your Hono app to expose these methods via HTTP endpoints.

## Why This Pattern?

- **Simpler setup**: One DO binding instead of two
- **Better cohesion**: Auth and business logic together
- **Easier development**: No coordination between separate DOs
- **Less complexity**: Single source of truth per user
- **More intuitive**: Natural inheritance pattern 

## ⚡️ Security Best Practices

### Configuration Files
- `wrangler.example.jsonc` - Safe template (committed to git)
- `wrangler.jsonc` - Your local config (gitignored, never committed)

### JWT Secret Management

**For local development:**
```jsonc
// In your local wrangler.jsonc
{
  "vars": {
    "JWT_SECRET": "your-local-dev-secret-here"
  }
}
```

**For production deployment:**
```bash
# Set production secret (more secure than vars)
wrangler secret put JWT_SECRET
# Then deploy without JWT_SECRET in vars
wrangler deploy
```

> **Important**: Never commit real secrets to version control!

### Deployment Workflow
1. **Local dev**: Use `vars` in your local `wrangler.jsonc`
2. **Production**: Use `wrangler secret put` and remove from `vars`
3. **Open source safe**: Only `wrangler.example.jsonc` is in git

---

## Security Notice

- This example uses a secure configuration approach suitable for open source projects
- The `wrangler.jsonc` file is gitignored and never committed
- Always use `wrangler secret put JWT_SECRET` for production deployments
- Never use development secrets in production environments 