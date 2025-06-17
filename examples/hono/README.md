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

### 3. Use the base worker and add custom endpoints

```ts
import { userDOWorker, getUserDO } from 'userdo/worker'

// Start with the base worker (includes all auth endpoints)
const app = userDOWorker;

// Helper to get your extended DO
const getMyAppDO = (c: any, email: string) => {
  return getUserDO(c, email) as MyAppDO;
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
  "vars": {
    "JWT_SECRET": "your-jwt-secret-here"
  },
  "durable_objects": {
    "bindings": [
      {
        "name": "USERDO",
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
- `wrangler.jsonc` - Configuration showing single DO binding and D1 database
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

### Step 2: Install Dependencies
```bash
bun install
# or: npm install
```

### Step 3: Create a D1 Database
```bash
wrangler d1 create my_app_db
```
Update `wrangler.jsonc` with the generated database ID.

### Step 4: Set Up Authentication Secret
```bash
# Generate and set a secure JWT secret
wrangler secret put JWT_SECRET
# When prompted, enter a random 32+ character string
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
- **For local dev**: The example includes a placeholder in `wrangler.jsonc`
- **For production**: Remove the var and use `wrangler secret put JWT_SECRET`

### Customizing the App
- Modify `MyAppDO` class in `index.tsx` to add your business logic
- Update `wrangler.jsonc` to change the app name and configuration
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

## ⚡️ JWT_SECRET: Dev vs Production (TL;DR)

- **For local dev:**  
  Add to `wrangler.jsonc`:
  ```jsonc
  "vars": { "JWT_SECRET": "your-jwt-secret-here" }
  ```
- **For production:**  
  1. Remove the var and use `wrangler secret put JWT_SECRET`
  2. Deploy.

> **Note:**  
> You can't have both a var and a secret with the same name at once.

---

**Security:**  
- **For local development:**
  - Add `JWT_SECRET` to your `wrangler.jsonc` under `vars` for easy dev and copy-paste.
  - Example:
    ```jsonc
    "vars": {
      "JWT_SECRET": "your-jwt-secret-here"
    }
    ```
- **For production deployment:**
  1. **Remove** (or comment out) the `JWT_SECRET` line from your `wrangler.jsonc`.
  2. Set your real secret with:
     ```sh
     wrangler secret put JWT_SECRET
     ```
  3. Deploy as usual.

**You cannot have both a var and a secret with the same name at the same time.**

### Quick Switch Workflow
1. For dev: keep the var in your config.
2. Before prod deploy: remove the var, set the secret, then deploy.
3. After deploy: you can add the var back for local dev if needed.

---

## Security Notice (updated)

- The `wrangler.jsonc` file in this repo uses a placeholder JWT secret for demonstration and local development only.
- **Before deploying to production, you must remove the JWT_SECRET var from wrangler.jsonc and set it as a secret with `wrangler secret put JWT_SECRET`.**
- Never use the example secret in a real deployment.
- For live demos, secrets are rotated and demo data is periodically reset for security. 