# UserDO + Hono Example

This example demonstrates how to **extend UserDO** with your own business logic instead of using it as a separate binding.

## Key Concepts

### Before (Separate Binding - More Complex)
```ts
// ❌ Old way: separate bindings
const userDO = env.USERDO.get(env.USERDO.idFromName(email));
await userDO.signup({ email, password });

// Your app logic would need a separate DO
const appDO = env.APP_DO.get(env.APP_DO.idFromName(email));
```

### After (Extension - Simpler!)
```ts
// ✅ New way: extend UserDO
export class MyAppDO extends UserDO {
  // Add your custom methods here
  async createPost(title: string, content: string) {
    // Use inherited methods like this.get() and this.set()
    const posts = await this.get('posts') || [];
    posts.push({ title, content, createdAt: new Date() });
    await this.set('posts', posts);
  }
}

// One binding, all functionality
const myAppDO = env.MY_APP_DO.get(env.MY_APP_DO.idFromName(email));
await myAppDO.signup({ email, password }); // Inherited auth
await myAppDO.createPost(title, content);   // Your custom logic
```

## What This Example Shows

- **Authentication**: Login, signup, logout (clears refresh tokens), token refresh (inherited from UserDO)
- **Data Storage**: Generic key-value storage using UserDO's `get()`/`set()` methods  
- **Custom Business Logic**: 
  - Posts management (create, list)
  - User preferences (theme, language)
- **Full Web App**: Complete HTML interface with forms and styling

## Files

- `index.tsx` - Main Hono app with extended UserDO class
- `wrangler.jsonc` - Configuration showing single DO binding
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

### Step 3: Set Up Authentication Secret
```bash
# Generate and set a secure JWT secret
wrangler secret put JWT_SECRET
# When prompted, enter a random 32+ character string
```

> **💡 Tip**: Use `openssl rand -base64 32` to generate a secure secret

### Step 4: Run Locally
```bash
bun run dev
# or: npm run dev
```

Visit `http://localhost:8787` to see your app!

### Step 5: Deploy (Optional)
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
  1. Remove/comment out the `JWT_SECRET` line from `wrangler.jsonc`.
  2. Run:
     ```sh
     wrangler secret put JWT_SECRET
     ```
  3. Deploy.

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