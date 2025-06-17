# UserDO Hono Example with Real-Time Features

This example shows how to extend UserDO with custom business logic and **comprehensive real-time functionality** using the modern approach.

## Key Features

- **Extends the base worker**: Uses `userDOWorker` as the foundation
- **Custom Durable Object**: Extends `UserDO` with business-specific methods
- **Type-safe tables**: Uses Zod schemas for data validation
- **Real-time events**: Automatic broadcasting of table operations with live UI updates
- **Live notifications**: Real-time notification system with read/unread states
- **Event logging**: Visual real-time event stream for debugging
- **Connection status**: Live connection indicator and controls
- **Modern UI**: Clean, responsive interface with real-time animations

## Real-Time System Overview

UserDO provides a complete real-time system that automatically broadcasts events when data changes occur. This example demonstrates:

### 📡 Automatic Event Broadcasting
Every data operation automatically triggers real-time events:
- **Table operations**: `table:{tableName}:{operation}` 
- **Key-value operations**: `kv:{operation}`
- **Connection events**: `realtime:{status}`

### 🔄 Live UI Updates
The frontend automatically updates when events are received:
- **Posts**: Added, updated, and removed in real-time
- **Notifications**: Live notification feed with animations
- **Visual feedback**: Smooth animations for new content

### 🎮 Interactive Demo Controls
- **Toggle connection**: Connect/disconnect from real-time stream
- **Send broadcasts**: Demo sending messages to all users
- **Debug tools**: Real-time event logging and client state inspection

## How it works

### 1. Define your schemas with notification support

```ts
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
```

### 2. Extend UserDO with real-time notification logic

```ts
export class MyAppDO extends UserDO {
  posts = this.table('posts', PostSchema, { userScoped: true });
  notifications = this.table('notifications', NotificationSchema, { userScoped: true });

  async createPost(title: string, content: string) {
    // Create the post
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
    // Both operations automatically broadcast real-time events:
    // → table:posts:create
    // → table:notifications:create
  }

  async updatePost(id: string, updates: Partial<Post>) {
    const post = await this.posts.update(id, updates);
    
    // Notify about the update
    await this.notifications.create({
      message: `Post updated: "${post.title}"`,
      type: 'info',
      createdAt: new Date().toISOString(),
      read: false,
    });

    return post;
    // → table:posts:update
    // → table:notifications:create
  }

  async deletePost(id: string) {
    const post = await this.posts.findById(id);
    if (post) {
      await this.posts.delete(id);
      
      // Notify about deletion
      await this.notifications.create({
        message: `Post deleted: "${post.title}"`,
        type: 'info',
        createdAt: new Date().toISOString(),
        read: false,
      });
    }
    return { ok: true };
    // → table:posts:delete
    // → table:notifications:create
  }

  // Notification management
  async getNotifications() {
    return await this.notifications.orderBy('createdAt', 'desc').limit(10).get();
  }

  async markNotificationAsRead(id: string) {
    return await this.notifications.update(id, { read: true });
    // → table:notifications:update
  }

  async sendBroadcastMessage(message: string) {
    await this.notifications.create({
      message: `📢 Broadcast: ${message}`,
      type: 'info',
      createdAt: new Date().toISOString(),
      read: false,
    });
    return { ok: true };
    // → table:notifications:create
  }
}
```

### 3. Client-side real-time event handling

```ts
import { UserDOClient } from 'userdo';

const client = new UserDOClient('/api');

// ⭐ Table Events (Automatic from database operations)
client.on('table:posts:create', (data) => {
  console.log('New post created:', data);
  addPostToUI(data, true); // Add with animation
  showNotification('New post created!', 'success');
});

client.on('table:posts:update', (data) => {
  console.log('Post updated:', data);
  updatePostInUI(data); // Update existing post
  showNotification('Post updated!', 'info');
});

client.on('table:posts:delete', (data) => {
  console.log('Post deleted:', data);
  removePostFromUI(data.id); // Remove with animation
  showNotification('Post deleted!', 'warning');
});

client.on('table:notifications:create', (data) => {
  console.log('New notification:', data);
  addNotificationToUI(data, true); // Add with animation
});

client.on('table:notifications:update', (data) => {
  console.log('Notification updated:', data);
  updateNotificationInUI(data); // Update read status
});

// ⭐ Key-Value Events (Automatic from KV operations)
client.on('kv:set', (data) => {
  console.log('Key-value updated:', data);
  showNotification(`Data updated: ${data.key}`, 'info');
});

// ⭐ Connection Events
client.on('realtime:connected', () => {
  console.log('Connected to real-time stream');
  updateConnectionStatus('connected');
});

client.on('realtime:disconnected', () => {
  console.log('Disconnected from real-time stream');
  updateConnectionStatus('disconnected');
});

client.on('realtime:error', (error) => {
  console.error('Real-time error:', error);
  updateConnectionStatus('error');
});

// ⭐ Authentication Events
client.onAuthStateChanged(user => {
  console.log('Auth state changed:', user);
  if (user) {
    // Auto-connect when user logs in
    client.connectRealtime();
  } else {
    // Disconnect when user logs out
    client.disconnectRealtime();
  }
});

// Connect to real-time stream
client.connectRealtime();
```

