import { useEffect, useState } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { seedIfEmpty } from './db/seed'
import IngredientsPage from './pages/IngredientsPage'
import InventoryPage from './pages/InventoryPage'
import PlanPage from './pages/PlanPage'
import HistoryPage from './pages/HistoryPage'

function App() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    seedIfEmpty().then(() => setReady(true))
  }, [])

  if (!ready) return null

  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<PlanPage />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="ingredients" element={<IngredientsPage />} />
          <Route path="history" element={<HistoryPage />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}

export default App
