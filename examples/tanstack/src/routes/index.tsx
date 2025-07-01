import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="text-center mb-12">
        <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent mb-4">
          UserDO + TanStack Start
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          A modern todo app showcasing the power of UserDO with TanStack Start and TanStack Query
        </p>
        <Link
          to="/todos"
          className="inline-block px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-full font-medium text-lg hover:from-blue-600 hover:to-purple-700 transition-all transform hover:scale-105 shadow-lg"
        >
          Get Started with Todos →
        </Link>
      </div>

      <div className="grid md:grid-cols-3 gap-8 mb-12">
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
          <div className="text-3xl mb-4">⚡</div>
          <h3 className="text-xl font-semibold mb-2">TanStack Start</h3>
          <p className="text-gray-600">
            Type-safe, client-first, full-stack React framework with file-based routing and server functions.
          </p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
          <div className="text-3xl mb-4">🔄</div>
          <h3 className="text-xl font-semibold mb-2">TanStack Query</h3>
          <p className="text-gray-600">
            Powerful data synchronization with automatic caching, background updates, and optimistic updates.
          </p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
          <div className="text-3xl mb-4">🏗️</div>
          <h3 className="text-xl font-semibold mb-2">UserDO</h3>
          <p className="text-gray-600">
            Durable Objects made simple with user-scoped data, type-safe tables, and automatic persistence.
          </p>
        </div>
      </div>

      <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-8 rounded-2xl">
        <h2 className="text-2xl font-bold mb-4">Features Demonstrated</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span>Real-time todo management</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span>Optimistic UI updates</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span>Server-side API routes</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span>Type-safe data fetching</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span>Automatic cache invalidation</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span>Modern UI with Tailwind CSS</span>
          </div>
        </div>
      </div>
    </div>
  )
}
