// In a real project, you would import from 'userdo':
// import { userDOWorker, getUserDOFromContext, UserDO, type Env, type Table } from 'userdo'
import { userDOWorker, getUserDOFromContext, UserDO, type Env, type Table } from '../../src'
import { z } from 'zod'

// Extend UserDO with database table functionality
const PostSchema = z.object({
  title: z.string(),
  content: z.string(),
  createdAt: z.string(),
});

const NotificationSchema = z.object({
  message: z.string(),
  type: z.enum(['info', 'success', 'warning', 'error']),
  createdAt: z.string(),
  read: z.boolean().default(false),
});

type Post = z.infer<typeof PostSchema>;
type Notification = z.infer<typeof NotificationSchema>;

export class MyAppDO extends UserDO {
  posts: Table<Post>;
  notifications: Table<Notification>;

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    this.posts = this.table('posts', PostSchema, { userScoped: true });
    this.notifications = this.table('notifications', NotificationSchema, { userScoped: true });
  }

  async createPost(title: string, content: string) {
    const post = await this.posts.create({
      title,
      content,
      createdAt: new Date().toISOString(),
    });

    // Create a notification about the new post
    await this.notifications.create({
      message: `New post created: "${title}"`,
      type: 'success',
      createdAt: new Date().toISOString(),
      read: false,
    });

    return post;
  }

  async getPosts() {
    return await this.posts.orderBy('createdAt', 'desc').get();
  }

  async deletePost(id: string) {
    const post = await this.posts.findById(id);
    if (post) {
      await this.posts.delete(id);
      
      // Create a notification about the deletion
      await this.notifications.create({
        message: `Post deleted: "${post.title}"`,
        type: 'info',
        createdAt: new Date().toISOString(),
        read: false,
      });
    }
    return { ok: true };
  }

  async updatePost(id: string, updates: Partial<Post>) {
    const post = await this.posts.update(id, updates);
    
    // Create a notification about the update
    await this.notifications.create({
      message: `Post updated: "${post.title}"`,
      type: 'info',
      createdAt: new Date().toISOString(),
      read: false,
    });

    return post;
  }

  async getNotifications() {
    return await this.notifications.orderBy('createdAt', 'desc').limit(10).get();
  }

  async markNotificationAsRead(id: string) {
    return await this.notifications.update(id, { read: true });
  }

  async clearAllNotifications() {
    const notifications = await this.notifications.getAll();
    for (const notification of notifications) {
      await this.notifications.delete(notification.id);
    }
    return { ok: true };
  }

  // Simulate sending a broadcast message to all users (for demo purposes)
  async sendBroadcastMessage(message: string) {
    await this.notifications.create({
      message: `📢 Broadcast: ${message}`,
      type: 'info',
      createdAt: new Date().toISOString(),
      read: false,
    });
    return { ok: true };
  }
}

// Export MyAppDO as the default Durable Object
export { MyAppDO as UserDO }

const getMyAppDO = (c: any, email: string) => {
  return getUserDOFromContext(c, email) as unknown as MyAppDO;
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
  return c.redirect('/');
});

userDOWorker.delete("/posts/:id", async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const postId = c.req.param('id');
  const myAppDO = getMyAppDO(c, user.email);
  await myAppDO.deletePost(postId);
  return c.json({ ok: true });
});

userDOWorker.put("/posts/:id", async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const postId = c.req.param('id');
  const { title, content } = await c.req.json();
  const myAppDO = getMyAppDO(c, user.email);
  const post = await myAppDO.updatePost(postId, { title, content });
  return c.json({ ok: true, post });
});

// --- NOTIFICATIONS ENDPOINTS ---
userDOWorker.get("/api/notifications", async (c: any) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const myAppDO = getMyAppDO(c, user.email);
  const notifications = await myAppDO.getNotifications();
  return c.json({ ok: true, notifications });
});

