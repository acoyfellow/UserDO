import { userDOWorker, getUserDO } from 'userdo/worker'
import { UserDO as BaseUserDO } from 'userdo'
import { Context } from 'hono'
import { z } from 'zod'

// Extend UserDO with database table functionality
const PostSchema = z.object({
  title: z.string(),
  content: z.string(),
  createdAt: z.string(),
});

export class MyAppDO extends BaseUserDO {
  posts = this.table('posts', PostSchema, { userScoped: true });

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

const getMyAppDO = (c: Context, email: string) => {
  return getUserDO(c, email) as MyAppDO;
}

// Extend the built-in worker with custom endpoints
// --- POSTS ENDPOINTS (Database Table Demo) ---
userDOWorker.get("/posts", async (c: Context) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const myAppDO = getMyAppDO(c, user.email);
  const posts = await myAppDO.getPosts();
  return c.json({ ok: true, posts });
});

userDOWorker.post("/posts", async (c: Context) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  
  // Handle both JSON and form data
  let title: string, content: string;
  
  const contentType = c.req.header('content-type');
  if (contentType?.includes('application/json')) {
    const body = await c.req.json();
    title = body.title;
    content = body.content;
  } else {
    const formData = await c.req.formData();
    title = formData.get('title') as string;
    content = formData.get('content') as string;
  }
  
  if (!title || !content) {
    return c.json({ error: "Missing title or content" }, 400);
  }
  
  const myAppDO = getMyAppDO(c, user.email);
  const post = await myAppDO.createPost(title, content);
  
  // Return JSON response for API calls, redirect for form submissions
  if (contentType?.includes('application/json')) {
    return c.json({ ok: true, post });
  } else {
    return c.redirect('/');
  }
});

userDOWorker.delete("/posts/:id", async (c: Context) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const postId = c.req.param('id');
  const myAppDO = getMyAppDO(c, user.email);
  await myAppDO.deletePost(postId);
  return c.json({ ok: true });
});

