# TanStack Query Example

Minimal Todo app using UserDO with [TanStack Query](https://tanstack.com/query).

## What You'll Learn

- Using `@tanstack/react-query` with UserDO endpoints
- Mutations with automatic cache invalidation
- Simple Workers setup for React apps

## React Snippet

```tsx
const queryClient = new QueryClient();

function Todos() {
  const { data: todos = [] } = useQuery({
    queryKey: ['todos'],
    queryFn: () => fetch('/api/todos').then(r => r.json()).then(r => r.todos)
  });

  const addTodo = useMutation({
    mutationFn: (text: string) =>
      fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['todos'] })
  });
}
```

## File Structure

```
examples/tanstack/
├── index.tsx         # Worker and Durable Object
├── frontend.tsx      # React components using TanStack Query
├── package.json
├── tsconfig.json
└── wrangler.jsonc
```
