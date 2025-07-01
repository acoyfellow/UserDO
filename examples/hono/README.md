# Hono Integration Example

Learn how to build a complete web application with UserDO, including custom business logic, real-time features, and modern development patterns.

## What You'll Learn

- How to extend UserDO with your own business logic
- Creating type-safe database tables with automatic validation
- Building endpoints that handle both JSON API calls and HTML forms
- Setting up real-time WebSocket events for live updates
- Organizing code to avoid duplication and improve maintainability

## Application Features

- User authentication (signup, login, logout)
- Create, read, and delete blog posts
- Real-time updates when posts are created or deleted
- Responsive web interface with forms and dynamic content
- Unified API endpoints that work with both browsers and API clients

## Key Patterns Demonstrated

### Extending UserDO for Business Logic

```ts
export class MyAppDO extends UserDO {
  posts: Table<Post>;

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    this.posts = this.table('posts', PostSchema, { userScoped: true });
  }

  async createPost(title: string, content: string) {
    return await this.posts.create({
      title,
      content,
      createdAt: new Date().toISOString(),
    });
  }

  async getPosts() {
    return await this.posts.orderBy('createdAt', 'desc').get();
  }
}
```

### Unified Endpoints (JSON + Forms)

```ts
// Single endpoint handles both API calls and form submissions
userDOWorker.post("/posts", async (c) => {
  const { user, error } = requireAuth(c);
  if (error) return error;

  // Handle both JSON and form data
  const contentType = c.req.header('content-type') || '';
  let title: string, content: string;
  
  if (contentType.includes('application/json')) {
    const data = await c.req.json();
    ({ title, content } = data);
  } else {
    const formData = await c.req.formData();
    title = formData.get('title') as string;
    content = formData.get('content') as string;
  }

  const myAppDO = getMyAppDO(c, user!.email);
  const post = await myAppDO.createPost(title, content);

  // Return appropriate response
  if (contentType.includes('application/json')) {
    return c.json({ ok: true, data: post });
  } else {
    return c.redirect('/'); // Redirect after form submission
  }
});
```

### Helper Functions for Clean Code

```ts
// Reusable authentication check
const requireAuth = (c: any) => {
  const user = c.get('user');
  if (!user) {
    return { error: c.json({ error: 'Unauthorized' }, 401), user: null };
  }
  return { user, error: null };
}

// Easy access to your custom UserDO
const getMyAppDO = (c: any, email: string) => {
  return getUserDOFromContext(c, email, 'MY_APP_DO') as MyAppDO;
}
```

## File Structure

```
index.ts - Main application with MyAppDO class and API routes
frontend.tsx - React components for the web interface
package.json - Dependencies and scripts
wrangler.jsonc - Cloudflare Workers configuration
```

## Running the Example

```bash
cd examples/hono
bun install
bun run dev
```

Open `http://localhost:8787` to see the application. You can:

1. Sign up for an account or log in
2. Create blog posts using the form
3. See posts update in real-time (open multiple browser tabs)
4. Delete posts and watch them disappear across all tabs

## API Endpoints

### Built-in Authentication (from UserDO)
- `POST /api/signup` - Create account
- `POST /api/login` - Sign in
- `POST /api/logout` - Sign out
- `GET /api/me` - Get current user

### Custom Business Logic
- `GET /posts` - List all posts
- `POST /posts` - Create new post (handles both JSON and forms)
- `DELETE /posts/:id` - Delete a post
- `POST /api/posts` - JSON-only post creation

### Real-time Updates
- `GET /api/ws` - WebSocket connection for live updates

## Real-time Features

The application automatically broadcasts events when data changes:

- When you create a post, all connected users see it appear instantly
- When you delete a post, it disappears from all browsers immediately
- No manual refresh needed - everything updates live

## Learning Outcomes

After studying this example, you'll understand:

1. **How to add business logic** to UserDO without breaking built-in features
2. **Type-safe database operations** with automatic validation and real-time events
3. **Building APIs that work for both browsers and API clients** with unified endpoints
4. **Code organization patterns** that keep your application maintainable as it grows
5. **Real-time web applications** using WebSocket events

## Extending This Example

To adapt this for your application:

1. Replace the `PostSchema` with your data structure
2. Add your business logic methods to the UserDO extension
3. Create endpoints for your specific operations
4. Update the frontend to match your application's needs
5. Keep the authentication and real-time features as-is

This example shows the foundation for building any web application with UserDO - from blogs to project management tools to social platforms. 