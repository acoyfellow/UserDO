<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';

interface Task {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  createdAt: string;
}

const client = ref<any>(null);
const user = ref<any>(null);
const tasks = ref<Task[]>([]);
const newTaskTitle = ref('');
const newTaskDescription = ref('');
const loading = ref(false);
const email = ref('');
const password = ref('');
const appState = ref<'loading' | 'client-loading' | 'auth-checking' | 'authenticated' | 'unauthenticated'>('loading');

function loadTasks() {
  fetch('/api/tasks')
    .then(res => res.json())
    .then(data => {
      if (data.ok) tasks.value = data.tasks;
    });
}

onMounted(() => {
  appState.value = 'client-loading';
  const script = document.createElement('script');
  script.type = 'module';
  script.innerHTML = `
    import { UserDOClient } from 'https://unpkg.com/userdo@latest/dist/src/client.bundle.js';
    window.UserDOClient = UserDOClient;
    window.dispatchEvent(new Event('userdo-loaded'));
  `;
  document.head.appendChild(script);

  const handleLoad = () => {
    appState.value = 'auth-checking';
    const userDOClient = new (window as any).UserDOClient('/api');
    client.value = userDOClient;
    userDOClient.onAuthStateChanged((u: any) => {
      user.value = u;
      if (u) {
        appState.value = 'authenticated';
        loadTasks();
      } else {
        appState.value = 'unauthenticated';
        tasks.value = [];
      }
    });
  };

  window.addEventListener('userdo-loaded', handleLoad);
  onBeforeUnmount(() => {
    window.removeEventListener('userdo-loaded', handleLoad);
    document.head.removeChild(script);
  });
});

async function handleLogin(e: Event) {
  e.preventDefault();
  if (!client.value) return;
  loading.value = true;
  appState.value = 'auth-checking';
  try {
    await client.value.login(email.value, password.value);
    email.value = '';
    password.value = '';
  } catch (err: any) {
    alert('Login failed: ' + err.message);
    appState.value = 'unauthenticated';
  }
  loading.value = false;
}

async function handleSignup(e: Event) {
  e.preventDefault();
  if (!client.value) return;
  loading.value = true;
  appState.value = 'auth-checking';
  try {
    await client.value.signup(email.value, password.value);
    email.value = '';
    password.value = '';
  } catch (err: any) {
    alert('Signup failed: ' + err.message);
    appState.value = 'unauthenticated';
  }
  loading.value = false;
}

async function handleLogout() {
  if (!client.value) return;
  try { await client.value.logout(); } catch {}
}

async function createTask(e: Event) {
  e.preventDefault();
  if (!newTaskTitle.value.trim()) return;
  loading.value = true;
  const res = await fetch('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: newTaskTitle.value, description: newTaskDescription.value })
  });
  const data = await res.json();
  if (data.ok) {
    tasks.value.unshift(data.data);
    newTaskTitle.value = '';
    newTaskDescription.value = '';
  }
  loading.value = false;
}

async function toggleTask(id: string) {
  const res = await fetch(`/api/tasks/${id}/toggle`, { method: 'POST' });
  if (res.ok) {
    tasks.value = tasks.value.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
  }
}

async function deleteTask(id: string) {
  const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
  if (res.ok) {
    tasks.value = tasks.value.filter(t => t.id !== id);
  }
}
</script>

<template>
  <div v-if="appState === 'loading' || appState === 'client-loading'" class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
    <div class="text-center">
      <div class="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
      <h1 class="text-2xl font-bold text-gray-900 mb-2">UserDO</h1>
      <p class="text-gray-600">{{ appState === 'loading' ? 'Initializing...' : 'Loading client...' }}</p>
    </div>
  </div>

  <div v-else-if="appState === 'auth-checking'" class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
    <div class="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
  </div>

  <div v-else-if="appState === 'unauthenticated'" class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
    <div class="w-full space-y-8">
      <div class="text-center">
        <h1 class="text-4xl font-bold text-gray-900 mb-2">vue + vite + userdo</h1>
        <p class="text-lg text-gray-600">Task Manager</p>
      </div>
      <div class="bg-white rounded-2xl shadow-xl p-8 max-w-md mx-auto">
        <form @submit="handleLogin" class="space-y-4">
          <input type="email" v-model="email" placeholder="Email" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"/>
          <input type="password" v-model="password" placeholder="Password" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"/>
          <div class="flex space-x-3">
            <button type="submit" :disabled="loading || !email || !password" class="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">{{ loading ? 'Please wait...' : 'Sign In' }}</button>
            <button type="button" @click="handleSignup" :disabled="loading || !email || !password" class="flex-1 bg-green-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">{{ loading ? 'Please wait...' : 'Sign Up' }}</button>
          </div>
        </form>
      </div>
    </div>
  </div>

  <div v-else class="min-h-screen bg-gray-50">
    <header class="bg-white border-b border-gray-100">
      <div class="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">vue + vite + userdo</h1>
          <p class="text-sm text-gray-600">Task Manager</p>
        </div>
        <div class="flex items-center space-x-4">
          <span class="text-sm text-gray-600">Welcome, {{ user?.email }}</span>
          <button @click="handleLogout" class="bg-red-100 text-red-700 px-3 py-1 rounded-md text-sm font-medium hover:bg-red-200 transition-colors">Logout</button>
        </div>
      </div>
    </header>

    <main class="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 class="text-xl font-semibold text-gray-900 mb-4">Add New Task</h2>
        <form @submit="createTask" class="space-y-4">
          <input type="text" v-model="newTaskTitle" placeholder="What needs to be done?" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-lg"/>
          <textarea v-model="newTaskDescription" placeholder="Add a description (optional)" rows="3" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors resize-none"/>
          <button type="submit" :disabled="loading" class="bg-blue-600 px-6 py-3 rounded-lg font-semibold text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">{{ loading ? 'Adding...' : '+ Add Task' }}</button>
        </form>
      </div>

      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-semibold text-gray-900">Your Tasks</h2>
          <span class="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm font-medium">{{ tasks.length }} {{ tasks.length === 1 ? 'task' : 'tasks' }}</span>
        </div>
        <div v-if="tasks.length === 0" class="text-center py-12">
          <div class="text-6xl mb-4">🎯</div>
          <h3 class="text-lg font-medium text-gray-900 mb-2">No tasks yet!</h3>
          <p class="text-gray-600">Create your first task above to get started.</p>
        </div>
        <div v-else class="space-y-3">
          <div v-for="task in tasks" :key="task.id" class="flex items-start space-x-4 p-4 rounded-lg border transition-all" :class="task.completed ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-200 hover:border-gray-300'">
            <div class="flex-shrink-0 mt-1">
              <input type="checkbox" :checked="task.completed" @change="toggleTask(task.id)" class="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2" />
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="text-lg font-medium" :class="task.completed ? 'text-gray-500 line-through' : 'text-gray-900'">{{ task.title }}</h3>
              <p v-if="task.description" class="mt-1 text-sm" :class="task.completed ? 'text-gray-400' : 'text-gray-600'">{{ task.description }}</p>
              <p class="mt-2 text-xs text-gray-400">Created {{ new Date(task.createdAt).toLocaleDateString() }}</p>
            </div>
            <div class="flex-shrink-0">
              <button @click="deleteTask(task.id)" class="text-gray-400 hover:text-red-500 p-2 rounded-md hover:bg-red-50 transition-colors" title="Delete task">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style>
@import './App.css';
</style>
