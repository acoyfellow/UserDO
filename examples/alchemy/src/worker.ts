import { z } from "zod";

// Define schema - same as in alchemy.run.ts
const PostSchema = z.object({
  title: z.string(),
  content: z.string(),
  createdAt: z.string(),
});

// Durable Object class that extends UserDO
export class MyAppDO {
  private userDO: any;
  private posts: any;
  private ctx: any;
  private env: any;

  constructor(ctx: any, env: any) {
    this.ctx = ctx;
    this.env = env;
  }

  private async ensureUserDO() {
    if (!this.userDO) {
      const { UserDO } = await import("userdo");
      this.userDO = new UserDO(this.ctx, this.env);
      this.posts = this.userDO.table('posts', PostSchema, { userScoped: true });
    }
  }

  async createPost(title: string, content: string) {
    await this.ensureUserDO();
    return await this.posts.create({
      title,
      content,
      createdAt: new Date().toISOString(),
    });
  }

  async getPosts() {
    await this.ensureUserDO();
    return await this.posts.orderBy('createdAt', 'desc').get();
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/posts' && request.method === 'GET') {
      const posts = await this.getPosts();
      return Response.json(posts);
    }

    if (url.pathname === '/posts' && request.method === 'POST') {
      const body = await request.json() as { title: string; content: string };
      const post = await this.createPost(body.title, body.content);
      return Response.json(post);
    }

    return new Response('MyAppDO is running!', { status: 200 });
  }
}

// Worker fetch handler
export default {
  async fetch(request: Request, env: any): Promise<Response> {
    const { getUserDO } = await import("userdo");

    // Get the Durable Object stub for the demo user
    const userDOStub = await getUserDO(env.MY_APP_DO, 'demo@example.com');

    // Create a simple API that works with the UserDO
    const url = new URL(request.url);

    if (url.pathname === '/posts' && request.method === 'GET') {
      // For now, return a simple response - in a real app you'd call methods on userDOStub
      return Response.json([
        { title: "Welcome to UserDO + Alchemy", content: "This is working!", createdAt: new Date().toISOString() }
      ]);
    }

    if (url.pathname === '/posts' && request.method === 'POST') {
      const body = await request.json() as { title: string; content: string };
      // In a real app, you'd call a method on userDOStub to create the post
      return Response.json({
        title: body.title,
        content: body.content,
        createdAt: new Date().toISOString(),
        message: "Post created successfully!"
      });
    }

    return new Response('UserDO + Alchemy Worker is running!', { status: 200 });
  },
}; 