### 4. Advanced real-time UI patterns

```ts
// ⭐ Smart UI Updates with Animations
function addPostToUI(post, isNew = false) {
  const postElement = document.createElement('div');
  postElement.className = 'post' + (isNew ? ' new' : '');
  postElement.id = 'post-' + post.id;
  
  // Add content
  postElement.innerHTML = `
    <h3>${post.title}</h3>
    <p>${post.content}</p>
    <div class="post-meta">
      <small>Created: ${new Date(post.createdAt).toLocaleString()}</small>
      <button onclick="deletePost('${post.id}')">Delete</button>
      <button onclick="editPost('${post.id}')">Edit</button>
    </div>
  `;
  
  // Insert at top for chronological order
  postsContainer.insertBefore(postElement, postsContainer.firstChild);
  
  // Remove animation class after animation completes
  if (isNew) {
    setTimeout(() => postElement.classList.remove('new'), 500);
  }
}

// ⭐ Optimistic Updates
async function createPostOptimistic(title, content) {
  // 1. Immediately add to UI (optimistic)
  const tempPost = {
    id: 'temp-' + Date.now(),
    title,
    content,
    createdAt: new Date().toISOString(),
    status: 'pending'
  };
  addPostToUI(tempPost, true);

  try {
    // 2. Send to server
    const posts = client.collection('posts');
    const result = await posts.create({ title, content, createdAt: new Date().toISOString() });
    
    // 3. Remove temporary post (real-time event will add the actual post)
    removePostFromUI(tempPost.id);
    
  } catch (error) {
    // 4. Handle error - mark temp post as failed
    const tempElement = document.getElementById('post-' + tempPost.id);
    if (tempElement) {
      tempElement.classList.add('error');
      tempElement.querySelector('.post-meta').innerHTML += '<span class="error">Failed to save</span>';
    }
  }
}

// ⭐ Real-time Event Logging for Debugging
function logEvent(type, data) {
  const timestamp = new Date().toLocaleTimeString();
  const logEntry = `[${timestamp}] ${type}: ${JSON.stringify(data)}`;
  console.log('📡 Real-time event:', logEntry);
  
  // Add to visual log
  const entry = document.createElement('div');
  entry.innerHTML = `
    <span class="timestamp">[${timestamp}]</span> 
    <span class="event-type">${type}</span>: 
    ${JSON.stringify(data, null, 2)}
  `;
  eventLogElement.appendChild(entry);
  eventLogElement.scrollTop = eventLogElement.scrollHeight;
  
  // Keep only recent entries
  while (eventLogElement.children.length > 20) {
    eventLogElement.removeChild(eventLogElement.firstChild);
  }
}

// ⭐ Connection Management
function toggleRealtime() {
  if (client.isConnected) {
    client.disconnectRealtime();
    updateConnectionStatus('disconnected');
  } else {
    updateConnectionStatus('connecting');
    client.connectRealtime();
  }
}

function updateConnectionStatus(status) {
  const statusElement = document.getElementById('realtime-status');
  statusElement.textContent = status === 'connected' ? '🟢 Live' : 
                            status === 'connecting' ? '🟡 Connecting...' : '🔴 Offline';
  statusElement.className = 'realtime-status ' + status;
}
```

## What you get

