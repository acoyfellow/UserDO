// In a real project, you would import from 'userdo':
// import { createUserDOWorker, createWebSocketHandler, getUserDOFromContext, UserDO, type Env, type Table, broadcastToUser } from 'userdo'
import { createUserDOWorker, createWebSocketHandler, getUserDOFromContext, UserDO, type Env, type Table, broadcastToUser } from '../../src'
import { z } from 'zod'

// Extend UserDO with database table functionality
const PostSchema = z.object({
  title: z.string(),
  content: z.string(),
  createdAt: z.string(),
});

type Post = z.infer<typeof PostSchema>;

export class MyAppDO extends UserDO {
  posts: Table<Post>;

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    this.posts = this.table('posts', PostSchema as any, { userScoped: true });
  }

  async createPost(title: string, content: string) {
    console.log('🔥 MyAppDO.createPost called with:', { title, content });
    console.log('🔥 Posts table:', this.posts);

    const postData = {
      title,
      content,
      createdAt: new Date().toISOString(),
    };
    console.log('🔥 Creating post with data:', postData);

    const result = await this.posts.create(postData);
    console.log('🔥 Post creation result:', result);

    return result;
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

// Create the worker with our custom binding name
const userDOWorker = createUserDOWorker('MY_APP_DO');

// Add the specific /api/posts route BEFORE any generic routes
userDOWorker.post("/api/posts", async (c) => {
  console.log('🔥 Specific /api/posts endpoint hit!');

  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const data = await c.req.json();
  const { title, content } = data;

  if (!title || !content) {
    return c.json({ error: "Missing title or content" }, 400);
  }

  const myAppDO = getMyAppDO(c, user.email);
  const post = await myAppDO.createPost(title, content);

  // Broadcast WebSocket notification
  broadcastToUser(user.email, {
    event: 'table:posts',
    data: { action: 'create', data: post },
    timestamp: Date.now()
  }, 'MY_APP_DO', c.env);

  return c.json({ ok: true, data: post });
});

// Create WebSocket handler for real-time features
const webSocketHandler = createWebSocketHandler('MY_APP_DO');

const getMyAppDO = (c: any, email: string) => {
  return getUserDOFromContext(c, email, 'MY_APP_DO') as unknown as MyAppDO;
}

// --- POSTS ENDPOINTS (Database Table Demo) ---
userDOWorker.get("/posts", async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const myAppDO = getMyAppDO(c, user.email);
  const posts = await myAppDO.getPosts();
  return c.json({ ok: true, posts });
});

userDOWorker.post("/posts", async (c) => {
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

  // Broadcast WebSocket notification for post creation
  console.log(`🔥 Post created for ${user.email}:`, post);
  broadcastToUser(user.email, {
    event: 'table:posts',
    data: { action: 'create', data: post },
    timestamp: Date.now()
  }, 'MY_APP_DO', c.env);

  return c.redirect('/');
});

userDOWorker.delete("/posts/:id", async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const postId = c.req.param('id');
  const myAppDO = getMyAppDO(c, user.email);
  await myAppDO.deletePost(postId);

  // Broadcast WebSocket notification for post deletion
  console.log(`🔥 Post deleted for ${user.email}:`, postId);
  broadcastToUser(user.email, {
    event: 'table:posts',
    data: { action: 'delete', id: postId },
    timestamp: Date.now()
  }, 'MY_APP_DO', c.env);

  return c.json({ ok: true });
});






