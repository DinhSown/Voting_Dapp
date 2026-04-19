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
import { ProfilePage } from './pages/ProfilePage'
import { AuthProvider, useAuthContext } from './context/AuthContext'
import type { Route, Toast as ToastType, HealthStatus } from './types'

function getRouteFromHash(): Route {
  const hash = window.location.hash.replace('#', '')
  if (hash === 'vote') return 'vote'
  if (hash === 'results') return 'results'
  if (hash === 'admin') return 'admin'
  if (hash === 'profile') return 'profile'
  return 'home'
}

function NavUserMenu({ onNavigate }: { onNavigate: (r: string) => void }) {
  const { user, isAuthenticated, logout } = useAuthContext()
  const [open, setOpen] = useState(false)

  if (!isAuthenticated || !user) return null

  const shortAddr = user.walletAddress
    ? `${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-4)}`
    : ''

  return (
    <div className="relative ml-auto">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm transition-all"
      >
        <span className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-xs font-bold">
          {(user.name || 'U')[0].toUpperCase()}
        </span>
        <span className="text-white/80 max-w-[120px] truncate">{user.name}</span>
        {user.role === 'admin' && (
          <span className="text-xs text-yellow-400">★</span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-xl bg-[#1a1a2e] border border-white/10 shadow-xl overflow-hidden">
            <div className="px-3 py-2 border-b border-white/5">
              <p className="text-xs text-white/40 font-mono truncate">{shortAddr}</p>
            </div>
            <button
              onClick={() => { onNavigate('profile'); setOpen(false) }}
              className="w-full text-left px-4 py-2.5 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors"
            >
              Hồ sơ
            </button>
            <button
              onClick={() => { logout(); setOpen(false) }}
              className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
            >
              Đăng xuất
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function AppInner() {
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
          <span className="font-headline font-bold text-[#f2ca50] mr-4 text-sm">meChoice</span>
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
          <NavUserMenu onNavigate={navigate} />
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {route === 'home' && (
          <HomePage wallet={wallet} auth={auth} health={health} onNavigate={navigate} />
        )}
        {route === 'vote' && (
          <VotePage wallet={wallet} vote={vote} onToast={showToast} />
        )}
        {route === 'results' && <ResultsPage onNavigate={navigate} />}
        {route === 'admin' && <AdminPage />}
        {route === 'profile' && <ProfilePage />}
      </main>

      <Toast toast={toast} />
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  )
}
