import { QueryClient, QueryClientProvider, useQuery, useMutation } from '@tanstack/react-query'
import { FC, useState } from 'react'
import { renderToString } from 'hono/jsx'

const client = new QueryClient()

export const App: FC = () => {
  const { data: todos = [] } = useQuery({
    queryKey: ['todos'],
    queryFn: () => fetch('/api/todos').then(r => r.json()).then(r => r.todos)
  })

  const addTodo = useMutation({
    mutationFn: (text: string) =>
      fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['todos'] })
  })

  const [text, setText] = useState('')

  return (
    <QueryClientProvider client={client}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (text) addTodo.mutate(text)
        }}>
        <input value={text} onChange={(e) => setText(e.currentTarget.value)} />
        <button type='submit'>Add</button>
      </form>
      <ul>
        {todos.map((t: any) => (
          <li key={t.id}>{t.text}</li>
        ))}
      </ul>
    </QueryClientProvider>
  )
}

export const renderApp = () => renderToString(<App />)
