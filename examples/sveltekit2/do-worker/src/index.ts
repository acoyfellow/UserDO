import { UserDO, createUserDOWorker, createWebSocketHandler, getUserDOFromContext, type Env } from "userdo";
import { z } from "zod";

// Define our data schema
const PostSchema = z.object({
  title: z.string(),
  content: z.string(),
  createdAt: z.string(),
});

type Post = z.infer<typeof PostSchema>;

// Extend UserDO with our business logic
export class BlogDO extends UserDO {
  posts: any; // Table<Post> - simplified for example

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    console.log('🏗️ BlogDO constructor called');
    try {
      this.posts = this.table('posts', PostSchema, { userScoped: true });
      console.log('✅ Posts table initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize posts table:', error);
      throw error;
    }
  }

  async createPost(title: string, content: string) {
    console.log('📝 Creating post:', { title, content });
    try {
      const result = await this.posts.create({
        title,
        content,
        createdAt: new Date().toISOString(),
      });
      console.log('✅ Post created successfully:', result);
      return result;
    } catch (error) {
      console.error('❌ Failed to create post:', error);
      throw error;
    }
  }

  async getPosts() {
    console.log('📖 Getting posts');
    try {
      const result = await this.posts.orderBy('createdAt', 'desc').get();
      console.log('✅ Posts retrieved:', result?.length || 0, 'posts');
      return result;
    } catch (error) {
      console.error('❌ Failed to get posts:', error);
      throw error;
    }
  }

  async deletePost(id: string) {
    console.log('🗑️ Deleting post:', id);
    try {
      const result = await this.posts.delete(id);
      console.log('✅ Post deleted successfully');
      return result;
    } catch (error) {
      console.error('❌ Failed to delete post:', error);
      throw error;
    }
  }
}

// Create the UserDO worker with auth endpoints
const app = createUserDOWorker('BLOG_DO');
const wsHandler = createWebSocketHandler('BLOG_DO');

// Export the app type for RPC
export type AppType = typeof app;

// Enhanced CORS middleware
app.use('*', async (c, next) => {
  const origin = c.req.header('origin');
  const method = c.req.method;

  console.log(`🌐 ${method} ${c.req.url} from origin: ${origin}`);

  // Set CORS headers for all requests
  const corsHeaders = {
    'Access-Control-Allow-Origin': 'http://localhost:5173',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400', // 24 hours
  };

  // Handle preflight requests
  if (method === 'OPTIONS') {
    console.log('✈️ Handling preflight request');
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    await next();

    // Add CORS headers to response
    Object.entries(corsHeaders).forEach(([key, value]) => {
      c.res.headers.set(key, value);
    });

    console.log(`✅ ${method} ${c.req.path} - ${c.res.status}`);
  } catch (error) {
    console.error(`❌ ${method} ${c.req.path} - Error:`, error);

    // Add CORS headers to error responses too
    Object.entries(corsHeaders).forEach(([key, value]) => {
      c.res.headers.set(key, value);
    });

    throw error;
  }
});

// Add custom blog routes with better error handling
app.get('/api/posts', async (c) => {
  try {
    console.log('📚 GET /api/posts');
    const user = c.get('user');
    if (!user) {
      console.log('❌ No user found for posts request');
      return c.json({ error: 'Unauthorized' }, 401);
    }

    console.log('👤 User authenticated:', user.email);
    const blogDO = getUserDOFromContext(c, user.email, 'BLOG_DO') as BlogDO;
    const posts = await blogDO.getPosts();

    return c.json({ posts });
  } catch (error) {
    console.error('❌ Error in GET /api/posts:', error);
    return c.json({ error: 'Failed to fetch posts', details: error instanceof Error ? error.message : String(error) }, 500);
  }
});

app.post('/api/posts', async (c) => {
  try {
    console.log('📝 POST /api/posts');
    const user = c.get('user');
    if (!user) {
      console.log('❌ No user found for create post request');
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    console.log('📄 Request body:', body);

    const { title, content } = body;
    if (!title || !content) {
      console.log('❌ Missing title or content');
      return c.json({ error: 'Title and content are required' }, 400);
    }

    console.log('👤 User authenticated:', user.email);
    const blogDO = getUserDOFromContext(c, user.email, 'BLOG_DO') as BlogDO;
    const post = await blogDO.createPost(title, content);

    return c.json({ post });
  } catch (error) {
    console.error('❌ Error in POST /api/posts:', error);
    return c.json({ error: 'Failed to create post', details: error instanceof Error ? error.message : String(error) }, 500);
  }
});

app.delete('/api/posts/:id', async (c) => {
  try {
    console.log('🗑️ DELETE /api/posts/:id');
    const user = c.get('user');
    if (!user) {
      console.log('❌ No user found for delete post request');
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const id = c.req.param('id');
    console.log('🎯 Deleting post ID:', id);

    console.log('👤 User authenticated:', user.email);
    const blogDO = getUserDOFromContext(c, user.email, 'BLOG_DO') as BlogDO;
    await blogDO.deletePost(id);

    return c.json({ success: true });
  } catch (error) {
    console.error('❌ Error in DELETE /api/posts/:id:', error);
    return c.json({ error: 'Failed to delete post', details: error instanceof Error ? error.message : String(error) }, 500);
  }
});

// Export with WebSocket support and better error handling
export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    try {
      if (request.headers.get('upgrade') === 'websocket') {
        console.log('🔌 WebSocket upgrade request');
        return wsHandler.fetch(request, env, ctx);
      }

      console.log('🚀 HTTP request:', request.method, request.url);
      return app.fetch(request, env, ctx);
    } catch (error) {
      console.error('💥 Unhandled error in worker:', error);
      return new Response(JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': 'http://localhost:5173',
          'Access-Control-Allow-Credentials': 'true',
        },
      });
    }
  }
};