// --- Minimal Frontend (JSX) ---
userDOWorker.get('/', async (c) => {
  const user = c.get('user') || undefined;
  let data, posts: any[] = [];

  if (user) {
    const userDO = getUserDOFromContext(c, user.email, 'MY_APP_DO');
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
                  console.log('Failed to delete post');
                }
              } catch (error) {
                console.error('Error deleting post');
              }
            }
          }
        `
        }}></script>
        <script type="module" src="https://unpkg.com/userdo@latest/dist/src/client.bundle.js"></script>
        <script type="module" dangerouslySetInnerHTML={{
          __html: `
          import { UserDOClient } from 'https://unpkg.com/userdo@latest/dist/src/client.bundle.js';
          
          // Initialize the UserDO client
          const client = new UserDOClient('/api');
          
          // Update auth status display
          client.onAuthStateChanged(user => {
            const authStatus = document.getElementById('auth-status');
            if (authStatus) {
              authStatus.textContent = user ? \`Logged in as: \${user.email}\` : 'Not logged in';
              authStatus.style.color = user ? 'green' : 'red';
            }
          });
          
          // Client-side post creation using specific API endpoint
          window.createPostClient = async (title, content) => {
            try {
              const response = await fetch('/api/posts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, content })
              });
              
              if (!response.ok) {
                throw new Error('Failed to create post');
              }
              
              const result = await response.json();
              console.log('✅ Post created!', result);
              document.getElementById('post-title').value = '';
              document.getElementById('post-content').value = '';
            } catch (error) {
              console.error('Error creating post: ' + error.message);
            }
          };
          
          // Authentication functions
          window.loginClient = async (email, password) => {
            try {
              await client.login(email, password);
              location.reload();
            } catch (error) {
              console.error('Login error: ' + error.message);
            }
          };
          
          window.signupClient = async (email, password) => {
            try {
              await client.signup(email, password);
              location.reload();
            } catch (error) {
              console.error('Signup error: ' + error.message);
            }
          };
          
          window.logoutClient = async () => {
            try {
              await client.logout();
              location.reload();
            } catch (error) {
              console.error('Logout error: ' + error.message);
            }
          };
          
          // Function to update posts list in real-time
          window.updatePostsList = async () => {
            try {
              const response = await fetch('/posts');
              const data = await response.json();
              if (data.ok && data.posts) {
                renderPostsList(data.posts);
              }
            } catch (error) {
              console.error('Error updating posts list:', error);
            }
          };
          
          // Function to render posts list
          window.renderPostsList = (posts) => {
            const postsContainer = document.getElementById('posts-container');
            if (!postsContainer) return;
            
            if (posts.length === 0) {
              postsContainer.innerHTML = '<fieldset><legend><h2>Your Posts</h2></legend><p><em>No posts yet. Create your first post above!</em></p></fieldset>';
              return;
            }
            
            const postsHtml = \`
              <fieldset>
                <legend><h2>Your Posts (\${posts.length})</h2></legend>
                <p><em>Posts are stored in a user-scoped database table with automatic querying</em></p>
                \${posts.map(post => \`
                  <div class="post">
                    <h3>\${post.title}</h3>
                    <p>\${post.content}</p>
                    <div class="post-meta">
                      <small>Created: \${new Date(post.createdAt).toLocaleString()}</small>
                      <small> • ID: \${post.id}</small>
                      <br />
                      <button class="delete-btn" onclick="deletePostClient('\${post.id}')">Delete</button>
                    </div>
                  </div>
                \`).join('')}
              </fieldset>
            \`;
            postsContainer.innerHTML = postsHtml;
          };
          
          // Client-side post deletion
          window.deletePostClient = async (id) => {
            if (!confirm('Are you sure you want to delete this post?')) return;
            
            try {
              const response = await fetch('/posts/' + id, { method: 'DELETE' });
              if (response.ok) {
                console.log('✅ Post deleted!');
                // The WebSocket will handle updating the UI
              } else {
                console.log('Failed to delete post');
              }
            } catch (error) {
              console.error('Error deleting post:', error);
            }
          };
          
          // Client-side data operations using direct API
          window.setDataClient = async (key, value) => {
            try {
              const response = await fetch('/data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key, value })
              });
              
              if (!response.ok) {
                throw new Error('Failed to save data');
              }
              
              console.log('✅ Data saved!');
              document.getElementById('data-value').value = '';
            } catch (error) {
              console.error('Error setting data: ' + error.message);
            }
          };
          
          // Auto-enable real-time updates via WebSocket
          const ws = new WebSocket((location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + location.host + '/api/ws');
          
          ws.onopen = () => {
            console.log('🔌 WebSocket connected for real-time updates');
          };
          
          ws.onmessage = (event) => {
            try {
              const message = JSON.parse(event.data);
              console.log('🔥 Real-time update received:', message);
              
              // Handle data changes
              if (message.event && message.event.startsWith('kv:')) {
                const storedDataEl = document.getElementById('stored-data');
                if (storedDataEl && message.data) {
                  storedDataEl.textContent = JSON.stringify(message.data.value, null, 2);
                }
              }
              
              // Handle post changes - update posts list in real-time
              if (message.event === 'table:posts') {
                console.log('🔥 Posts updated, refreshing posts list...');
                updatePostsList();
              }
            } catch (error) {
              console.error('Error processing WebSocket message:', error);
            }
          };
          
          ws.onerror = (error) => {
            console.error('WebSocket error:', error);
          };
          
          ws.onclose = () => {
            console.log('🔌 WebSocket disconnected');
          };
          `
        }}></script>
      </head>
      <body>
        <h1>UserDO Demo</h1>
        <a href="https://github.com/acoyfellow/userdo">GitHub</a>
        &nbsp;•&nbsp;
        <a href="https://www.npmjs.com/package/userdo">NPM</a>
        &nbsp;•&nbsp;
        <a href="https://x.com/acoyfellow.com">@acoyfellow</a>

        <div id="auth-status" style="padding: 10px; margin: 10px 0; border: 1px solid #ddd; border-radius: 5px; background: #f8f9fa;">
          Checking auth status...
        </div>

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
              <button type="submit">Set Data (Server)</button>
              <button type="button" onclick="setDataClient(document.getElementById('data-key').value, document.getElementById('data-value').value)">
                Set Data (Client)
              </button>

              <details open>
                <summary>Stored Data</summary>
                <pre id="stored-data">{data ? JSON.stringify(data, null, 2) : 'No data stored'}</pre>
              </details>
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

          <div id="posts-container">
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
                        onclick={'deletePostClient("' + post.id + '")'}
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
          </div>

        </section>}
      </body>
    </html>
  )
})

// Export worker that handles both HTTP and WebSocket requests
export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    // Handle WebSocket upgrades
    if (request.headers.get('upgrade') === 'websocket') {
      return webSocketHandler.fetch(request, env, ctx);
    }

    // Handle all other requests through Hono
    return userDOWorker.fetch(request, env, ctx);
  }
}
