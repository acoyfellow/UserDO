import { createUserDOWorker, getUserDOFromContext, UserDO } from 'userdo';
import { z } from 'zod';

// Same schema, different tenants
const TaskSchema = z.object({
  title: z.string(),
  completed: z.boolean().default(false),
  createdAt: z.string(),
});

export class TenantDO extends UserDO {
  tasks = this.table('tasks', TaskSchema, { userScoped: true });

  async createTask(title: string) {
    return this.tasks.create({
      title,
      completed: false,
      createdAt: new Date().toISOString(),
    });
  }

  async getTasks() {
    return this.tasks.orderBy('createdAt', 'desc').get();
  }
}

// Simple tenant routing
function getTenantBinding(hostname: string): string {
  // acme.example.com -> ACME_DO
  // globex.example.com -> GLOBEX_DO
  const subdomain = hostname.split('.')[0].toUpperCase();
  return `${subdomain}_DO`;
}

// Create workers for different tenants
const acmeWorker = createUserDOWorker('ACME_DO');
const globexWorker = createUserDOWorker('GLOBEX_DO');

// Route based on hostname
export default {
  async fetch(request: Request, env: any): Promise<Response> {
    const url = new URL(request.url);
    const tenantBinding = getTenantBinding(url.hostname);

    // Each tenant gets completely isolated users and data
    const worker = tenantBinding === 'ACME_DO' ? acmeWorker : globexWorker;

    return worker.fetch(request, env);
  }
};

export { TenantDO as UserDO }; 