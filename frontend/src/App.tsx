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
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container-high border border-white/5 text-sm transition-all hover:bg-surface-container-highest cursor-pointer"
      >
        <span className="w-5 h-5 rounded-full bg-gradient-to-br from-primary/50 to-secondary/50 flex items-center justify-center text-xs font-bold text-on-surface">
          {(user.name || 'U')[0].toUpperCase()}
        </span>
        <span className="text-on-surface-variant max-w-[120px] truncate font-h3 text-xs">{user.name}</span>
        {user.role === 'admin' && (
          <span className="text-xs text-secondary">★</span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-lg glass-card overflow-hidden shadow-xl">
            <div className="px-3 py-2 border-b border-white/10">
              <p className="text-xs text-on-surface-variant font-mono truncate">{shortAddr}</p>
            </div>
            <button
              onClick={() => { onNavigate('profile'); setOpen(false) }}
              className="w-full text-left px-4 py-2.5 text-sm text-on-surface-variant hover:text-on-surface hover:bg-white/5 transition-colors cursor-pointer"
            >
              Hồ sơ
            </button>
            <button
              onClick={() => { logout(); setOpen(false) }}
              className="w-full text-left px-4 py-2.5 text-sm text-error hover:bg-error/10 transition-colors cursor-pointer"
            >
              Đăng xuất
            </button>
          </div>
        </>
      )}
    </div>
  )
}

const NAV_ITEMS: { route: Route; label: string; icon: string }[] = [
  { route: 'home', label: 'Dashboard', icon: 'dashboard' },
  { route: 'vote', label: 'Bỏ phiếu', icon: 'how_to_vote' },
  { route: 'results', label: 'Kết quả', icon: 'leaderboard' },
  { route: 'admin', label: 'Quản trị', icon: 'admin_panel_settings' },
  { route: 'profile', label: 'Hồ sơ', icon: 'person' },
]

