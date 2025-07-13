import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { UserDO, type Env } from './UserDO.js'
import { createChatbotRoutes } from './chatbot-routes.js'
import { createUserDOWorker } from './worker.js'

export { UserDO }

function createMainWorker() {
  const app = new Hono<{ Bindings: Env }>();

  // Add CORS middleware
  app.use('/*', cors({
    origin: (origin) => origin,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }));

  // Mount existing UserDO routes
  const userDORoutes = createUserDOWorker();
  app.route('/', userDORoutes);

  // Add chatbot routes
  app.post('/api/documents/upload', async (c) => {
    const chatbotRoutes = createChatbotRoutes(c.env);
    return chatbotRoutes.fetch(c.req.raw, c.env, c.executionCtx);
  });

  app.post('/api/chat', async (c) => {
    const chatbotRoutes = createChatbotRoutes(c.env);
    return chatbotRoutes.fetch(c.req.raw, c.env, c.executionCtx);
  });

  app.get('/api/chat/history/:userId', async (c) => {
    const chatbotRoutes = createChatbotRoutes(c.env);
    return chatbotRoutes.fetch(c.req.raw, c.env, c.executionCtx);
  });

  app.get('/api/documents/:userId', async (c) => {
    const chatbotRoutes = createChatbotRoutes(c.env);
    return chatbotRoutes.fetch(c.req.raw, c.env, c.executionCtx);
  });

  app.delete('/api/documents/:userId/:documentId', async (c) => {
    const chatbotRoutes = createChatbotRoutes(c.env);
    return chatbotRoutes.fetch(c.req.raw, c.env, c.executionCtx);
  });

  return app;
}

const app = createMainWorker();

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return app.fetch(request, env, ctx);
  },
};

export { app };