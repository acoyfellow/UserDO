// In a real project, import from 'userdo'
import { createUserDOWorker, getUserDOFromContext, UserDO, type Env, type Table } from '../../src'
import { z } from 'zod'

const TodoSchema = z.object({
  text: z.string(),
  completed: z.boolean().default(false),
  createdAt: z.string(),
})

type Todo = z.infer<typeof TodoSchema>

export class TodoDO extends UserDO {
  todos: Table<Todo>

  constructor(state: DurableObjectState, env: Env) {
    super(state, env)
    this.todos = this.table('todos', TodoSchema as any, { userScoped: true })
  }

  add(text: string) {
    return this.todos.create({ text, completed: false, createdAt: new Date().toISOString() })
  }

  list() {
    return this.todos.orderBy('createdAt', 'desc').get()
  }

  toggle(id: string, completed: boolean) {
    return this.todos.update(id, { completed })
  }

  remove(id: string) {
    return this.todos.delete(id)
  }
}

export { TodoDO as UserDO }

const worker = createUserDOWorker('TODO_DO')

const getTodoDO = (c: any, email: string) =>
  getUserDOFromContext(c, email, 'TODO_DO') as unknown as TodoDO

const requireUser = (c: any) => {
  const user = c.get('user')
  if (!user) return { error: c.json({ error: 'Unauthorized' }, 401), user: null }
  return { user, error: null }
}

worker.get('/api/todos', async (c) => {
  const { user, error } = requireUser(c)
  if (error) return error
  const todos = await getTodoDO(c, user!.email).list()
  return c.json({ todos })
})

worker.post('/api/todos', async (c) => {
  const { user, error } = requireUser(c)
  if (error) return error
  const { text } = await c.req.json()
  const todo = await getTodoDO(c, user!.email).add(text)
  return c.json({ todo })
})

worker.put('/api/todos/:id', async (c) => {
  const { user, error } = requireUser(c)
  if (error) return error
  const { completed } = await c.req.json()
  await getTodoDO(c, user!.email).toggle(c.req.param('id'), completed)
  return c.json({ ok: true })
})

worker.delete('/api/todos/:id', async (c) => {
  const { user, error } = requireUser(c)
  if (error) return error
  await getTodoDO(c, user!.email).remove(c.req.param('id'))
  return c.json({ ok: true })
})

export default worker
