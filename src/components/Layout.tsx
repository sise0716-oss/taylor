import { NavLink, Outlet } from 'react-router-dom'

const tabs = [
  { to: '/', label: '식단 추천', icon: '🍽️' },
  { to: '/inventory', label: '재고', icon: '📦' },
  { to: '/ingredients', label: '재료', icon: '🥕' },
  { to: '/history', label: '기록', icon: '📝' },
  { to: '/settings', label: '설정', icon: '⚙️' },
]

export default function Layout() {
  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col bg-neutral-50 dark:bg-neutral-950">
      <header className="border-b border-neutral-200 bg-white px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900">
        <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          아가밥
        </h1>
      </header>

      <main className="flex-1 overflow-y-auto pb-20">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 mx-auto flex w-full max-w-md border-t border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === '/'}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 py-2 text-xs ${
                isActive
                  ? 'text-purple-600 dark:text-purple-400'
                  : 'text-neutral-500 dark:text-neutral-400'
              }`
            }
          >
            <span className="text-lg">{tab.icon}</span>
            {tab.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
