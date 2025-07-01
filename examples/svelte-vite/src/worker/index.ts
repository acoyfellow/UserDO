import { createUserDOWorker, createWebSocketHandler, getUserDOFromContext, UserDO, type Env, type Table, broadcastToUser } from 'userdo';
import { z } from 'zod';
import { Context } from 'hono';

// Define our task data schema - createdAt should be optional for updates
const TaskSchema = z.object({
  title: z.string(),
  description: z.string().default(''),
  completed: z.boolean(),
  createdAt: z.string().optional(),
});

type Task = z.infer<typeof TaskSchema>;

// Extend UserDO with our business logic
export class TaskAppDO extends UserDO {
  tasks: Table<Task>;

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    this.tasks = this.table('tasks', TaskSchema, { userScoped: true });
  }

  async createTask(title: string, description: string) {
    const taskData = {
      title,
      description,
      completed: false,
      createdAt: new Date().toISOString(),
    };

    const result = await this.tasks.create(taskData);
    return result;
  }

  async getTasks() {
    return await this.tasks.orderBy('createdAt', 'desc').get();
  }

  async updateTask(id: string, updates: Partial<Task>) {
    await this.tasks.update(id, updates);
    return { ok: true };
  }

  async deleteTask(id: string) {
    await this.tasks.delete(id);
    return { ok: true };
  }

  async toggleTask(id: string) {
    try {
      const task = await this.tasks.findById(id);
      if (!task) throw new Error('Task not found');

      console.log('Toggling task - found task:', task);
      console.log('Update payload:', { completed: !task.completed });

      // Only pass the field we want to update - UserDO manages createdAt internally
      await this.tasks.update(id, { completed: !task.completed });
      console.log('Update successful!');
      return { ok: true };
    } catch (error) {
      console.error('Toggle task error details:', error);
      throw error;
    }
  }
}

// Export TaskAppDO as UserDO for Durable Object binding (required by Cloudflare)
export { TaskAppDO as UserDO };

// Create the worker with our custom binding name
const taskWorker = createUserDOWorker('TASK_APP_DO');

// Create WebSocket handler for real-time features
const webSocketHandler = createWebSocketHandler('TASK_APP_DO');

// Helper functions
const getTaskAppDO = (c: Context, email: string) => {
  return getUserDOFromContext(c, email, 'TASK_APP_DO') as unknown as TaskAppDO;
};

const requireAuth = (c: Context) => {
  const user = c.get('user');
  if (!user) {
    return { error: c.json({ error: 'Unauthorized' }, 401), user: null };
  }
  return { user, error: null };
};

const broadcastTaskChange = (email: string, action: string, data: any, env: any) => {
  broadcastToUser(email, {
    event: 'table:tasks',
    data: { action, ...data },
    timestamp: Date.now()
  }, 'TASK_APP_DO', env);
};

// --- API ENDPOINTS ---

// Get all tasks
taskWorker.get("/api/tasks", async (c: Context) => {
  const { user, error } = requireAuth(c);
  if (error) return error;

  const taskAppDO = getTaskAppDO(c, user!.email);
  const tasks = await taskAppDO.getTasks();
  return c.json({ ok: true, tasks });
});

// Create a new task
taskWorker.post("/api/tasks", async (c: Context) => {
  const { user, error } = requireAuth(c);
  if (error) return error;

  const { title, description } = await c.req.json();

  if (!title) {
    return c.json({ error: "Title is required" }, 400);
  }

  const taskAppDO = getTaskAppDO(c, user!.email);
  const task = await taskAppDO.createTask(title, description || '');

  // Broadcast WebSocket notification
  broadcastTaskChange(user!.email, 'create', { data: task }, c.env);

  return c.json({ ok: true, data: task });
});

// Toggle task completion
taskWorker.post("/api/tasks/:id/toggle", async (c: Context) => {
  const { user, error } = requireAuth(c);
  if (error) return error;

  const taskId = c.req.param('id');

  const taskAppDO = getTaskAppDO(c, user!.email);
  await taskAppDO.toggleTask(taskId);

  // Broadcast WebSocket notification
  broadcastTaskChange(user!.email, 'toggle', { id: taskId }, c.env);

  return c.json({ ok: true });
});

// Delete a task
taskWorker.delete("/api/tasks/:id", async (c: Context) => {
  const { user, error } = requireAuth(c);
  if (error) return error;

  const taskId = c.req.param('id');

  const taskAppDO = getTaskAppDO(c, user!.email);
  await taskAppDO.deleteTask(taskId);

  // Broadcast WebSocket notification
  broadcastTaskChange(user!.email, 'delete', { id: taskId }, c.env);

  return c.json({ ok: true });
});

// Export the worker
export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    if (request.headers.get('upgrade') === 'websocket') {
      return webSocketHandler.fetch(request, env, ctx);
    }
    return taskWorker.fetch(request, env, ctx);
  }
};
