import { createUserDOWorker, type Env as BaseEnv, AdminDO } from '../../src';
import { Hono } from 'hono';

interface Env extends BaseEnv {
  ADMIN_DO: DurableObjectNamespace<AdminDO>;
}

const app = createUserDOWorker() as unknown as Hono<{ Bindings: Env }>;

app.get('/admin/users', async (c) => {
  const admin = c.env.ADMIN_DO.get(c.env.ADMIN_DO.idFromName('index'));
  const users = await admin.listUsers();
  return c.json({ users });
});

export default app;
