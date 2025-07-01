# UserDO + TanStack Start Todo App

A modern, full-stack todo application showcasing **TanStack Start** with **TanStack Query**, ready for **UserDO** integration.

## 🚀 What You'll Learn

- **TanStack Start**: Type-safe, client-first, full-stack React framework
- **TanStack Query**: Powerful data synchronization with automatic caching
- **Server Functions**: API routes with file-based routing
- **Type Safety**: End-to-end TypeScript with Zod validation
- **UserDO Integration**: Ready for Cloudflare Workers deployment

## ✨ Features

- ✅ **Real-time Todo Management** - Add, toggle, and delete todos
- 🔄 **Optimistic UI Updates** - Instant feedback with automatic rollback on errors
- 🎯 **Type-Safe API** - Full TypeScript coverage from client to server
- 🎨 **Modern UI** - Beautiful interface with Tailwind CSS
- ⚡ **Fast Development** - Hot reload and instant updates
- 🌐 **Cloudflare Ready** - Optimized for Cloudflare Workers deployment

## 🛠️ Tech Stack

- **Frontend**: React 19 + TanStack Router + TanStack Query
- **Backend**: TanStack Start Server Functions
- **Styling**: Tailwind CSS
- **Validation**: Zod
- **Deployment**: Cloudflare Workers
- **Type Safety**: TypeScript throughout

## 🏃‍♂️ Quick Start

1. **Install dependencies**:
   ```bash
   bun install
   # or npm install
   ```

2. **Start development server**:
   ```bash
   bun dev
   # or npm run dev
   ```

3. **Open your browser** to `http://localhost:3000`

4. **Navigate to `/todos`** to see the todo app in action!

## 📁 Project Structure

```
examples/tanstack/
├── src/
│   ├── routes/
│   │   ├── __root.tsx          # Root layout with TanStack Query provider
│   │   ├── index.tsx           # Home page showcasing features
│   │   ├── todos.tsx           # Todo app page with TanStack Query
│   │   └── api/
│   │       ├── todos.ts        # GET /api/todos, POST /api/todos
│   │       └── todos.$todoId.ts # PUT/DELETE /api/todos/:id
│   ├── components/             # Reusable components
│   └── styles/                 # Tailwind CSS styles
├── vite.config.ts             # Vite config with cloudflare-module target
├── wrangler.jsonc             # Cloudflare Workers configuration
└── package.json               # Dependencies and scripts
```

## 🔧 Development vs Production

### Development (Current)
- Uses simple in-memory storage with `global.todos`
- Works with `bun dev` / `npm run dev`
- No external dependencies required
- Data resets on server restart

### Production (Ready for UserDO)
The app is architected to easily integrate UserDO for production:

```typescript
// Replace in-memory storage with UserDO
import { UserDO, type Table } from 'userdo'

export class TodoDO extends UserDO {
  todos: Table<Todo>
  
  constructor(state: DurableObjectState, env: Env) {
    super(state, env)
    this.todos = this.table('todos', TodoSchema, { userScoped: true })
  }
  
  async add(text: string) {
    return this.todos.create({ text, completed: false, createdAt: new Date().toISOString() })
  }
  
  async list() {
    return this.todos.orderBy('createdAt', 'desc').get()
  }
}
```

## 🚀 Deployment to Cloudflare Workers

1. **Build the application**:
   ```bash
   bun run build
   ```

2. **Deploy to Cloudflare**:
   ```bash
   bun run deploy
   ```

The app is configured with:
- `cloudflare-module` target in Vite
- Node.js compatibility flags
- Static assets serving
- Observability enabled

## 🔮 UserDO Integration Steps

To integrate UserDO for production persistence:

1. **Update API Routes**: Replace `global.todos` with UserDO calls
2. **Add Authentication**: Implement user sessions and auth
3. **Configure Bindings**: Set up Durable Object bindings in wrangler.jsonc
4. **Deploy**: Use `bun run deploy` for Cloudflare Workers

The foundation is ready - just swap the storage layer!

## 🤝 Contributing

This example demonstrates the perfect foundation for UserDO integration with TanStack Start. The development experience is smooth with in-memory storage, and production deployment with UserDO provides persistent, user-scoped data.

---

**Built with ❤️ using TanStack Start + Ready for UserDO**
