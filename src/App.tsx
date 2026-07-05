import { useEffect, useState } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import ErrorBoundary from './components/ErrorBoundary'
import Layout from './components/Layout'
import { seedIfEmpty } from './db/seed'
import IngredientsPage from './pages/IngredientsPage'
import InventoryPage from './pages/InventoryPage'
import PlanPage from './pages/PlanPage'
import HistoryPage from './pages/HistoryPage'
import SettingsPage from './pages/SettingsPage'

function App() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    seedIfEmpty().then(() => setReady(true))
  }, [])

  if (!ready) return null

  return (
    <ErrorBoundary>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<PlanPage />} />
            <Route path="inventory" element={<InventoryPage />} />
            <Route path="ingredients" element={<IngredientsPage />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </HashRouter>
    </ErrorBoundary>
  )
}

export default App
