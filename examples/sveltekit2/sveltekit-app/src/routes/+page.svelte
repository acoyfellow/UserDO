<script lang="ts">
  import { onMount } from "svelte";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  // Initialize from SSR data
  let user: any = $state(data.user || null);
  let posts: any[] = $state(data.posts || []);

  // Form states
  let newTitle = $state("");
  let newContent = $state("");
  let email = $state("");
  let password = $state("");
  let loading = $state(false);
  let error = $state("");
  let postLoading = $state(false);

  // Client-side enhancement state
  let clientReady = $state(false);
  let useClientSide = $state(false); // Toggle for demo purposes
  let client: any = null; // Will be loaded dynamically
  let ws: WebSocket | null = null;
  let wsConnected = $state(false);

  onMount(async () => {
    console.log("🚀 Component mounted with SSR data:", {
      user: user?.email,
      postsCount: posts.length,
    });

    // Dynamically import the client to avoid SSR issues
    try {
      const { client: userDOClient } = await import("../lib/make-client");
      client = userDOClient;
      console.log("✅ UserDO client loaded dynamically");

      // Set up auth state listener only for client-side mode
      // For server-side mode, we rely on SSR data and don't need client auth checks
      if (useClientSide) {
        client.onAuthStateChanged((authUser: any) => {
          user = authUser;
          console.log(
            "🔐 Auth state changed:",
            authUser?.email || "logged out",
          );
        });
      }

      clientReady = true;
    } catch (err) {
      console.error("❌ Failed to load UserDO client:", err);
    }

    // Set up WebSocket connection for real-time updates
    if (user) {
      setupWebSocket();
    }
  });

  function setupWebSocket() {
    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/api/ws`;

      console.log("🔌 Connecting to WebSocket:", wsUrl);
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log("✅ WebSocket connected");
        wsConnected = true;
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log("📡 WebSocket message received:", message);

          // Handle post changes
          if (message.event === "table:posts") {
            console.log("🔄 Posts updated via WebSocket, refreshing...");
            refreshPosts();
          }
        } catch (error) {
          console.error("❌ Error processing WebSocket message:", error);
        }
      };

      ws.onerror = (error) => {
        console.error("❌ WebSocket error:", error);
        wsConnected = false;
      };

      ws.onclose = () => {
        console.log("🔌 WebSocket disconnected");
        wsConnected = false;

        // Attempt to reconnect after 3 seconds if user is still logged in
        if (user) {
          setTimeout(() => {
            console.log("🔄 Attempting to reconnect WebSocket...");
            setupWebSocket();
          }, 3000);
        }
      };
    } catch (error) {
      console.error("❌ Failed to setup WebSocket:", error);
    }
  }

  function closeWebSocket() {
    if (ws) {
      ws.close();
      ws = null;
      wsConnected = false;
    }
  }

  // ======================
  // SERVER-SIDE FUNCTIONS (using Universal Proxy to UserDO)
  // ======================

  async function serverSideSignup() {
    try {
      loading = true;
      error = "";
      console.log("📝 Server-side signup via Universal Proxy...");

      const response = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorData = (await response
          .json()
          .catch(() => ({ error: "Unknown error" }))) as { error?: string };
        throw new Error(errorData.error || response.statusText);
      }

      const data = (await response.json()) as { user: any };
      user = data.user;
      console.log("✅ Server-side signup successful:", user);

      // Reload page to get fresh SSR data
      window.location.reload();
    } catch (err: any) {
      console.error("❌ Server-side signup failed:", err);
      error = err.message || "Signup failed";
    } finally {
      loading = false;
    }
  }

  async function serverSideLogin() {
    try {
      loading = true;
      error = "";
      console.log("🔐 Server-side login via Universal Proxy...");

      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorData = (await response
          .json()
          .catch(() => ({ error: "Unknown error" }))) as { error?: string };
        throw new Error(errorData.error || response.statusText);
      }

      const data = (await response.json()) as { user: any };
      user = data.user;
      console.log("✅ Server-side login successful:", user);

      // Reload page to get fresh SSR data
      window.location.reload();
    } catch (err: any) {
      console.error("❌ Server-side login failed:", err);
      error = err.message || "Login failed";
    } finally {
      loading = false;
    }
  }

  async function serverSideLogout() {
    try {
      console.log("🚪 Server-side logout via Universal Proxy...");

      const response = await fetch("/api/logout", {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = (await response
          .json()
          .catch(() => ({ error: "Unknown error" }))) as { error?: string };
        throw new Error(errorData.error || response.statusText);
      }

      console.log("✅ Server-side logout successful - redirecting");

      user = null;
      posts = [];
      closeWebSocket();
    } catch (err: any) {
      console.error("❌ Server-side logout failed:", err);
      error = err.message || "Logout failed";
    }
  }

  // ======================
  // CLIENT-SIDE FUNCTIONS (using UserDO client)
  // ======================

  async function clientSideSignup() {
    if (!client) {
      error = "Client not ready";
      return;
    }

    try {
      loading = true;
      error = "";
      console.log("📝 Client-side signup via UserDO client...");

      await client.signup(email, password);
      console.log("✅ Client-side signup successful");

      email = "";
      password = "";
    } catch (err: any) {
      console.error("❌ Client-side signup failed:", err);
      error = err.message || "Signup failed";
    } finally {
      loading = false;
    }
  }

  async function clientSideLogin() {
    if (!client) {
      error = "Client not ready";
      return;
    }

    try {
      loading = true;
      error = "";
      console.log("🔐 Client-side login via UserDO client...");

      const { user: userData } = await client.login(email, password);
      user = userData;
      console.log("✅ Client-side login successful");

      email = "";
      password = "";
    } catch (err: any) {
      console.error("❌ Client-side login failed:", err);
      error = err.message || "Login failed";
    } finally {
      loading = false;
    }
  }

  async function clientSideLogout() {
    if (!client) {
      error = "Client not ready";
      return;
    }

    try {
      console.log("🚪 Client-side logout via UserDO client...");

      await client.logout();
      user = null;
      posts = [];
      closeWebSocket();
      console.log("✅ Client-side logout successful");
    } catch (err: any) {
      console.error("❌ Client-side logout failed:", err);
      error = err.message || "Logout failed";
    }
  }

  // ======================
  // POST MANAGEMENT FUNCTIONS
  // ======================

  async function createPost() {
    if (!newTitle.trim() || !newContent.trim()) {
      error = "Please enter both title and content";
      return;
    }

    try {
      postLoading = true;
      error = "";
      console.log("📝 Creating post:", {
        title: newTitle,
        content: newContent,
      });

      const response = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title: newTitle, content: newContent }),
      });

      if (!response.ok) {
        const errorData = (await response
          .json()
          .catch(() => ({ error: "Unknown error" }))) as { error?: string };
        throw new Error(errorData.error || response.statusText);
      }

      const data = (await response.json()) as { post: any };
      console.log("✅ Post created successfully:", data.post);

      // Add the new post to the beginning of the posts array
      posts = [data.post, ...posts];

      // Clear form
      newTitle = "";
      newContent = "";
    } catch (err: any) {
      console.error("❌ Failed to create post:", err);
      error = err.message || "Failed to create post";
    } finally {
      postLoading = false;
    }
  }

  async function deletePost(postId: string) {
    if (!confirm("Are you sure you want to delete this post?")) {
      return;
    }

    try {
      console.log("🗑️ Deleting post:", postId);

      const response = await fetch(`/api/posts/${postId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = (await response
          .json()
          .catch(() => ({ error: "Unknown error" }))) as { error?: string };
        throw new Error(errorData.error || response.statusText);
      }

      console.log("✅ Post deleted successfully");

      // Remove the post from the posts array
      posts = posts.filter((post) => post.id !== postId);
    } catch (err: any) {
      console.error("❌ Failed to delete post:", err);
      error = err.message || "Failed to delete post";
    }
  }

  async function refreshPosts() {
    try {
      console.log("🔄 Refreshing posts...");

      const response = await fetch("/api/posts", {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch posts");
      }

      const data = (await response.json()) as { posts: any[] };
      posts = data.posts || [];
      console.log("✅ Posts refreshed:", posts.length);
    } catch (err: any) {
      console.error("❌ Failed to refresh posts:", err);
      error = err.message || "Failed to refresh posts";
    }
  }

  // ======================
  // UI HELPER FUNCTIONS
  // ======================

  function signup() {
    return useClientSide ? clientSideSignup() : serverSideSignup();
  }

  function login() {
    return useClientSide ? clientSideLogin() : serverSideLogin();
  }

  function logout() {
    return useClientSide ? clientSideLogout() : serverSideLogout();
  }
</script>

<div class="max-w-6xl mx-auto p-4 sm:p-8 font-sans">
  <!-- Technical Info - Minimal & Top -->
  <div class="mb-6 p-3 bg-slate-50 rounded-lg border border-slate-200 text-sm">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="flex items-center gap-4">
        <span class="font-medium">🏗️ SvelteKit + UserDO</span>
        <span class="text-slate-600"
          >Auth: {useClientSide ? "Client-side" : "Server-side"}</span
        >
      </div>
      <div class="flex items-center gap-3 text-xs">
        <span class="text-slate-600">Client: {clientReady ? "✅" : "⏳"}</span>
        <span class="text-slate-600">User: {user ? "✅" : "❌"}</span>
        <span class="text-slate-600">WS: {wsConnected ? "✅" : "❌"}</span>
      </div>
    </div>
  </div>

  <header class="text-center mb-8">
    <h1 class="text-blue-600 text-3xl sm:text-4xl font-bold mb-2">
      🚀 SvelteKit + UserDO Demo
    </h1>
    <p class="text-gray-600 text-base sm:text-lg">
      Full-stack demo with authentication and database functionality
    </p>

    <!-- Mode Toggle -->
    <div class="my-6 p-3 bg-slate-50 rounded-lg border border-slate-200">
      <label class="flex items-center justify-center gap-2 font-medium text-sm">
        <input type="checkbox" bind:checked={useClientSide} class="w-4 h-4" />
        Use Client-Side Mode
      </label>
      <small class="block mt-1 text-slate-600 text-xs">
        {useClientSide
          ? "🔄 Direct UserDO client"
          : "🖥️ SSR via SvelteKit proxy"}
      </small>
    </div>
  </header>

  {#if error}
    <div
      class="bg-red-50 text-red-600 p-4 rounded-lg mb-8 border border-red-200"
    >
      ❌ {error}
    </div>
  {/if}

  {#if !user}
    <!-- Authentication Form -->
    <section class="bg-white p-8 rounded-xl shadow-sm mb-8">
      <h2 class="text-2xl font-semibold text-gray-800 mb-6 text-center">
        🔐 Authentication
      </h2>

      <div class="max-w-md mx-auto">
        <div class="flex flex-col gap-4">
          <input
            type="email"
            placeholder="Email"
            bind:value={email}
            disabled={loading}
            class="p-3 border border-gray-300 rounded-md text-base focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
          />
          <input
            type="password"
            placeholder="Password (min 8 chars)"
            bind:value={password}
            disabled={loading}
            class="p-3 border border-gray-300 rounded-md text-base focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
          />

          <div class="grid grid-cols-2 gap-3 mt-2">
            <button
              onclick={signup}
              disabled={loading || !email || !password}
              class="p-3 px-6 bg-blue-600 text-white border-none rounded-md text-base cursor-pointer transition-colors hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? "⏳ Signing up..." : "📝 Sign Up"}
            </button>

            <button
              onclick={login}
              disabled={loading || !email || !password}
              class="p-3 px-6 bg-green-600 text-white border-none rounded-md text-base cursor-pointer transition-colors hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? "⏳ Logging in..." : "🔑 Login"}
            </button>
          </div>
        </div>
      </div>
    </section>
  {:else}
    <!-- User Dashboard -->
    <section class="bg-white p-8 rounded-xl shadow-sm mb-8">
      <div class="text-center">
        <h2 class="text-green-600 text-2xl font-semibold mb-4">
          👋 Welcome, {user.email}!
        </h2>
        <p class="mb-4">
          User ID: <code class="bg-gray-100 px-2 py-1 rounded font-mono text-sm"
            >{user.id}</code
          >
        </p>

        <div
          class="bg-green-50 border border-green-200 rounded-lg p-4 mb-4 text-sm"
        >
          <p class="text-green-800">
            ✅ <strong>Authentication is working!</strong><br />
            ✅ <strong>Database tables and posts are implemented!</strong><br />
            ✅ <strong>Real-time WebSocket updates are active!</strong>
          </p>
        </div>

        <button
          onclick={logout}
          class="p-3 px-6 bg-red-600 text-white border-none rounded-md text-base cursor-pointer transition-colors hover:bg-red-700 mt-4"
        >
          🚪 Logout
        </button>
      </div>
    </section>

    <!-- Post Creation Form -->
    <section class="bg-white p-8 rounded-xl shadow-sm mb-8">
      <h2 class="text-2xl font-semibold text-gray-800 mb-6">
        📝 Create a Post
      </h2>

      <div class="max-w-2xl mx-auto">
        <div class="flex flex-col gap-4">
          <input
            type="text"
            placeholder="Post title"
            bind:value={newTitle}
            disabled={postLoading}
            class="p-3 border border-gray-300 rounded-md text-base focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
          />
          <textarea
            placeholder="Write your post content here..."
            bind:value={newContent}
            disabled={postLoading}
            rows="4"
            class="p-3 border border-gray-300 rounded-md text-base focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100 resize-vertical"
          ></textarea>

          <div class="flex gap-3">
            <button
              onclick={createPost}
              disabled={postLoading || !newTitle.trim() || !newContent.trim()}
              class="p-3 px-6 bg-blue-600 text-white border-none rounded-md text-base cursor-pointer transition-colors hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {postLoading ? "⏳ Creating..." : "📝 Create Post"}
            </button>

            <button
              onclick={refreshPosts}
              class="p-3 px-6 bg-gray-600 text-white border-none rounded-md text-base cursor-pointer transition-colors hover:bg-gray-700"
            >
              🔄 Refresh Posts
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- Posts Display -->
    <section class="bg-white p-8 rounded-xl shadow-sm mb-8">
      <h2 class="text-2xl font-semibold text-gray-800 mb-6">
        📚 Your Posts ({posts.length})
      </h2>

      {#if posts.length === 0}
        <div class="text-center py-8 text-gray-500">
          <p class="text-lg">No posts yet!</p>
          <p class="text-sm">Create your first post above to get started.</p>
        </div>
      {:else}
        <div class="space-y-6">
          {#each posts as post (post.id)}
            <div class="border border-gray-200 rounded-lg p-6 bg-gray-50">
              <div class="flex justify-between items-start mb-3">
                <h3 class="text-xl font-semibold text-gray-800">
                  {post.title}
                </h3>
                <button
                  onclick={() => deletePost(post.id)}
                  class="text-red-600 hover:text-red-800 text-sm px-2 py-1 rounded hover:bg-red-50 transition-colors"
                  title="Delete post"
                >
                  🗑️ Delete
                </button>
              </div>

              <p class="text-gray-700 mb-4 whitespace-pre-wrap">
                {post.content}
              </p>

              <div class="text-sm text-gray-500 flex items-center gap-4">
                <span>📅 {new Date(post.createdAt).toLocaleString()}</span>
                <span>🆔 {post.id}</span>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </section>
  {/if}
</div>
