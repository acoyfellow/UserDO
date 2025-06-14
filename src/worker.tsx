import { Hono, Context } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { Env, UserDO as BaseUserDO } from './UserDO'
import { z } from 'zod'

// Extend UserDO with database table functionality
const PostSchema = z.object({
  title: z.string(),
  content: z.string(),
  createdAt: z.string(),
});

export class MyAppDO extends BaseUserDO {
  posts = this.table('posts', PostSchema, { userScoped: true });

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
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

  async deletePost(id: string) {
    await this.posts.delete(id);
    return { ok: true };
  }
}

// Export MyAppDO as the default Durable Object
export { MyAppDO as UserDO }

type User = {
  id: string;
  email: string;
}

const getUserDO = (c: Context, email: string) => {
  const userDOID = c.env.USERDO.idFromName(email);
  return c.env.USERDO.get(userDOID) as unknown as BaseUserDO;
}

const getMyAppDO = (c: Context, email: string) => {
  const userDOID = c.env.USERDO.idFromName(email);
  return c.env.USERDO.get(userDOID) as unknown as MyAppDO;
}

const app = new Hono<{ Bindings: Env, Variables: { user: User } }>()

// --- AUTH ENDPOINTS ---
app.post('/signup', async (c) => {
  const formData = await c.req.formData()
  const email = (formData.get('email') as string)?.toLowerCase();
  const password = formData.get('password') as string
  if (!email || !password) {
    return c.json({ error: "Missing fields" }, 400)
  }
  const userDO = getUserDO(c, email);
  try {
    const { user, token, refreshToken } = await userDO.signup({ email, password })
    setCookie(c, 'token', token, {
      httpOnly: true,
      secure: true,
      path: '/',
      sameSite: 'Strict'
    })
    setCookie(c, 'refreshToken', refreshToken, {
      httpOnly: true,
      secure: true,
      path: '/',
      sameSite: 'Strict'
    })
    return c.redirect('/');
  } catch (e: any) {
    return c.json({ error: e.message || "Signup error" }, 400)
  }
})

app.post('/login', async (c) => {
  const formData = await c.req.formData()
  const email = (formData.get('email') as string)?.toLowerCase();
  const password = formData.get('password') as string
  if (!email || !password) {
    return c.json({ error: "Missing fields" }, 400)
  }
  const userDO = getUserDO(c, email);
  try {
    const { user, token, refreshToken } = await userDO.login({ email, password })
    setCookie(c, 'token', token, {
      httpOnly: true,
      secure: true,
      path: '/',
      sameSite: 'Strict'
    })
    setCookie(c, 'refreshToken', refreshToken, {
      httpOnly: true,
      secure: true,
      path: '/',
      sameSite: 'Strict'
    })
    return c.redirect('/');
  } catch (e: any) {
    return c.json({ error: e.message || "Login error" }, 400)
  }
})

// logout
app.post('/logout', async (c) => {
  try {
    const token = getCookie(c, 'token') || '';
    const tokenParts = token.split('.');
    if (tokenParts.length === 3 && tokenParts[1]) {
      const payload = JSON.parse(atob(tokenParts[1]));
      const email = payload.email?.toLowerCase();
      if (email) {
        const userDO = getUserDO(c, email);
        await userDO.logout();
      }
    }
  } catch (e) {
    console.error('Logout error', e);
  }
  deleteCookie(c, 'token');
  deleteCookie(c, 'refreshToken');
  return c.redirect('/');
})

