# Vue + Vite + UserDO Example

A full-stack task management application built with Vue, Vite, and UserDO on Cloudflare Workers. This example demonstrates how to build a modern web application with authentication, real-time updates, and persistent storage using UserDO's Durable Objects.

## 🏗️ Architecture

This example includes:

- **Frontend**: Vue app with Vite for fast development and hot reload
- **Backend**: Cloudflare Worker with UserDO for authentication and data storage
- **Database**: UserDO's built-in table storage for tasks
- **Real-time**: WebSocket connections for live updates
- **Authentication**: Built-in UserDO auth with JWT tokens

## 📁 Project Structure

```
examples/vue-vite/
├── src/
│   ├── vue-app/           # Vue frontend code
│   │   └── App.vue          # Main Vue component
│   └── worker/              # Cloudflare Worker backend
│       └── index.ts         # Worker with TaskAppDO class
├── wrangler.jsonc           # Cloudflare Worker configuration
├── package.json             # Dependencies and scripts
├── vite.config.ts           # Vite configuration with Cloudflare plugin
└── README.md               # This file
```

## 🚀 Quick Start

### Prerequisites

- Node.js 22+ or Bun
- Cloudflare account (for deployment)

### 1. Install Dependencies

```bash
# From the examples/vue-vite directory
npm install
# or
bun install
```

### 2. Set Environment Variables

The example requires a JWT secret for authentication. Add this to your `wrangler.jsonc`:

```jsonc
{
  // ... other config
  "vars": {
    "JWT_SECRET": "your-super-secret-jwt-key-here"
  }
}
```

### 3. Development Setup

**Important**: You need to run both Vite (frontend) and Wrangler (backend) simultaneously during development.

#### Option A: Two Terminal Windows (Recommended)

Terminal 1 - Start the Cloudflare Worker:
```bash
npx wrangler dev --port 8787
```

Terminal 2 - Start the Vue dev server:
```bash
npm run dev
# or
bun run dev
```

#### Option B: Single Command (if supported)

```bash
npm run dev
```

*Note: The Cloudflare Vite plugin should automatically start both servers, but if you need to see Wrangler logs or troubleshoot Worker issues, use Option A.*

### 4. Access the Application

- **Frontend**: http://localhost:5173 (Vite dev server)
- **Backend API**: http://localhost:8787 (Wrangler dev server)

The Vue app automatically connects to the Worker API running on port 8787.

## 🔧 Key Implementation Details

### UserDO Integration

The example uses UserDO's CDN bundle to avoid Cloudflare Workers import conflicts:

```typescript
// Loads UserDOClient from CDN instead of npm import
const script = document.createElement('script');
script.src = 'https://unpkg.com/userdo@latest/dist/src/client.bundle.js';
```

### TaskAppDO Class

The Worker extends UserDO to create a task management system:

```typescript
export class TaskAppDO extends UserDO {
  // Zod schema for task validation
  private taskSchema = z.object({
    title: z.string().min(1),
    description: z.string(),
    completed: z.boolean(),
    createdAt: z.string().optional(), // Optional for updates
  });

  // User-scoped table for tasks
  private tasks = this.table('tasks', this.taskSchema);

  // CRUD operations for tasks
  async createTask(title: string, description: string) { /* ... */ }
  async getTasks() { /* ... */ }
  async updateTask(id: string, updates: any) { /* ... */ }
  async deleteTask(id: string) { /* ... */ }
}
```

### Authentication Flow

1. User enters email/password
2. Frontend calls UserDO's `login()` or `signup()` methods
3. UserDO handles JWT token creation/validation
4. Authenticated requests include the token automatically
5. Worker validates tokens and provides user-scoped data access

## 🛠️ Development Tips

### Vite + Wrangler Integration

The `@cloudflare/vite-plugin` handles the integration between Vite and Wrangler:

```typescript
// vite.config.ts
export default defineConfig({
  plugins: [
    vue(),
    cloudflare({
      persist: { path: '.wrangler/state/v3' }
    })
  ]
});
```

### Common Issues & Solutions

#### 1. "Failed to resolve import 'cloudflare:workers'"
- **Cause**: Direct imports of Cloudflare Workers modules in frontend code
- **Solution**: Use the CDN approach for UserDOClient as shown in the example

#### 2. "crypto.hash is not a function"
- **Cause**: Vite version compatibility issues
- **Solution**: Ensure you're using a compatible Vite version (6.x or 7.x+)

#### 3. "secret must be a string" Error
- **Cause**: Missing JWT_SECRET environment variable
- **Solution**: Add JWT_SECRET to your `wrangler.jsonc` vars section

#### 4. ZodError on Task Updates
- **Cause**: Passing full objects to UserDO table updates instead of just changed fields
- **Solution**: Only pass the fields being updated, not the entire object

#### 5. Wrangler Shows "[not connected]"
- **Normal**: This is expected for single Worker instances during development

### Hot Reload Behavior

- **Vue changes**: Hot reload via Vite (instant)
- **Worker changes**: Requires Wrangler restart (few seconds)
- **Config changes**: Requires both servers restart

## 📦 Dependencies

### Key Dependencies

- `userdo`: The UserDO package for Durable Objects
- `hono`: Web framework (used by UserDO)
- `zod`: Schema validation
- `@cloudflare/workers-types`: TypeScript types for Workers
- `@cloudflare/vite-plugin`: Vite integration for Cloudflare

### Development Dependencies

- `vite`: Fast build tool and dev server
- `@vitejs/plugin-vue`: Vue support for Vite
- `tailwindcss`: Styling framework
- `wrangler`: Cloudflare Workers CLI

## 🚀 Deployment

### Deploy to Cloudflare

```bash
# Deploy the Worker
npx wrangler deploy

# Build and deploy frontend (to Cloudflare Pages or your preferred host)
npm run build
```

### Environment Variables for Production

Make sure to set your production JWT_SECRET:

```bash
npx wrangler secret put JWT_SECRET
```

## 🎯 Features Demonstrated

- ✅ User authentication (signup/login)
- ✅ CRUD operations with UserDO tables
- ✅ Real-time updates via WebSockets
- ✅ Modern Vue with Composition API and TypeScript
- ✅ Responsive UI with Tailwind CSS
- ✅ Form validation and error handling
- ✅ Loading states and user feedback
- ✅ Proper state management

## 🤝 Contributing

This example is part of the UserDO project. Feel free to:

1. Report issues or bugs
2. Suggest improvements
3. Submit pull requests
4. Ask questions in discussions

## 📄 License

This example follows the same license as the UserDO project.
