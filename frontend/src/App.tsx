import { useState, useEffect, useCallback } from 'react'
import { useWallet } from './hooks/useWallet'
import { useAuth } from './hooks/useAuth'
import { useVote } from './hooks/useVote'
import { fetchHealth } from './services/api'
import { Toast } from './components/Toast'
import { HomePage } from './pages/HomePage'
import { VotePage } from './pages/VotePage'
import { ResultsPage } from './pages/ResultsPage'
import { AdminPage } from './pages/AdminPage'
import type { Route, Toast as ToastType, HealthStatus } from './types'

function getRouteFromHash(): Route {
  const hash = window.location.hash.replace('#', '')
  if (hash === 'vote') return 'vote'
  if (hash === 'results') return 'results'
  if (hash === 'admin') return 'admin'
  return 'home'
}

export default function App() {
  const [route, setRoute] = useState<Route>(getRouteFromHash)
  const [toast, setToast] = useState<ToastType | null>(null)
  const [health, setHealth] = useState<HealthStatus | null>(null)

  const wallet = useWallet()
  const auth = useAuth()
  const vote = useVote()

  useEffect(() => {
    const handler = () => setRoute(getRouteFromHash())
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])

  useEffect(() => {
    fetchHealth()
      .then(setHealth)
      .catch(() => setHealth(null))
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(timer)
  }, [toast])

  const navigate = useCallback((r: string) => {
    window.location.hash = r === 'home' ? '' : r
  }, [])

  const showToast = useCallback((message: string, type: ToastType['type']) => {
    setToast({ message, type })
  }, [])

  const navItems: { route: Route; label: string }[] = [
    { route: 'home', label: 'Trang chủ' },
    { route: 'vote', label: 'Bỏ phiếu' },
    { route: 'results', label: 'Kết quả' },
    { route: 'admin', label: 'Quản trị' },
  ]

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="orb absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] bg-purple-900/20 rounded-full blur-[120px]" />
        <div className="orb absolute bottom-[-20%] right-[-10%] w-[50vw] h-[50vw] bg-blue-900/20 rounded-full blur-[100px]" />
      </div>

      <nav className="sticky top-0 z-40 backdrop-blur-md bg-black/40 border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 flex items-center gap-1 h-14">
          <span className="font-headline font-bold text-[#f2ca50] mr-4 text-sm">Web3 Awards</span>
          {navItems.map((item) => (
            <button
              key={item.route}
              onClick={() => navigate(item.route)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                route === item.route
                  ? 'bg-white/10 text-white font-medium'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {route === 'home' && (
          <HomePage wallet={wallet} auth={auth} health={health} onNavigate={navigate} />
        )}
        {route === 'vote' && (
          <VotePage wallet={wallet} vote={vote} authStep={auth.step} onToast={showToast} />
        )}
        {route === 'results' && <ResultsPage onNavigate={navigate} />}
        {route === 'admin' && <AdminPage />}
      </main>

      <Toast toast={toast} />
    </div>
  )
}
