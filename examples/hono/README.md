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

- **Authentication**: Login, signup, logout, token refresh (inherited from UserDO)
- **Data Storage**: Generic key-value storage using UserDO's `get()`/`set()` methods  
- **Custom Business Logic**: 
  - Posts management (create, list)
  - User preferences (theme, language)
- **Full Web App**: Complete HTML interface with forms and styling

## Files

- `index.tsx` - Main Hono app with extended UserDO class
- `wrangler.jsonc` - Configuration showing single DO binding
- `package.json` - Dependencies

## Running This Example

1. **Install dependencies**:
   ```bash
   bun install
   ```

2. **Set your JWT secret**:
   ```bash
   wrangler secret put JWT_SECRET
   # Enter a strong random secret (32+ characters)
   ```

3. **Run locally**:
   ```bash
   bun run dev
   ```

4. **Deploy**:
   ```bash
   bun run deploy
   ```

## Key Features Demonstrated

### 🔐 Authentication (Inherited)
- User signup/login/logout
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