userDOWorker.put("/api/notifications/:id/read", async (c: any) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const notificationId = c.req.param('id');
  const myAppDO = getMyAppDO(c, user.email);
  await myAppDO.markNotificationAsRead(notificationId);
  return c.json({ ok: true });
});

userDOWorker.delete("/api/notifications", async (c: any) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const myAppDO = getMyAppDO(c, user.email);
  await myAppDO.clearAllNotifications();
  return c.json({ ok: true });
});

// --- DEMO ENDPOINTS ---
userDOWorker.post("/api/demo/broadcast", async (c: any) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const { message } = await c.req.json();
  const myAppDO = getMyAppDO(c, user.email);
  await myAppDO.sendBroadcastMessage(message);
  return c.json({ ok: true });
});

// --- Minimal Frontend (JSX) ---
userDOWorker.get('/', async (c: any) => {
  const user = c.get('user') || undefined;
  let data, posts: any[] = [], notifications: any[] = [];

  if (user) {
    const userDO = getUserDOFromContext(c, user.email);
    const myAppDO = getMyAppDO(c, user.email);
    data = await userDO.get("data");
    posts = await myAppDO.getPosts();
    notifications = await myAppDO.getNotifications();
  }

  return c.html(
    <html>
      <head>
        <title>UserDO Real-Time Demo</title>
        <style>{`
          body {
            font-family: Avenir, Inter, Helvetica, Arial, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f8f9fa;
          }
          .container {
            display: grid;
            grid-template-columns: 2fr 1fr;
            gap: 20px;
            align-items: start;
          }
          @media (max-width: 768px) {
            .container {
              grid-template-columns: 1fr;
            }
          }
          fieldset {
            margin: 20px 0;
            padding: 15px;
            background: white;
            border: 1px solid #ddd;
            border-radius: 8px;
          }
          legend {
            font-weight: bold;
            padding: 0 10px;
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
            border: 1px solid #ddd;
            border-radius: 4px;
          }
          button {
            padding: 10px 15px;
            margin: 5px 5px 5px 0;
            font-size: 16px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            background: #007bff;
            color: white;
          }
          button:hover {
            background: #0056b3;
          }
          button.secondary {
            background: #6c757d;
          }
          button.secondary:hover {
            background: #545b62;
          }
          button.danger {
            background: #dc3545;
          }
          button.danger:hover {
            background: #c82333;
          }
          .post {
            border: 1px solid #ddd;
            margin: 10px 0;
            padding: 15px;
            border-radius: 8px;
            background: white;
            transition: all 0.3s ease;
          }
          .post.new {
            animation: slideIn 0.5s ease;
            border-color: #28a745;
            box-shadow: 0 0 10px rgba(40, 167, 69, 0.3);
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
          .delete-btn, .edit-btn {
            font-size: 12px;
            padding: 5px 10px;
            margin-right: 5px;
          }
          .notifications-panel {
            position: sticky;
            top: 20px;
            max-height: 80vh;
            overflow-y: auto;
          }
          .notification {
            padding: 10px;
            margin: 5px 0;
            border-radius: 6px;
            border-left: 4px solid;
            background: white;
            transition: all 0.3s ease;
          }
          .notification.new {
            animation: slideIn 0.5s ease;
          }
          .notification.info {
            border-color: #17a2b8;
            background: #d1ecf1;
          }
          .notification.success {
            border-color: #28a745;
            background: #d4edda;
          }
          .notification.warning {
            border-color: #ffc107;
            background: #fff3cd;
          }
          .notification.error {
            border-color: #dc3545;
            background: #f8d7da;
          }
          .notification.read {
            opacity: 0.6;
          }
          .realtime-status {
            position: fixed;
            top: 10px;
            right: 10px;
            padding: 8px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            z-index: 1000;
          }
          .realtime-status.connected {
            background: #28a745;
            color: white;
          }
          .realtime-status.disconnected {
            background: #dc3545;
            color: white;
          }
          .realtime-status.connecting {
            background: #ffc107;
            color: black;
          }
          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateY(-10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          .event-log {
            background: #1e1e1e;
            color: #fff;
            padding: 10px;
            border-radius: 4px;
            max-height: 200px;
            overflow-y: auto;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            margin: 10px 0;
          }
          .event-log .timestamp {
            color: #888;
          }
          .event-log .event-type {
            color: #4CAF50;
            font-weight: bold;
          }
          .auth-status {
            padding: 10px;
            margin: 10px 0;
            border: 1px solid #ddd;
            border-radius: 8px;
            background: white;
          }
          .demo-controls {
            background: #e9f4ff;
            border: 1px solid #b3d7ff;
            border-radius: 8px;
            padding: 15px;
            margin: 15px 0;
          }
        `}</style>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <script type="module" src="https://unpkg.com/userdo@latest/dist/src/client.js"></script>
        <script type="module" dangerouslySetInnerHTML={{
          __html: `
          import { UserDOClient } from 'https://unpkg.com/userdo@latest/dist/src/client.js';
          
          // Initialize the client and expose it globally
          const client = new UserDOClient('/api');
          window.userDOClient = client;
          
          // Real-time status indicator
          let realtimeStatus = 'disconnected';
          let eventLogElement = null;
          let notificationsElement = null;
          let postsElement = null;
          
          function updateRealtimeStatus(status) {
            realtimeStatus = status;
            const statusElement = document.getElementById('realtime-status');
            if (statusElement) {
              statusElement.textContent = status === 'connected' ? '🟢 Live' : 
                                        status === 'connecting' ? '🟡 Connecting...' : '🔴 Offline';
              statusElement.className = 'realtime-status ' + status;
            }
          }
          
          function logEvent(type, data) {
            const timestamp = new Date().toLocaleTimeString();
            const logEntry = \`[\${timestamp}] \${type}: \${JSON.stringify(data)}\`;
            console.log('📡 Real-time event:', logEntry);
            
            if (eventLogElement) {
              const entry = document.createElement('div');
              entry.innerHTML = \`<span class="timestamp">[\${timestamp}]</span> <span class="event-type">\${type}</span>: \${JSON.stringify(data, null, 2)}\`;
              eventLogElement.appendChild(entry);
              eventLogElement.scrollTop = eventLogElement.scrollHeight;
              
              // Keep only last 20 entries
              while (eventLogElement.children.length > 20) {
                eventLogElement.removeChild(eventLogElement.firstChild);
              }
            }
          }
          
          // Auth state management
          client.onAuthStateChanged(user => {
            logEvent('auth:state_changed', { user: user?.email || null });
            const authStatus = document.getElementById('auth-status');
            if (authStatus) {
              authStatus.textContent = user ? \`🔐 Logged in as: \${user.email}\` : '🔑 Not logged in';
              authStatus.style.color = user ? 'green' : 'red';
            }
          });
          
          // Real-time event handlers
          client.on('table:posts:create', (data) => {
            logEvent('table:posts:create', data);
            showNotification('New post created!', 'success');
            addPostToUI(data, true);
          });
          
          client.on('table:posts:update', (data) => {
            logEvent('table:posts:update', data);
            showNotification('Post updated!', 'info');
            updatePostInUI(data);
          });
          
          client.on('table:posts:delete', (data) => {
            logEvent('table:posts:delete', data);
            showNotification('Post deleted!', 'warning');
            removePostFromUI(data.id);
          });
          
          client.on('table:notifications:create', (data) => {
            logEvent('table:notifications:create', data);
            addNotificationToUI(data, true);
          });
          
          client.on('kv:set', (data) => {
            logEvent('kv:set', data);
            showNotification(\`Key-value updated: \${data.key}\`, 'info');
          });
          
          // Connection status events
          client.on('realtime:connected', () => {
            logEvent('realtime:connected', {});
            updateRealtimeStatus('connected');
          });
          
          client.on('realtime:disconnected', () => {
            logEvent('realtime:disconnected', {});
            updateRealtimeStatus('disconnected');
          });
          
          client.on('realtime:error', (error) => {
            logEvent('realtime:error', { error: error.message });
            updateRealtimeStatus('disconnected');
          });
          
          // UI helper functions
          function showNotification(message, type = 'info') {
            // This would typically be a toast or similar
            console.log(\`📱 \${type.toUpperCase()}: \${message}\`);
          }
          
          function addPostToUI(post, isNew = false) {
            if (!postsElement) return;
            
            const postElement = document.createElement('div');
            postElement.className = 'post' + (isNew ? ' new' : '');
            postElement.id = 'post-' + post.id;
            postElement.innerHTML = \`
              <h3>\${post.title}</h3>
              <p>\${post.content}</p>
              <div class="post-meta">
                <small>Created: \${new Date(post.createdAt).toLocaleString()}</small>
                <small> • ID: \${post.id}</small><br/>
                <button class="delete-btn danger" onclick="deletePost('\${post.id}')">Delete</button>
                <button class="edit-btn secondary" onclick="editPost('\${post.id}', '\${post.title}', '\${post.content}')">Edit</button>
              </div>
            \`;
            
            postsElement.insertBefore(postElement, postsElement.firstChild);
            
            if (isNew) {
              setTimeout(() => postElement.classList.remove('new'), 500);
            }
          }
          
          function updatePostInUI(post) {
            const postElement = document.getElementById('post-' + post.id);
            if (postElement) {
              postElement.querySelector('h3').textContent = post.title;
              postElement.querySelector('p').textContent = post.content;
              postElement.classList.add('new');
              setTimeout(() => postElement.classList.remove('new'), 500);
            }
          }
          
          function removePostFromUI(postId) {
            const postElement = document.getElementById('post-' + postId);
            if (postElement) {
              postElement.style.opacity = '0';
              postElement.style.transform = 'translateX(-100%)';
              setTimeout(() => postElement.remove(), 300);
            }
          }
          
          function addNotificationToUI(notification, isNew = false) {
            if (!notificationsElement) return;
            
            const notificationElement = document.createElement('div');
            notificationElement.className = 'notification ' + notification.type + (isNew ? ' new' : '') + (notification.read ? ' read' : '');
            notificationElement.id = 'notification-' + notification.id;
            notificationElement.innerHTML = \`
              <div>\${notification.message}</div>
              <small>\${new Date(notification.createdAt).toLocaleString()}</small>
              \${!notification.read ? \`<button onclick="markNotificationRead('\${notification.id}')" style="float: right; font-size: 10px;">Mark Read</button>\` : ''}
            \`;
            
            notificationsElement.insertBefore(notificationElement, notificationsElement.firstChild);
            
            if (isNew) {
              setTimeout(() => notificationElement.classList.remove('new'), 500);
            }
          }
          
          // Client-side API functions
          window.createPostClient = async (title, content) => {
            try {
              logEvent('api:posts:create', { title, content });
              const posts = client.collection('posts');
              const result = await posts.create({ title, content, createdAt: new Date().toISOString() });
              console.log('✅ Post created:', result);
            } catch (error) {
              console.error('❌ Error creating post:', error);
              showNotification('Error creating post: ' + error.message, 'error');
            }
          };
          
          window.editPost = async (id, currentTitle, currentContent) => {
            const newTitle = prompt('Edit title:', currentTitle);
            if (newTitle === null) return;
            
            const newContent = prompt('Edit content:', currentContent);
            if (newContent === null) return;
            
            try {
              const response = await fetch('/posts/' + id, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: newTitle, content: newContent })
              });
              
              if (response.ok) {
                console.log('✅ Post updated');
              } else {
                throw new Error('Failed to update post');
              }
            } catch (error) {
              console.error('❌ Error updating post:', error);
              showNotification('Error updating post: ' + error.message, 'error');
            }
          };
          
          window.deletePost = async (id) => {
            if (!confirm('Are you sure you want to delete this post?')) return;
            
            try {
              const response = await fetch('/posts/' + id, { method: 'DELETE' });
              if (response.ok) {
                console.log('✅ Post deleted');
              } else {
                throw new Error('Failed to delete post');
              }
            } catch (error) {
              console.error('❌ Error deleting post:', error);
              showNotification('Error deleting post: ' + error.message, 'error');
            }
          };
          
          window.markNotificationRead = async (id) => {
            try {
              const response = await fetch('/api/notifications/' + id + '/read', { method: 'PUT' });
              if (response.ok) {
                const element = document.getElementById('notification-' + id);
                if (element) {
                  element.classList.add('read');
                  const button = element.querySelector('button');
                  if (button) button.remove();
                }
              }
            } catch (error) {
              console.error('❌ Error marking notification as read:', error);
            }
          };
          
          window.clearAllNotifications = async () => {
            try {
              const response = await fetch('/api/notifications', { method: 'DELETE' });
              if (response.ok) {
                if (notificationsElement) {
                  notificationsElement.innerHTML = '<p><em>No notifications</em></p>';
                }
              }
            } catch (error) {
              console.error('❌ Error clearing notifications:', error);
            }
          };
          
          window.sendBroadcastMessage = async () => {
            const message = prompt('Enter broadcast message:');
            if (!message) return;
            
            try {
              const response = await fetch('/api/demo/broadcast', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message })
              });
              
              if (response.ok) {
                showNotification('Broadcast sent!', 'success');
              }
            } catch (error) {
              console.error('❌ Error sending broadcast:', error);
            }
          };
          
          window.toggleRealtime = () => {
            if (realtimeStatus === 'connected') {
              client.disconnectRealtime();
              updateRealtimeStatus('disconnected');
            } else {
              updateRealtimeStatus('connecting');
              client.connectRealtime();
            }
          };
          
          // Authentication functions
          window.loginClient = async (email, password) => {
            try {
              logEvent('auth:login', { email });
              const result = await client.login(email, password);
              console.log('✅ Login successful:', result);
              location.reload();
            } catch (error) {
              console.error('❌ Login error:', error);
              showNotification('Login error: ' + error.message, 'error');
            }
          };
          
          window.signupClient = async (email, password) => {
            try {
              logEvent('auth:signup', { email });
              const result = await client.signup(email, password);
              console.log('✅ Signup successful:', result);
              location.reload();
            } catch (error) {
              console.error('❌ Signup error:', error);
              showNotification('Signup error: ' + error.message, 'error');
            }
          };
          
          window.logoutClient = async () => {
            try {
              logEvent('auth:logout', {});
              await client.logout();
              console.log('✅ Logout successful');
              location.reload();
            } catch (error) {
              console.error('❌ Logout error:', error);
              showNotification('Logout error: ' + error.message, 'error');
            }
          };
          
          // Initialize UI elements when DOM is ready
          document.addEventListener('DOMContentLoaded', () => {
            eventLogElement = document.getElementById('event-log');
            notificationsElement = document.getElementById('notifications-container');
            postsElement = document.getElementById('posts-container');
            
            // Auto-connect to real-time events if user is logged in
            if (client.user) {
              updateRealtimeStatus('connecting');
              client.connectRealtime();
            }
            
            logEvent('app:initialized', { hasUser: !!client.user });
          });
          
          // Debug utilities
          window.debugUserDO = () => {
            console.log('🔍 UserDO Client Debug Info:');
            console.log('- Client instance:', client);
            console.log('- Current user:', client.user);
            console.log('- Real-time status:', realtimeStatus);
            console.log('- Event listeners:', client._eventListeners);
          };
          
          console.log('🚀 UserDO Real-Time Demo initialized');
          console.log('💡 Available functions: loginClient, signupClient, logoutClient, createPostClient, toggleRealtime, debugUserDO');
          `
        }}></script>
      </head>
      <body>
        <div id="realtime-status" class="realtime-status disconnected">🔴 Offline</div>
        
        <h1>UserDO Real-Time Demo</h1>

        <div id="auth-status" class="auth-status">
          Checking auth status...
        </div>

        <div class="demo-controls">
          <h3>🎮 Real-Time Demo Controls</h3>
          <button onclick="toggleRealtime()">Toggle Real-Time Connection</button>
          <button onclick="sendBroadcastMessage()">Send Broadcast Message</button>
          <button onclick="debugUserDO()">Debug Client State</button>
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
              <legend><h2>Sign Up</h2></legend>
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
              <legend><h2>Login</h2></legend>
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
          <div class="container">
            <div class="main-content">
              <h2>Welcome {user.email}</h2>
              <form method="post" action="/logout">
                <button type="submit">Logout (Server)</button>
                <button type="button" onclick="logoutClient()">Logout (Client)</button>
              </form>

              <details>
                <summary>User Info</summary>
                <pre>{JSON.stringify(user, null, 2)}</pre>
              </details>

              {/* UserDO KV Storage Demo */}
              <form method="post" action="/data">
                <fieldset>
                  <legend><h2>🗄️ UserDO KV Storage</h2></legend>
                  <p><em>Key-value storage with real-time events</em></p>
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
                  <legend><h2>🗃️ Database Tables with Real-Time Events</h2></legend>
                  <p><em>Create, update, delete posts and see real-time notifications</em></p>
                  <label for="post-title">Post Title:</label>
                  <input id="post-title" name="title" type="text" placeholder="Enter post title" required /><br />
                  <label for="post-content">Post Content:</label>
                  <textarea id="post-content" name="content" placeholder="Write your post content here..." required rows={4}></textarea>
                  <button type="submit">Create Post (Server)</button>
                  <button type="button" onclick="createPostClient(document.getElementById('post-title').value, document.getElementById('post-content').value)">
                    Create Post (Client + Real-Time)
                  </button>
                </fieldset>
              </form>

              <fieldset>
                <legend><h2>📝 Your Posts ({posts.length})</h2></legend>
                <div id="posts-container">
                  {posts && posts.length > 0 ? (
                    posts.map((post: any) => (
                      <div class="post" id={'post-' + post.id} key={post.id}>
                        <h3>{post.title}</h3>
                        <p>{post.content}</p>
                        <div class="post-meta">
                          <small>Created: {new Date(post.createdAt).toLocaleString()}</small>
                          <small> • ID: {post.id}</small>
                          <br />
                          <button
                            class="delete-btn danger"
                            onclick={'deletePost("' + post.id + '")'}
                          >
                            Delete
                          </button>
                          <button
                            class="edit-btn secondary"
                            onclick={'editPost("' + post.id + '", "' + post.title + '", "' + post.content + '")'}
                          >
                            Edit
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p><em>No posts yet. Create your first post above!</em></p>
                  )}
                </div>
              </fieldset>

              <fieldset>
                <legend><h2>📡 Real-Time Event Log</h2></legend>
                <div id="event-log" class="event-log">
                  <div><span class="timestamp">[Ready]</span> <span class="event-type">Waiting for events...</span></div>
                </div>
              </fieldset>
            </div>

            <div class="sidebar">
              <div class="notifications-panel">
                <fieldset>
                  <legend><h2>🔔 Live Notifications</h2></legend>
                  <button onclick="clearAllNotifications()" class="secondary">Clear All</button>
                  <div id="notifications-container">
                    {notifications && notifications.length > 0 ? (
                      notifications.map((notification: any) => (
                        <div class={'notification ' + notification.type + (notification.read ? ' read' : '')} id={'notification-' + notification.id} key={notification.id}>
                          <div>{notification.message}</div>
                          <small>{new Date(notification.createdAt).toLocaleString()}</small>
                          {!notification.read && (
                            <button onclick={'markNotificationRead("' + notification.id + '")'} style="float: right; font-size: 10px;">Mark Read</button>
                          )}
                        </div>
                      ))
                    ) : (
                      <p><em>No notifications</em></p>
                    )}
                  </div>
                </fieldset>
              </div>
            </div>
          </div>
        </section>}
      </body>
    </html>
  )
})

export default userDOWorker
