import { createServerFileRoute } from '@tanstack/react-start/server'
import { json } from '@tanstack/react-start'
import { z } from 'zod'
import { getTodoDO } from '~/utils/bindings'

// Mock user for demo - in real app this would come from auth
const mockUser = { email: 'demo@example.com' }

// Simple in-memory storage for development
// In production, this would be replaced with UserDO
declare global {
  var todos: Array<{ id: string; text: string; completed: boolean; createdAt: string }>
}

if (!global.todos) {
  global.todos = []
}

const CreateTodoSchema = z.object({
  text: z.string().min(1),
})

export const ServerRoute = createServerFileRoute('/api/todos')
  .methods({
    GET: async ({ request }) => {
      const todoDO = getTodoDO(mockUser.email)
      const todos = await todoDO.list()
      return json({ todos })
    },
    POST: async ({ request }) => {
      const body = await request.json()
      const { text } = CreateTodoSchema.parse(body)

      const todoDO = getTodoDO(mockUser.email)
      const todo = await todoDO.add(text)

      return json({ todo })
    },
  }) 