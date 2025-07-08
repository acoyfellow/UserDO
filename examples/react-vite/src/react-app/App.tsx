import { useState, useEffect } from 'react';
import './App.css';

// We'll load UserDOClient from the CDN at runtime
declare global {
  interface Window {
    UserDOClient: any;
  }
}

interface Task {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  createdAt: string;
}

function App() {
  const [client, setClient] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [appState, setAppState] = useState<'loading' | 'client-loading' | 'auth-checking' | 'authenticated' | 'unauthenticated'>('loading');

  useEffect(() => {
    setAppState('client-loading');

    // Load UserDO client from CDN
    const script = document.createElement('script');
    script.type = 'module';
    script.innerHTML = `
      import { UserDOClient } from 'https://unpkg.com/userdo@latest/dist/src/client.bundle.js';
      window.UserDOClient = UserDOClient;
      window.dispatchEvent(new Event('userdo-loaded'));
    `;
    document.head.appendChild(script);

    const handleClientLoad = () => {
      setAppState('auth-checking');

      // Use custom WebSocket URL for development
      const isDev = window.location.port === '5173';
      const userDOClient = new window.UserDOClient('/api', {
        websocketUrl: isDev ? 'ws://localhost:8787/api/ws' : undefined
      });

      setClient(userDOClient);

      // Listen for auth state changes
      userDOClient.onAuthStateChanged((userData: any) => {
        setUser(userData);
        if (userData) {
          setAppState('authenticated');
          loadTasks();
        } else {
          setAppState('unauthenticated');
          setTasks([]);
        }
      });
    };

    window.addEventListener('userdo-loaded', handleClientLoad);
    return () => {
      window.removeEventListener('userdo-loaded', handleClientLoad);
      document.head.removeChild(script);
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client) return;

    setLoading(true);
    setAppState('auth-checking');
    try {
      await client.login(email, password);
      setEmail('');
      setPassword('');
      // Auth state will be updated by onAuthStateChanged
    } catch (error) {
      console.error('Login failed:', error);
      alert('Login failed: ' + (error as Error).message);
      setAppState('unauthenticated');
    }
    setLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client) return;

    setLoading(true);
    setAppState('auth-checking');
    try {
      await client.signup(email, password);
      setEmail('');
      setPassword('');
      // Auth state will be updated by onAuthStateChanged
    } catch (error) {
      console.error('Signup failed:', error);
      alert('Signup failed: ' + (error as Error).message);
      setAppState('unauthenticated');
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    if (!client) return;

    try {
      await client.logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const loadTasks = async () => {
    try {
      const response = await fetch('/api/tasks');
      const data = await response.json();
      if (data.ok) {
        setTasks(data.tasks);
      }
    } catch (error) {
      console.error('Failed to load tasks:', error);
    }
  };

  const createTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    setLoading(true);
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: newTaskTitle,
          description: newTaskDescription
        })
      });

      const data = await response.json();
      if (data.ok) {
        setTasks(prev => [data.data, ...prev]);
        setNewTaskTitle('');
        setNewTaskDescription('');
      }
    } catch (error) {
      console.error('Failed to create task:', error);
    }
    setLoading(false);
  };

  const toggleTask = async (taskId: string) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}/toggle`, {
        method: 'POST'
      });

      if (response.ok) {
        setTasks(prev => prev.map(task =>
          task.id === taskId ? { ...task, completed: !task.completed } : task
        ));
      }
    } catch (error) {
      console.error('Failed to toggle task:', error);
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setTasks(prev => prev.filter(task => task.id !== taskId));
      }
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  };

  // Loading states with beautiful UI
  if (appState === 'loading' || appState === 'client-loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">UserDO</h1>
          <p className="text-gray-600">
            {appState === 'loading' ? 'Initializing...' : 'Loading client...'}
          </p>
        </div>
      </div>
    );
  }

  if (appState === 'auth-checking') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          </div>
        </div>
      </div>
    );
  }

  if (appState === 'unauthenticated') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="w-full space-y-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">react + vite + userdo</h1>
            <p className="text-lg text-gray-600">Task Manager</p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md mx-auto">
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold text-gray-900 text-center">Welcome</h2>
              <div className="space-y-4">
                <input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                />
                <div className="flex space-x-3">
                  <button
                    onClick={handleLogin}
                    disabled={loading || !email || !password}
                    className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading ? 'Please wait...' : 'Sign In'}
                  </button>
                  <button
                    onClick={handleSignup}
                    disabled={loading || !email || !password}
                    className="flex-1 bg-green-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading ? 'Please wait...' : 'Sign Up'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">react + vite + userdo</h1>
            <p className="text-sm text-gray-600">Task Manager</p>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">Welcome, {user?.email}</span>
            <button
              onClick={handleLogout}
              className="bg-red-100 text-red-700 px-3 py-1 rounded-md text-sm font-medium hover:bg-red-200 transition-colors cursor-pointer"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Add New Task</h2>
          <form onSubmit={createTask} className="space-y-4">
            <input
              type="text"
              placeholder="What needs to be done?"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-lg"
            />
            <textarea
              placeholder="Add a description (optional)"
              value={newTaskDescription}
              onChange={(e) => setNewTaskDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors resize-none"
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600  px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-white cursor-pointer"
            >
              {loading ? 'Adding...' : '+ Add Task'}
            </button>
          </form>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Your Tasks</h2>
            <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm font-medium">
              {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
            </span>
          </div>

          {tasks.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🎯</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No tasks yet!</h3>
              <p className="text-gray-600">Create your first task above to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map(task => (
                <div
                  key={task.id}
                  className={`flex items-start space-x-4 p-4 rounded-lg border transition-all ${task.completed
                    ? 'bg-gray-50 border-gray-200'
                    : 'bg-white border-gray-200 hover:border-gray-300'
                    }`}
                >
                  <div className="flex-shrink-0 mt-1">
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={() => toggleTask(task.id)}
                      className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className={`text-lg font-medium ${task.completed
                      ? 'text-gray-500 line-through'
                      : 'text-gray-900'
                      }`}>
                      {task.title}
                    </h3>
                    {task.description && (
                      <p className={`mt-1 text-sm ${task.completed ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                        {task.description}
                      </p>
                    )}
                    <p className="mt-2 text-xs text-gray-400">
                      Created {new Date(task.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <button
                      onClick={() => deleteTask(task.id)}
                      className="text-gray-400 hover:text-red-500 p-2 rounded-md hover:bg-red-50 transition-colors"
                      title="Delete task"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