// --- AUTH MIDDLEWARE ---
app.use('/*', async (c, next) => {
  try {
    const token = getCookie(c, 'token') || '';
    const refreshToken = getCookie(c, 'refreshToken') || '';

    // Helper function to safely decode JWT payload
    const decodeJWTPayload = (jwt: string) => {
      try {
        const parts = jwt.split('.');
        if (parts.length !== 3 || !parts[1]) return null;
        return JSON.parse(atob(parts[1]));
      } catch {
        return null;
      }
    };

    const accessPayload = decodeJWTPayload(token);
    const refreshPayload = decodeJWTPayload(refreshToken);
    let email = accessPayload?.email?.toLowerCase() || refreshPayload?.email?.toLowerCase();

    if (email) {
      const userDO = getUserDO(c, email);
      const result = await userDO.verifyToken({ token: token });
      if (!result.ok) {
        const refreshResult = await userDO.refreshToken({ refreshToken });
        if (!refreshResult.token) return c.json({ error: 'Unauthorized' }, 401);
        setCookie(c, 'token', refreshResult.token, {
          httpOnly: true,
          secure: true,
          path: '/',
          sameSite: 'Strict'
        })
      }
      if (result.ok && result.user) {
        c.set('user', result.user ?? undefined);
      };
    }
    await next();
  } catch (e) {
    console.error(e);
    await next();
  };
});

app.get("/data", async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const userDO = getUserDO(c, user.email);
  const result = await userDO.get('data');
  return c.json({ ok: true, data: result });
});

app.post("/data", async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const formData = await c.req.formData();
  const key = formData.get('key') as string;
  const value = formData.get('value') as string;
  const userDO = getUserDO(c, user.email);
  const result = await userDO.set(key, value);
  if (!result.ok) return c.json({ error: 'Failed to set data' }, 400);
  return c.json({ ok: true, data: { key, value } });
});

// --- POSTS ENDPOINTS (Database Table Demo) ---
app.get("/posts", async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const myAppDO = getMyAppDO(c, user.email);
  const posts = await myAppDO.getPosts();
  return c.json({ ok: true, posts });
});

app.post("/posts", async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const formData = await c.req.formData();
  const title = formData.get('title') as string;
  const content = formData.get('content') as string;
  if (!title || !content) {
    return c.json({ error: "Missing title or content" }, 400);
  }
  const myAppDO = getMyAppDO(c, user.email);
  const post = await myAppDO.createPost(title, content);
  return c.redirect('/');
});

app.delete("/posts/:id", async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const postId = c.req.param('id');
  const myAppDO = getMyAppDO(c, user.email);
  await myAppDO.deletePost(postId);
  return c.json({ ok: true });
});

// Example protected endpoint
app.get('/protected/profile', (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  return c.json({ ok: true, user });
});

