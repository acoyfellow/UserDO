import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

export const Route = createFileRoute('/todos')({
  component: TodosPage,
})

type Todo = {
  id: string
  text: string
  completed: boolean
  createdAt: string
}

function TodosPage() {
  const [text, setText] = useState('')
  const queryClient = useQueryClient()

  const { data: todos = [], isLoading, error } = useQuery({
    queryKey: ['todos'],
    queryFn: async (): Promise<Todo[]> => {
      const response = await fetch('/api/todos')
      if (!response.ok) throw new Error('Failed to fetch todos')
      const data = await response.json()
      return data.todos
    }
  })

  const addTodo = useMutation({
    mutationFn: async (text: string) => {
      const response = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      })
      if (!response.ok) throw new Error('Failed to add todo')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] })
      setText('')
    }
  })

  const toggleTodo = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const response = await fetch(`/api/todos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed })
      })
      if (!response.ok) throw new Error('Failed to toggle todo')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] })
    }
  })

  const deleteTodo = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/todos/${id}`, {
        method: 'DELETE'
      })
      if (!response.ok) throw new Error('Failed to delete todo')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] })
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (text.trim()) {
      addTodo.mutate(text.trim())
    }
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="text-red-800 font-medium">Error</h2>
          <p className="text-red-600">{(error as Error).message}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-8 text-white">
          <h1 className="text-3xl font-bold mb-2">✅ Todo App</h1>
          <p className="text-blue-100">Built with UserDO + TanStack Start + TanStack Query</p>
        </div>

        <div className="p-8">
          <form onSubmit={handleSubmit} className="flex gap-3 mb-8">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="What needs to be done?"
              className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-full focus:border-blue-500 focus:outline-none transition-colors"
              disabled={addTodo.isPending}
            />
            <button
              type="submit"
              disabled={addTodo.isPending || !text.trim()}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-full font-medium hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {addTodo.isPending ? 'Adding...' : 'Add Todo'}
            </button>
          </form>

          {isLoading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <p className="mt-4 text-gray-600">Loading todos...</p>
            </div>
          ) : todos.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📝</div>
              <h3 className="text-xl font-medium text-gray-700 mb-2">No todos yet!</h3>
              <p className="text-gray-500">Add your first todo above to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {todos.map((todo) => (
                <div
                  key={todo.id}
                  className={`p-4 rounded-xl border-2 transition-all hover:shadow-md ${todo.completed
                    ? 'bg-gray-50 border-gray-200'
                    : 'bg-white border-gray-200 hover:border-blue-300'
                    }`}
                >
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => toggleTodo.mutate({ id: todo.id, completed: !todo.completed })}
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${todo.completed
                        ? 'bg-blue-500 border-blue-500 text-white'
                        : 'border-gray-300 hover:border-blue-500'
                        }`}
                      disabled={toggleTodo.isPending}
                    >
                      {todo.completed && '✓'}
                    </button>

                    <span
                      className={`flex-1 transition-all ${todo.completed
                        ? 'text-gray-500 line-through'
                        : 'text-gray-900'
                        }`}
                    >
                      {todo.text}
                    </span>

                    <button
                      onClick={() => deleteTodo.mutate(todo.id)}
                      className="w-8 h-8 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors flex items-center justify-center"
                      disabled={deleteTodo.isPending}
                      title="Delete todo"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 