### Built-in endpoints (from userDOWorker)
- `POST /api/signup` - Create user account
- `POST /api/login` - Authenticate user  
- `POST /api/logout` - End user session
- `GET /api/me` - Get current user info
- `POST /api/password-reset/request` - Generate reset token
- `POST /api/password-reset/confirm` - Reset password with token
- `GET /data` - Get user's key-value data
- `POST /data` - Set user's key-value data
- **`GET /api/events` - Real-time events stream (Server-Sent Events)**

### Custom endpoints (added by this example)
- `GET /api/posts` - List user's posts
- `POST /api/posts` - Create a new post
- `PUT /api/posts/:id` - Update a post
- `DELETE /api/posts/:id` - Delete a post
- **`GET /api/notifications` - Get user's notifications**
- **`PUT /api/notifications/:id/read` - Mark notification as read**
- **`DELETE /api/notifications` - Clear all notifications**
- **`POST /api/demo/broadcast` - Send broadcast message (demo)**

## Real-time event types

All data operations automatically broadcast events that can be consumed by connected clients:

### Table Events
```ts
// When posts are modified
'table:posts:create'   // { id, title, content, createdAt, userId }
'table:posts:update'   // { id, title, content, createdAt, userId }
'table:posts:delete'   // { id, userId }

// When notifications are modified  
'table:notifications:create'  // { id, message, type, createdAt, read, userId }
'table:notifications:update'  // { id, message, type, createdAt, read, userId }
'table:notifications:delete'  // { id, userId }
```

### Key-Value Events
```ts
'kv:set'    // { key, value, userId }
'kv:delete' // { key, userId }
```

### Connection Events
```ts
'realtime:connected'    // Connection established
'realtime:disconnected' // Connection lost
'realtime:error'        // Connection error
```

### Authentication Events
```ts
// Via client.onAuthStateChanged()
'auth:login'    // User logged in
'auth:logout'   // User logged out
'auth:refresh'  // Token refreshed
```

## Database operations with real-time events

The example demonstrates both table operations and key-value storage, all with automatic real-time broadcasting:

### Table operations (with automatic events)
```ts
// Create (broadcasts: table:posts:create)
const post = await this.posts.create({ title, content, createdAt });

// Update (broadcasts: table:posts:update)
const updated = await this.posts.update(id, { title, content });

// Delete (broadcasts: table:posts:delete)
await this.posts.delete(id);

// Query (no events - read-only)
const posts = await this.posts.orderBy('createdAt', 'desc').get();
const post = await this.posts.findById(id);
const filtered = await this.posts.where('title', '==', 'Hello').get();
```

### Key-value storage (with automatic events)
```ts
// Set (broadcasts: kv:set)
await this.set('preferences', { theme: 'dark', language: 'en' });

// Get (no events - read-only)
const preferences = await this.get('preferences');

// Delete (broadcasts: kv:delete)
await this.delete('preferences');
```

## Advanced real-time patterns

### 1. Event Filtering and Routing
```ts
// Listen only to specific event types
client.on('table:posts:create', handleNewPost);
client.on('table:posts:update', handleUpdatedPost);
client.on('table:posts:delete', handleDeletedPost);

// Handle all table events for a specific table
client.onTableEvent('posts', (operation, data) => {
  switch (operation) {
    case 'create':
      handleNewPost(data);
      break;
    case 'update':
      handleUpdatedPost(data);
      break;
    case 'delete':
      handleDeletedPost(data);
      break;
  }
});

// Handle all events
client.onAnyEvent((eventType, data) => {
  logEvent(eventType, data);
  
  // Custom routing logic
  if (eventType.startsWith('table:')) {
    handleTableEvent(eventType, data);
  } else if (eventType.startsWith('kv:')) {
    handleKVEvent(eventType, data);
  }
});
```

### 2. Real-time Collaboration Features
```ts
// Show who's online
client.on('user:online', (userData) => {
  addUserToOnlineList(userData);
});

client.on('user:offline', (userData) => {
  removeUserFromOnlineList(userData);
});

// Show live typing indicators
let typingTimeout;
function handleTyping() {
  clearTimeout(typingTimeout);
  client.broadcast('user:typing', { postId: currentPostId });
  
  typingTimeout = setTimeout(() => {
    client.broadcast('user:stopped_typing', { postId: currentPostId });
  }, 3000);
}

client.on('user:typing', (data) => {
  showTypingIndicator(data.userId, data.postId);
});

// Live cursor/selection sharing
function handleSelection() {
  const selection = window.getSelection();
  client.broadcast('user:selection', {
    postId: currentPostId,
    start: selection.anchorOffset,
    end: selection.focusOffset
  });
}
```