// --- Minimal Frontend (JSX) ---
app.get('/', async (c) => {
  const user = c.get('user') || undefined;
  let data, posts: any[] = [];

  if (user) {
    const userDO = getUserDO(c, user.email);
    const myAppDO = getMyAppDO(c, user.email);
    data = await userDO.get("data");
    posts = await myAppDO.getPosts();
  }

  return c.html(
    <html>
      <head>
        <title>UserDO Demo with Database Tables</title>
        <style>{`
          body {
            font-family: Avenir, Inter, Helvetica, Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
          }
          fieldset {
            margin: 20px 0;
            padding: 15px;
          }
          details {
            margin: 10px 0;
          }
          input, textarea, select {
            display: block;
            margin: 5px 0 10px 0;
            padding: 8px;
            width: 100%;
            box-sizing: border-box;
            font-size: 16px;
          }
          button {
            padding: 10px 15px;
            margin: 5px 5px 5px 0;
            font-size: 16px;
          }
          .post {
            border: 1px solid #ddd;
            margin: 10px 0;
            padding: 15px;
            border-radius: 5px;
            background: #f9f9f9;
          }
          .post h3 {
            margin-top: 0;
            color: #333;
          }
          .post-meta {
            color: #666;
            font-size: 0.9em;
            margin-top: 10px;
          }
          .delete-btn {
            background: #dc3545;
            color: white;
            border: none;
            padding: 5px 10px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
          }
          .delete-btn:hover {
            background: #c82333;
          }
          .feature-highlight {
            background: #e7f3ff;
            border-left: 4px solid #007bff;
            padding: 10px;
            margin: 10px 0;
          }
        `}</style>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <script dangerouslySetInnerHTML={{
          __html: `
          async function deletePost(id) {
            if (confirm('Are you sure you want to delete this post?')) {
              try {
                const response = await fetch('/posts/' + id, { method: 'DELETE' });
                if (response.ok) {
                  location.reload();
                } else {
                  alert('Failed to delete post');
                }
              } catch (error) {
                alert('Error deleting post');
              }
            }
          }
        `
        }}></script>
      </head>
      <body>
        <h1>UserDO Demo with Database Tables</h1>

        <p>View extended demo <a href="https://userdo-hono-example.coey.dev">here</a></p>

        <a href="https://github.com/acoyfellow/userdo">GitHub</a>
        &nbsp;•&nbsp;
        <a href="https://www.npmjs.com/package/userdo">NPM</a>
        &nbsp;•&nbsp;
        <a href="https://x.com/acoyfellow.com">@acoyfellow</a>

        {!user && <section>
          <form method="post" action="/signup">
            <fieldset>
              <legend><h2>Sign Up</h2></legend>
              <label for="signup-email">Email:</label>
              <input id="signup-email" name="email" type="email" placeholder="Email" required /><br />
              <label for="signup-password">Password:</label>
              <input id="signup-password" name="password" type="password" placeholder="Password" required /><br />
              <button type="submit">Sign Up</button>
            </fieldset>
          </form>
          <form method="post" action="/login">
            <fieldset>
              <legend><h2>Login</h2></legend>
              <label for="login-email">Email:</label>
              <input id="login-email" name="email" type="email" placeholder="Email" required /><br />
              <label for="login-password">Password:</label>
              <input id="login-password" name="password" type="password" placeholder="Password" required /><br />
              <button type="submit">Login</button>
            </fieldset>
          </form>
        </section>}

        {user && <section>
          <h2>Welcome {user.email}</h2>
          <form method="post" action="/logout">
            <button type="submit">Logout</button>
          </form>
          <a href="/protected/profile">View Profile (protected)</a><br /><br />

          <details>
            <summary>User Info</summary>
            <pre>{JSON.stringify(user, null, 2)}</pre>
          </details>

          {/* UserDO KV Storage Demo */}
          <form method="post" action="/data">
            <fieldset>
              <legend><h2>🗄️ UserDO KV Storage</h2></legend>
              <p><em>Traditional key-value storage using UserDO's built-in methods</em></p>
              <label for="data-key">Key:</label>
              <input id="data-key" name="key" type="text" placeholder="Key" value="data" readonly required /><br />
              <label for="data-value">Value:</label>
              <input id="data-value" name="value" type="text" placeholder="Value" required /><br />
              <button type="submit">Set Data</button>
              <hr />
              {data && (
                <details>
                  <summary>Stored Data</summary>
                  <pre>{JSON.stringify(data, null, 2)}</pre>
                </details>
              )}
            </fieldset>
          </form>

          {/* Database Tables Demo */}
          <form method="post" action="/posts">
            <fieldset>
              <legend><h2>🗃️ Database Tables</h2></legend>

              <p><em>Type-safe database tables with queries, backed by D1</em></p>
              <label for="post-title">Post Title:</label>
              <input id="post-title" name="title" type="text" placeholder="Enter post title" required /><br />
              <label for="post-content">Post Content:</label>
              <textarea id="post-content" name="content" placeholder="Write your post content here..." required rows={4}></textarea>
              <button type="submit">Create Post</button>
            </fieldset>
          </form>

          {posts && posts.length > 0 && (
            <fieldset>
              <legend><h2>Your Posts ({posts.length})</h2></legend>
              <p><em>Posts are stored in a user-scoped database table with automatic querying</em></p>
              {posts.map((post: any) => (
                <div class="post" key={post.id}>
                  <h3>{post.title}</h3>
                  <p>{post.content}</p>
                  <div class="post-meta">
                    <small>Created: {new Date(post.createdAt).toLocaleString()}</small>
                    <small> • ID: {post.id}</small>
                    <br />
                    <button
                      class="delete-btn"
                      onclick={'deletePost("' + post.id + '")'}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </fieldset>
          )}

          {posts && posts.length === 0 && (
            <fieldset>
              <legend><h2>Your Posts</h2></legend>
              <p><em>No posts yet. Create your first post above!</em></p>
            </fieldset>
          )}

        </section>}

      </body>
    </html>
  )
})

export default app