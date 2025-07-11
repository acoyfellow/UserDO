<script lang="ts">
  import { onMount } from 'svelte';

  interface Task {
    id: string;
    title: string;
    description: string;
    completed: boolean;
    createdAt: string;
  }

  let client: any = null;
  let user: any = null;
  let tasks: Task[] = [];
  let newTaskTitle = '';
  let newTaskDescription = '';
  let loading = false;
  let email = '';
  let password = '';
  let appState: 'loading' | 'client-loading' | 'auth-checking' | 'authenticated' | 'unauthenticated' = 'loading';

  onMount(() => {
    appState = 'client-loading';
    const script = document.createElement('script');
    script.type = 'module';
    script.innerHTML = `
      import { UserDOClient } from 'https://unpkg.com/userdo@latest/dist/src/client.bundle.js';
      window.UserDOClient = UserDOClient;
      window.dispatchEvent(new Event('userdo-loaded'));
    `;
    document.head.appendChild(script);

    const handleClientLoad = () => {
      appState = 'auth-checking';
      // @ts-ignore
      client = new window.UserDOClient('/api');
      client.onAuthStateChanged((userData: any) => {
        user = userData;
        if (userData) {
          appState = 'authenticated';
          loadTasks();
        } else {
          appState = 'unauthenticated';
          tasks = [];
        }
      });
    };

    window.addEventListener('userdo-loaded', handleClientLoad);
    return () => {
      window.removeEventListener('userdo-loaded', handleClientLoad);
      document.head.removeChild(script);
    };
  });

  async function handleLogin(e: Event) {
    e.preventDefault();
    if (!client) return;
    loading = true;
    appState = 'auth-checking';
    try {
      await client.login(email, password);
      email = '';
      password = '';
    } catch (err: any) {
      alert('Login failed: ' + err.message);
      appState = 'unauthenticated';
    }
    loading = false;
  }

  async function handleSignup(e: Event) {
    e.preventDefault();
    if (!client) return;
    loading = true;
    appState = 'auth-checking';
    try {
      await client.signup(email, password);
      email = '';
      password = '';
    } catch (err: any) {
      alert('Signup failed: ' + err.message);
      appState = 'unauthenticated';
    }
    loading = false;
  }

  async function handleLogout() {
    if (!client) return;
    await client.logout();
  }

  async function loadTasks() {
    const res = await fetch('/api/tasks');
    const data = await res.json();
    if (data.ok) tasks = data.tasks;
  }

  async function createTask(e: Event) {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    loading = true;
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTaskTitle, description: newTaskDescription })
    });
    const data = await res.json();
    if (data.ok) {
      tasks = [data.data, ...tasks];
      newTaskTitle = '';
      newTaskDescription = '';
    }
    loading = false;
  }

  async function toggleTask(id: string) {
    await fetch(`/api/tasks/${id}/toggle`, { method: 'POST' });
    tasks = tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
  }

  async function deleteTask(id: string) {
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    tasks = tasks.filter(t => t.id !== id);
  }
</script>

<style>
  @import 'tailwindcss';
</style>

{#if appState === 'loading' || appState === 'client-loading' || appState === 'auth-checking'}
  <div class="min-h-screen flex items-center justify-center">Loading...</div>
{:else if appState === 'unauthenticated'}
  <div class="min-h-screen flex items-center justify-center p-4">
    <form class="space-y-4" on:submit|preventDefault={handleLogin}>
      <input class="border p-2" placeholder="Email" bind:value={email} />
      <input class="border p-2" type="password" placeholder="Password" bind:value={password} />
      <div class="flex space-x-2">
        <button class="bg-blue-600 text-white px-4 py-2" on:click={handleLogin} disabled={loading}>Sign In</button>
        <button class="bg-green-600 text-white px-4 py-2" on:click={handleSignup} disabled={loading}>Sign Up</button>
      </div>
    </form>
  </div>
{:else}
  <div class="min-h-screen bg-gray-50">
    <header class="bg-white border-b p-4 flex justify-between">
      <h1 class="font-bold">svelte + vite + userdo</h1>
      <button class="text-sm" on:click={handleLogout}>Logout</button>
    </header>
    <main class="max-w-2xl mx-auto p-4 space-y-8">
      <form class="space-y-2" on:submit|preventDefault={createTask}>
        <input class="w-full border p-2" placeholder="Task title" bind:value={newTaskTitle} required />
        <textarea class="w-full border p-2" rows="3" placeholder="Description" bind:value={newTaskDescription}></textarea>
        <button class="bg-blue-600 text-white px-4 py-2" disabled={loading}>{loading ? 'Adding...' : '+ Add Task'}</button>
      </form>
      <ul class="space-y-2">
        {#each tasks as task}
          <li class="bg-white border p-3 flex justify-between items-start">
            <div>
              <label class="flex items-center space-x-2">
                <input type="checkbox" checked={task.completed} on:change={() => toggleTask(task.id)} />
                <span class={task.completed ? 'line-through text-gray-400' : ''}>{task.title}</span>
              </label>
              {#if task.description}
                <p class="text-sm text-gray-500 ml-6">{task.description}</p>
              {/if}
            </div>
            <button class="text-red-500" on:click={() => deleteTask(task.id)}>Delete</button>
          </li>
        {/each}
      </ul>
    </main>
  </div>
{/if}