### 3. Conflict Resolution
```ts
// Handle conflicting updates
client.on('table:posts:update', (data) => {
  const localPost = getLocalPost(data.id);
  
  if (localPost && localPost.lastModified > data.updatedAt) {
    // Local version is newer - show conflict resolution UI
    showConflictResolution(localPost, data);
  } else {
    // Remote version is newer - apply update
    updatePostInUI(data);
  }
});

function showConflictResolution(localVersion, remoteVersion) {
  const modal = createConflictModal();
  modal.innerHTML = `
    <h3>Conflict Detected</h3>
    <div class="conflict-versions">
      <div class="local-version">
        <h4>Your Version</h4>
        <p>${localVersion.content}</p>
        <button onclick="resolveConflict('local', '${localVersion.id}')">Keep Mine</button>
      </div>
      <div class="remote-version">
        <h4>Remote Version</h4>
        <p>${remoteVersion.content}</p>
        <button onclick="resolveConflict('remote', '${remoteVersion.id}')">Use Theirs</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}
```

### 4. Offline/Online Handling
```ts
// Queue operations when offline
let offlineQueue = [];

function handleOfflineOperation(operation) {
  if (client.isConnected) {
    return operation();
  } else {
    offlineQueue.push(operation);
    showOfflineIndicator();
  }
}

// Process queue when reconnected
client.on('realtime:connected', async () => {
  hideOfflineIndicator();
  
  // Process offline queue
  for (const operation of offlineQueue) {
    try {
      await operation();
    } catch (error) {
      console.error('Failed to sync offline operation:', error);
    }
  }
  offlineQueue = [];
});

// Show offline indicator
function showOfflineIndicator() {
  const indicator = document.getElementById('offline-indicator');
  indicator.style.display = 'block';
  indicator.textContent = `📱 Offline (${offlineQueue.length} pending operations)`;
}
```

### 5. Performance Optimization
```ts
// Debounce rapid events
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Debounced UI updates
const debouncedUpdatePost = debounce((data) => {
  updatePostInUI(data);
}, 100);

client.on('table:posts:update', debouncedUpdatePost);

// Batch multiple operations
let updateBatch = [];
let batchTimeout;

client.on('table:posts:update', (data) => {
  updateBatch.push(data);
  
  clearTimeout(batchTimeout);
  batchTimeout = setTimeout(() => {
    processBatchUpdates(updateBatch);
    updateBatch = [];
  }, 50);
});

function processBatchUpdates(updates) {
  // Group by post ID to avoid duplicate updates
  const latestUpdates = updates.reduce((acc, update) => {
    acc[update.id] = update;
    return acc;
  }, {});
  
  // Apply all updates at once
  Object.values(latestUpdates).forEach(updatePostInUI);
}
```

## Running the example

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Deploy to Cloudflare
npm run deploy
```

## Configuration

Update `wrangler.jsonc` with your settings:

```jsonc
{
  "name": "userdo-hono-example",
  "main": "index.tsx",
  "vars": {
    "JWT_SECRET": "your-jwt-secret-here"
  },
  "durable_objects": {
    "bindings": [
      {
        "name": "USERDO",
        "class_name": "MyAppDO"
      }
    ]
  }
}
```

## Real-time debugging tools

The example includes several debugging tools for real-time development:

### 1. Event Log
Visual real-time event stream showing all events with timestamps:
```ts
// Automatically logs all events
function logEvent(type, data) {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`📡 [${timestamp}] ${type}:`, data);
  
  // Add to visual log with syntax highlighting
  addToEventLog(timestamp, type, data);
}
```

### 2. Connection Status Indicator
Live connection status with visual feedback:
```ts
// Shows current connection state
function updateConnectionStatus(status) {
  const indicator = document.getElementById('realtime-status');
  indicator.textContent = status === 'connected' ? '🟢 Live' : 
                        status === 'connecting' ? '🟡 Connecting...' : '🔴 Offline';
  indicator.className = 'realtime-status ' + status;
}
```

