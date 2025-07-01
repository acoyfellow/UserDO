// UserDO integration for TanStack Start
import { UserDO, type Table } from 'userdo'
import { z } from 'zod'

// Todo schema
const TodoSchema = z.object({
  id: z.string(),
  text: z.string(),
  completed: z.boolean(),
  createdAt: z.string(),
})

type Todo = z.infer<typeof TodoSchema>

// TodoDO class extending UserDO
export class TodoDO extends UserDO {
  todos: Table<Todo>

  constructor(state: DurableObjectState, env: CloudflareEnv) {
    super(state, env)
    this.todos = this.table('todos', TodoSchema, { userScoped: true })
  }

  async add(text: string) {
    const todo = {
      id: crypto.randomUUID(),
      text,
      completed: false,
      createdAt: new Date().toISOString(),
    }
    return this.todos.create(todo)
  }

  async list() {
    return this.todos.orderBy('createdAt', 'desc').get()
  }

  async toggle(id: string, completed: boolean) {
    return this.todos.update(id, { completed })
  }

  async remove(id: string) {
    return this.todos.delete(id)
  }
}

// Export as UserDO for Cloudflare Workers
export { TodoDO as UserDO }

// Bindings helper for TanStack Start
let cachedEnv: CloudflareEnv | null = null;

// This gets called once at startup when running locally
const initDevEnv = async () => {
  const { getPlatformProxy } = await import("wrangler");
  const proxy = await getPlatformProxy();
  cachedEnv = proxy.env as unknown as CloudflareEnv;
};

if (import.meta.env.DEV) {
  await initDevEnv();
}

/**
 * Will only work when being accessed on the server. Obviously, CF bindings are not available in the browser.
 * @returns 
 */
export function getBindings(): CloudflareEnv {
  if (import.meta.env.DEV) {
    if (!cachedEnv) {
      throw new Error(
        "Dev bindings not initialized yet. Call initDevEnv() first."
      );
    }
    return cachedEnv;
  }
  return process.env as unknown as CloudflareEnv;
}

// Helper to get TodoDO instance
export function getTodoDO(email: string): TodoDO {
  const env = getBindings()
  const id = env.USER_DO.idFromName(email)
  const stub = env.USER_DO.get(id)
  return stub as unknown as TodoDO
} 