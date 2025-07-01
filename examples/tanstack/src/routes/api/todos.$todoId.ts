import { createServerFileRoute } from '@tanstack/react-start/server'
import { json } from '@tanstack/react-start'
import { z } from 'zod'
import { getTodoDO } from '~/utils/bindings'

// Mock user for demo - in real app this would come from auth
const mockUser = { email: 'demo@example.com' }

// Simple in-memory storage for development (shared with todos.ts)
declare global {
  var todos: Array<{ id: string; text: string; completed: boolean; createdAt: string }>
}

if (!global.todos) {
  global.todos = []
}

const UpdateTodoSchema = z.object({
  completed: z.boolean().optional(),
  text: z.string().optional(),
})

export const ServerRoute = createServerFileRoute('/api/todos/$todoId')
  .methods({
    PUT: async ({ request, params }) => {
      const { todoId } = params
      const body = await request.json()
      const updates = UpdateTodoSchema.parse(body)

      const todoDO = getTodoDO(mockUser.email)

      if (updates.completed !== undefined) {
        await todoDO.toggle(todoId, updates.completed)
      }

      return json({ ok: true })
    },
    DELETE: async ({ params }) => {
      const { todoId } = params

      const todoDO = getTodoDO(mockUser.email)
      await todoDO.remove(todoId)

      return json({ ok: true })
    },
  }) 