### 3. Debug Console Functions
Available in browser console:
```ts
// Debug the client state
window.debugUserDO()

// Manually toggle connection
window.toggleRealtime()

// Send test broadcast
window.sendBroadcastMessage()

// Access client instance
window.userDOClient
```

### 4. Network Inspector
Monitor real-time traffic in browser DevTools:
- **Network tab**: See SSE connection to `/api/events`
- **Console**: All events logged with details
- **Application tab**: View localStorage tokens and data

## Architecture benefits

- **Minimal boilerplate**: Start with full auth + real-time system
- **Type safety**: Zod schemas ensure data integrity for all operations
- **Real-time ready**: Automatic event broadcasting with zero configuration
- **Scalable**: Per-user data isolation via Durable Objects
- **Extensible**: Add your business logic without touching core auth or real-time system
- **Performance**: Efficient Server-Sent Events with automatic reconnection
- **Developer-friendly**: Comprehensive debugging tools and clear event patterns

## Files

- `index.tsx` - Main Hono app with extended UserDO class and comprehensive real-time features
- `wrangler.jsonc` - Configuration showing single DO binding and D1 database
- `package.json` - Dependencies
- `tsconfig.json` - TypeScript configuration

## 🚀 Quick Start (Copy-Paste Ready!)

### Prerequisites
- [Bun](https://bun.sh) or [Node.js](https://nodejs.org)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)
- Cloudflare account

### Step 1: Copy the Files
Copy this entire `examples/hono/` directory to your project:
```bash
# Copy the example
cp -r examples/hono my-userdo-app
cd my-userdo-app
```

### Step 2: Install Dependencies
```bash
bun install
# or: npm install
```

### Step 3: Create a D1 Database
```bash
wrangler d1 create my_app_db
```
Update `wrangler.jsonc` with the generated database ID.

### Step 4: Set Up Authentication Secret
```bash
# Generate and set a secure JWT secret
wrangler secret put JWT_SECRET
# When prompted, enter a random 32+ character string
```

> **💡 Tip**: Use `openssl rand -base64 32` to generate a secure secret

### Step 5: Run Locally
```bash
bun run dev
# or: npm run dev
```

Visit `http://localhost:8787` to see your app with full real-time functionality!

### Step 6: Test Real-Time Features
1. **Open multiple browser tabs** to the same URL
2. **Create posts** in one tab and watch them appear in others
3. **Use the demo controls** to toggle real-time connection
4. **Check the event log** to see real-time events
5. **Send broadcast messages** and see live notifications

### Step 7: Deploy (Optional)
```bash
bun run deploy
# or: npm run deploy
```

## 🛠️ Development Setup

If you want to modify and develop:

1. **TypeScript checking**:
   ```bash
   bun run type-check
   ```

2. **Local development with hot reload**:
   ```bash
   bun run dev
   ```

## 🔧 Configuration Options

### JWT Secret Management
- **For local dev**: The example includes a placeholder in `wrangler.jsonc`
- **For production**: Remove the var and use `wrangler secret put JWT_SECRET`

### Customizing the App
- Modify `MyAppDO` class in `index.tsx` to add your business logic
- Update `wrangler.jsonc` to change the app name and configuration
- Customize the HTML/CSS in the route handlers

## Key Features Demonstrated

### 🔐 Authentication (Inherited)
- User signup/login/logout (clears refresh tokens)
- JWT token management with refresh tokens
- Protected routes with middleware

### 🗄️ Data Storage (Inherited)
- Per-user key-value storage
- Secure, isolated data per user
- No reserved key conflicts

### 🗃️ Database Tables (New)
- Posts stored in a D1-backed table
- Query with `where()` and `orderBy()` helpers

### 🧬 Custom Logic (Extended)
- Post creation and management
- User preferences system
- Your own business methods

### 📡 Real-Time Features (Enhanced)
- **Live data synchronization** via Server-Sent Events
- **Automatic event broadcasting** for all data operations
- **Real-time notifications** with read/unread states
- **Connection management** with visual status indicator
- **Event logging** for debugging and monitoring
- **Optimistic updates** for improved UX
- **Conflict resolution** for concurrent edits
- **Offline/online handling** with operation queuing

### 🎨 UI/UX
- Clean, responsive design with live updates
- Form handling and validation
- Real-time data display with animations
- Visual feedback for all operations
- Debugging tools and controls

## Extending Further

Add your own methods to `MyAppDO`:

```ts
export class MyAppDO extends UserDO {
  // Real-time todo system
  todos = this.table('todos', TodoSchema, { userScoped: true });
  
  async createTodo(title: string, completed = false) {
    const todo = await this.todos.create({
      id: Date.now(),
      title,
      completed,
      createdAt: new Date().toISOString()
    });
    
    // Send notification
    await this.notifications.create({
      message: `New todo: "${title}"`,
      type: 'success',
      createdAt: new Date().toISOString(),
      read: false,
    });
    
    return todo;
    // → table:todos:create
    // → table:notifications:create
  }

  async updateTodo(id: number, updates: Partial<Todo>) {
    const todo = await this.todos.update(id, updates);
    
    if (updates.completed) {
      await this.notifications.create({
        message: `Todo completed: "${todo.title}"`,
        type: 'success',
        createdAt: new Date().toISOString(),
        read: false,
      });
    }
    
    return todo;
    // → table:todos:update
    // → table:notifications:create (if completed)
  }

  // Real-time chat/messaging
  async sendMessage(roomId: string, message: string) {
    const chatMessage = await this.messages.create({
      roomId,
      message,
      senderId: this.userId,
      createdAt: new Date().toISOString()
    });
    
    return chatMessage;
    // → table:messages:create (all users in room will receive)
  }

  // Real-time presence
  async updatePresence(status: 'online' | 'away' | 'offline') {
    await this.set('presence', {
      status,
      lastSeen: new Date().toISOString()
    });
    
    return { ok: true };
    // → kv:set (other users can track online status)
  }
}
```

Then add routes in your Hono app to expose these methods via HTTP endpoints, and corresponding client-side event handlers for real-time updates.

## Why This Pattern?

- **Simpler setup**: One DO binding instead of two
- **Better cohesion**: Auth and business logic together
- **Easier development**: No coordination between separate DOs
- **Less complexity**: Single source of truth per user
- **More intuitive**: Natural inheritance pattern 
- **Real-time ready**: Automatic event broadcasting with zero configuration
- **Complete system**: Authentication + data + real-time in one package

## ⚡️ JWT_SECRET: Dev vs Production (TL;DR)

- **For local dev:**  
  Add to `wrangler.jsonc`:
  ```jsonc
  "vars": { "JWT_SECRET": "your-jwt-secret-here" }
  ```
- **For production:**  
  1. Remove the var and use `wrangler secret put JWT_SECRET`
  2. Deploy.

> **Note:**  
> You can't have both a var and a secret with the same name at once.

---

**Security:**  
- **For local development:**
  - Add `JWT_SECRET` to your `wrangler.jsonc` under `vars` for easy dev and copy-paste.
  - Example:
    ```jsonc
    "vars": {
      "JWT_SECRET": "your-jwt-secret-here"
    }
    ```
- **For production deployment:**
  1. **Remove** (or comment out) the `JWT_SECRET` line from your `wrangler.jsonc`.
  2. Set your real secret with:
     ```sh
     wrangler secret put JWT_SECRET
     ```
  3. Deploy as usual.

**You cannot have both a var and a secret with the same name at the same time.**

### Quick Switch Workflow
1. For dev: keep the var in your config.
2. Before prod deploy: remove the var, set the secret, then deploy.
3. After deploy: you can add the var back for local dev if needed.

---

## Security Notice (updated)

- The `wrangler.jsonc` file in this repo uses a placeholder JWT secret for demonstration and local development only.
- **Before deploying to production, you must remove the JWT_SECRET var from wrangler.jsonc and set it as a secret with `wrangler secret put JWT_SECRET`.**
- Never use the example secret in a real deployment.
- For live demos, secrets are rotated and demo data is periodically reset for security.

## Real-Time Performance Notes

- **Server-Sent Events**: More efficient than WebSockets for one-way data flow
- **Per-user isolation**: Events are automatically filtered by user
- **Automatic reconnection**: Client handles connection drops gracefully
- **Event ordering**: Events are delivered in the order they occur
- **Memory efficient**: Events are not stored, only broadcast to active connections
- **Scalable**: Durable Objects handle connection management automatically

This comprehensive real-time system makes it easy to build collaborative, live-updating applications with minimal setup and maximum developer experience. 