// --- Frontend (JSX) ---
userDOWorker.get('/', async (c: Context) => {
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
        <title>UserDO Demo</title>
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
        <script type="module" src="https://unpkg.com/userdo@latest/dist/src/client.js"></script>
        <script type="module" dangerouslySetInnerHTML={{
          __html: `
          import { UserDOClient } from 'https://unpkg.com/userdo@latest/dist/src/client.js';
          
          // Initialize the client and expose it globally for debugging
          const client = new UserDOClient('/api');
          window.userDOClient = client;
          
          console.log('🚀 UserDO Client initialized:', client);
          
          // Listen for auth state changes
          client.onAuthStateChanged(user => {
            console.log('🔐 Auth state changed:', user);
            const authStatus = document.getElementById('auth-status');
            if (authStatus) {
              authStatus.textContent = user ? \`Logged in as: \${user.email}\` : 'Not logged in';
              authStatus.style.color = user ? 'green' : 'red';
            }
          });
          
          // Add client-side post creation
          window.createPostClient = async (title, content) => {
            try {
              console.log('📝 Creating post via client:', { title, content });
              const response = await fetch('/posts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, content })
              });
              if (response.ok) {
                console.log('✅ Post created');
                location.reload(); // Refresh to show new post
              } else {
                const error = await response.json();
                throw new Error(error.error || 'Failed to create post');
              }
            } catch (error) {
              console.error('❌ Error creating post:', error);
              alert('Error creating post: ' + error.message);
            }
          };
          
          // Add client-side login
          window.loginClient = async (email, password) => {
            try {
              console.log('🔑 Logging in via client:', email);
              const result = await client.login(email, password);
              console.log('✅ Login successful:', result);
              location.reload(); // Refresh to show logged in state
            } catch (error) {
              console.error('❌ Login error:', error);
              alert('Login error: ' + error.message);
            }
          };
          
          // Add client-side signup
          window.signupClient = async (email, password) => {
            try {
              console.log('📝 Signing up via client:', email);
              const result = await client.signup(email, password);
              console.log('✅ Signup successful:', result);
              location.reload(); // Refresh to show logged in state
            } catch (error) {
              console.error('❌ Signup error:', error);
              alert('Signup error: ' + error.message);
            }
          };
          
          // Add client-side logout
          window.logoutClient = async () => {
            try {
              console.log('🚪 Logging out via client');
              await client.logout();
              console.log('✅ Logout successful');
              location.reload(); // Refresh to show logged out state
            } catch (error) {
              console.error('❌ Logout error:', error);
              alert('Logout error: ' + error.message);
            }
          };
          
          // Debug function to check current state
          window.debugUserDO = () => {
            console.log('🔍 UserDO Client Debug Info:');
            console.log('- Client instance:', client);
            console.log('- Current user:', client.user);
            console.log('- Has token:', !!client.token);
            console.log('- Has refresh token:', !!client.refreshToken);
            console.log('- LocalStorage tokens:', {
              token: localStorage.getItem('userdo_token'),
              refreshToken: localStorage.getItem('userdo_refresh_token')
            });
          };
          
          console.log('💡 Available debug functions:');
          console.log('- window.userDOClient: Access the client instance');
          console.log('- window.debugUserDO(): Show debug info');
          console.log('- window.loginClient(email, password): Login via client');
          console.log('- window.signupClient(email, password): Signup via client');
          console.log('- window.logoutClient(): Logout via client');
          console.log('- window.createPostClient(title, content): Create post via client');
          `
        }}></script>
      </head>
      <body>
        <h1>UserDO Demo</h1>

        <div id="auth-status" style="padding: 10px; margin: 10px 0; border: 1px solid #ddd; border-radius: 5px; background: #f8f9fa;">
          Checking auth status...
        </div>

        <div class="feature-highlight">
          <h3>✨ Built-in Worker Features</h3>
          <p>This example now uses the built-in <code>userDOWorker</code> from the userdo package, which provides:</p>
          <ul>
            <li>🔐 Complete authentication system with JWT tokens</li>
            <li>🔒 Auth middleware and protected routes</li>
            <li>📝 Form and JSON API endpoints</li>
            <li>🗄️ Key-value storage endpoints (<code>/data</code>)</li>
            <li>📡 Real-time events API (<code>/api/events</code>)</li>
            <li>🔑 Password reset functionality</li>
            <li>✅ Type-safe request/response validation</li>
          </ul>
          <p>We only added custom <code>/posts</code> endpoints for our database table demo!</p>
        </div>

        <p>View extended demo <a href="https://userdo-hono-example.coey.dev">here</a></p>

        <a href="https://github.com/acoyfellow/userdo">GitHub</a>
        &nbsp;•&nbsp;
        <a href="https://www.npmjs.com/package/userdo">NPM</a>
        &nbsp;•&nbsp;
        <a href="https://x.com/acoyfellow.com">@acoyfellow</a>

        {!user && <section>
          <form method="post" action="/signup">
            <fieldset>
              <legend><h2>Sign Up (Server-side)</h2></legend>
              <label for="signup-email">Email:</label>
              <input id="signup-email" name="email" type="email" placeholder="Email" required /><br />
              <label for="signup-password">Password:</label>
              <input id="signup-password" name="password" type="password" placeholder="Password" required /><br />
              <button type="submit">Sign Up (Server)</button>
              <button type="button" onclick="signupClient(document.getElementById('signup-email').value, document.getElementById('signup-password').value)">
                Sign Up (Client)
              </button>
            </fieldset>
          </form>
          <form method="post" action="/login">
            <fieldset>
              <legend><h2>Login (Server-side)</h2></legend>
              <label for="login-email">Email:</label>
              <input id="login-email" name="email" type="email" placeholder="Email" required /><br />
              <label for="login-password">Password:</label>
              <input id="login-password" name="password" type="password" placeholder="Password" required /><br />
              <button type="submit">Login (Server)</button>
              <button type="button" onclick="loginClient(document.getElementById('login-email').value, document.getElementById('login-password').value)">
                Login (Client)
              </button>
            </fieldset>
          </form>
        </section>}

        {user && <section>
          <h2>Welcome {user.email}</h2>
          <form method="post" action="/logout">
            <button type="submit">Logout (Server)</button>
            <button type="button" onclick="logoutClient()">Logout (Client)</button>
          </form>
          <a href="/protected/profile">View Profile (protected)</a>
          &nbsp;•&nbsp;
          <a href="/api/docs">API Documentation</a><br /><br />

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
              <button type="submit">Create Post (Server)</button>
              <button type="button" onclick="createPostClient(document.getElementById('post-title').value, document.getElementById('post-content').value)">
                Create Post (Client)
              </button>
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

export default userDOWorker