function AppInner() {
  const [route, setRoute] = useState<Route>(getRouteFromHash)
  const [toast, setToast] = useState<ToastType | null>(null)
  const [health, setHealth] = useState<HealthStatus | null>(null)

  const wallet = useWallet()
  const auth = useAuth()
  const vote = useVote()
  const { isAuthenticated } = useAuthContext()

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

  const shortAddr = wallet.address
    ? `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`
    : null

  return (
    <div className="bg-background text-on-background min-h-screen" style={{ fontFamily: 'Inter, sans-serif' }}>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 h-full w-56 bg-[#181a20]/80 backdrop-blur-lg border-r border-white/5 p-4 z-40 flex-col shadow-xl">
        <div className="mb-10 px-4">
          <h1 className="text-xl font-extrabold" style={{ fontFamily: 'Space Grotesk, sans-serif', color: '#f2ca50' }}>
            meChoice
          </h1>
          <p className="uppercase tracking-wider text-[10px] text-slate-500 mt-1" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            meChoice Platform
          </p>
        </div>

        <nav className="flex-grow space-y-2">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.route}
              onClick={() => navigate(item.route)}
              className={`w-full flex items-center space-x-3 px-4 py-3 transition-all active:translate-x-1 uppercase tracking-wider text-xs cursor-pointer ${
                route === item.route
                  ? 'bg-primary/20 text-primary rounded-md border-l-4 border-primary'
                  : 'text-slate-400 hover:bg-white/10 hover:text-white'
              }`}
              style={{ fontFamily: 'Space Grotesk, sans-serif' }}
            >
              <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <button
          onClick={() => navigate('vote')}
          className="mt-auto cast-vote-btn py-4 rounded-lg text-white text-sm flex justify-center items-center gap-2 active:scale-95 transition-transform font-semibold cursor-pointer"
          style={{ fontFamily: 'Space Grotesk, sans-serif' }}
        >
          <span className="material-symbols-outlined">ballot</span>
          Bỏ phiếu ngay
        </button>
      </aside>

      {/* Top Header */}
      <header className="md:ml-56 flex justify-between items-center px-6 h-16 sticky top-0 z-50 bg-[#0b0e11]/80 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center gap-8">
          {/* Brand - mobile only */}
          <div
            className="text-xl font-extrabold tracking-tight md:hidden"
            style={{ fontFamily: 'Space Grotesk, sans-serif', color: '#f2ca50' }}
          >
            meChoice
          </div>
          {/* Nav links - large screens */}
          <nav className="hidden lg:flex items-center space-x-6" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            {NAV_ITEMS.map((item) => (
              <button
                key={item.route}
                onClick={() => navigate(item.route)}
                className={`text-sm transition-all duration-200 tracking-tight cursor-pointer ${
                  route === item.route
                    ? 'text-primary font-bold border-b-2 border-primary pb-1'
                    : 'text-slate-400 font-medium hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center space-x-3">
          {shortAddr && (
            <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-full bg-surface-container-high border border-white/5">
              <span
                className={`w-2 h-2 rounded-full ${
                  wallet.isCorrectNetwork ? 'bg-tertiary-container animate-pulse' : 'bg-error'
                }`}
              />
              <span className="font-mono text-xs text-on-surface-variant">{shortAddr}</span>
            </div>
          )}
          <NavUserMenu onNavigate={navigate} />
          {!isAuthenticated && (
            <button
              onClick={() => navigate('home')}
              className="bg-primary text-black px-8 py-3 rounded-lg text-base font-bold active:scale-95 transition-all border-t-2 border-b-2 shadow-xl cursor-pointer"
              style={{ 
                fontFamily: 'Space Grotesk, sans-serif',
                background: '#f2ca50',
                cursor: 'pointer'
              }}
            >
               Đăng nhập
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="md:ml-56 p-6 lg:p-8 max-w-7xl mx-auto pb-24 md:pb-8">
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

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0b0e11]/90 backdrop-blur-xl border-t border-white/5 flex justify-around items-center h-20 z-50 px-4">
        <button
          onClick={() => navigate('home')}
          className={`flex flex-col items-center gap-1 transition-colors cursor-pointer ${route === 'home' ? 'text-primary' : 'text-slate-400'}`}
        >
          <span className="material-symbols-outlined text-[22px]">dashboard</span>
          <span className="text-[10px] font-bold uppercase tracking-tighter" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Dashboard
          </span>
        </button>
        <button
          onClick={() => navigate('vote')}
          className={`flex flex-col items-center gap-1 transition-colors cursor-pointer ${route === 'vote' ? 'text-primary' : 'text-slate-400'}`}
        >
          <span className="material-symbols-outlined text-[22px]">how_to_vote</span>
          <span className="text-[10px] font-bold uppercase tracking-tighter" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Bỏ phiếu
          </span>
        </button>
        {/* FAB */}
        <div className="relative -top-6">
          <button
            onClick={() => navigate('vote')}
            className="w-14 h-14 rounded-full cast-vote-btn flex items-center justify-center text-white shadow-xl active:scale-95 transition-transform cursor-pointer"
          >
            <span className="material-symbols-outlined">ballot</span>
          </button>
        </div>
        <button
          onClick={() => navigate('results')}
          className={`flex flex-col items-center gap-1 transition-colors cursor-pointer ${route === 'results' ? 'text-primary' : 'text-slate-400'}`}
        >
          <span className="material-symbols-outlined text-[22px]">leaderboard</span>
          <span className="text-[10px] font-bold uppercase tracking-tighter" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Kết quả
          </span>
        </button>
        <button
          onClick={() => navigate('profile')}
          className={`flex flex-col items-center gap-1 transition-colors cursor-pointer ${route === 'profile' ? 'text-primary' : 'text-slate-400'}`}
        >
          <span className="material-symbols-outlined text-[22px]">person</span>
          <span className="text-[10px] font-bold uppercase tracking-tighter" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Hồ sơ
          </span>
        </button>
      </nav>

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
