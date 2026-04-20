import { WalletConnect } from '../components/WalletConnect'
import { AuthFlow } from '../components/AuthFlow'
import { LoginFlow } from '../components/LoginFlow'
import { useAuthContext } from '../context/AuthContext'
import type { WalletState } from '../hooks/useWallet'
import type { AuthState } from '../hooks/useAuth'
import type { HealthStatus } from '../types'

interface Props {
  wallet: WalletState
  auth: AuthState
  health: HealthStatus | null
  onNavigate: (route: string) => void
}

const CARD: React.CSSProperties = {
  background: 'rgba(255,255,255,0.025)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 16,
}

export function HomePage({ wallet, auth, health, onNavigate }: Props) {
  const { isAuthenticated, user } = useAuthContext()

  const readiness = isAuthenticated ? 100 : wallet.address ? 50 : 8

  const steps = [
    { n: '01', label: 'Kết nối ví MetaMask', done: !!wallet.address },
    { n: '02', label: 'Xác thực chữ ký', done: auth.step === 'VERIFIED' },
    { n: '03', label: 'Chọn ứng viên & bỏ phiếu', done: false },
    { n: '04', label: 'Phiếu ghi lên blockchain', done: false },
  ]

  const renderAuthPanel = () => {
    if (!wallet.address) {
      return (
        <div>
          <Label>Bước 1 — Kết nối ví</Label>
          <div className="mt-3 rounded-2xl overflow-hidden">
            <WalletConnect
              address={wallet.address}
              chainId={wallet.chainId}
              loading={wallet.loading}
              error={wallet.error}
              onConnect={wallet.connect}
              onSwitchNetwork={wallet.switchNetwork}
            />
          </div>
        </div>
      )
    }

    if (!isAuthenticated) {
      return (
        <div>
          <Label>Bước 2 — Xác thực</Label>
          <div className="mt-3 p-6" style={CARD}>
            <p className="text-sm font-semibold text-on-surface mb-0.5" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Xác thực phiên làm việc
            </p>
            <p className="text-xs text-on-surface-variant mb-5">
              Ký thông điệp bằng ví để đăng nhập an toàn
            </p>
            <LoginFlow walletAddress={wallet.address} onSuccess={() => {}} />
          </div>
        </div>
      )
    }

    return (
      <div>
        <Label>Tài khoản</Label>
        <div className="mt-3 p-6 space-y-5" style={CARD}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(78,222,163,0.1)', border: '1px solid rgba(78,222,163,0.2)' }}>
              <span className="material-symbols-outlined text-[20px]" style={{ color: '#4edea3' }}>check</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-on-surface leading-none mb-1"
                style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                {user?.name || 'Đã đăng nhập'}
              </p>
              <p className="text-xs font-mono" style={{ color: 'rgba(218,226,253,0.35)' }}>
                {wallet.address ? `${wallet.address.slice(0, 8)}···${wallet.address.slice(-6)}` : ''}
              </p>
            </div>
            {user?.role === 'admin' && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded"
                style={{
                  fontFamily: 'Inter, sans-serif',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  background: 'rgba(76,215,246,0.1)',
                  border: '1px solid rgba(76,215,246,0.2)',
                  color: '#4cd7f6',
                }}>
                Admin
              </span>
            )}
          </div>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />

          <div className="space-y-2">
            <button
              onClick={() => onNavigate('vote')}
              className="w-full py-2.5 rounded-xl text-sm font-bold civic-btn active:scale-[0.98] transition-transform"
              style={{ fontFamily: 'Space Grotesk, sans-serif' }}
            >
              Bỏ phiếu ngay →
            </button>
            <button
              onClick={() => onNavigate('results')}
              className="w-full py-2.5 rounded-xl text-xs font-medium transition-all hover:text-on-surface active:scale-[0.98]"
              style={{
                fontFamily: 'Inter, sans-serif',
                color: 'rgba(218,226,253,0.4)',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              Xem kết quả
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-12 relative">
      {/* Decorative background glow */}
      <div 
        className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] opacity-20 blur-[120px] pointer-events-none z-0"
        style={{
          background: 'radial-gradient(circle, #f2ca50 0%, transparent 70%)',
        }}
      />

      {/* ── HERO ──────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 lg:items-center lg:min-h-[360px]">

        {/* Left — headline */}
        <div className="space-y-8">
          <div className="space-y-5">
            {/* Event eyebrow */}
            <div className="inline-flex items-center gap-2">
              <span className="w-1 h-1 rounded-full" style={{ background: '#f59e0b' }} />
              <span style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'rgba(245,158,11,0.8)',
              }}>
                Vietnam Blockchain Week 2026
              </span>
            </div>

            {/* Heading */}
            <h1 style={{
              fontFamily: 'Space Grotesk, sans-serif',
              fontSize: 'clamp(44px, 5.5vw, 68px)',
              fontWeight: 700,
              lineHeight: 1.08,
              letterSpacing: '-0.03em',
              color: '#eaecef',
            }}>
              Bình chọn<br />
              <span style={{ color: '#f2ca50' }}>meChoice</span>
            </h1>

            {/* Description */}
            <p style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: 15,
              lineHeight: 1.8,
              color: 'rgba(218,226,253,0.55)',
              maxWidth: 400,
            }}>
              Bình chọn cho các cá nhân và dự án xuất sắc trong hệ sinh thái
              blockchain Việt Nam. Bất biến trên Oasis Sapphire.
            </p>
          </div>

          {/* CTA + readiness */}
          <div className="space-y-5">
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => onNavigate('vote')}
                className="civic-btn px-6 py-2.5 rounded-xl text-sm font-bold active:scale-[0.98] transition-transform"
                style={{ fontFamily: 'Space Grotesk, sans-serif' }}
              >
                Bỏ phiếu ngay
              </button>
              <button
                onClick={() => onNavigate('results')}
                className="px-6 py-2.5 rounded-xl text-sm font-medium active:scale-[0.98] transition-all"
                style={{
                  fontFamily: 'Space Grotesk, sans-serif',
                  color: 'rgba(218,226,253,0.5)',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = '#dae2fd')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(218,226,253,0.5)')}
              >
                Xem kết quả
              </button>
            </div>

            {/* Readiness bar */}
            <div>
              <div className="flex justify-between mb-2">
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(218,226,253,0.3)' }}>
                  Sẵn sàng bỏ phiếu
                </span>
                <span style={{ fontFamily: 'monospace', fontSize: 10, color: 'rgba(218,226,253,0.3)' }}>
                  {readiness}%
                </span>
              </div>
              <div className="w-full rounded-full overflow-hidden" style={{ height: 2, background: 'rgba(255,255,255,0.06)' }}>
                <div className="h-full rounded-full" style={{
                  width: `${readiness}%`,
                  background: '#f2ca50',
                  transition: 'width 0.9s cubic-bezier(0.23,1,0.32,1)',
                }} />
              </div>
            </div>
          </div>
        </div>

        {/* Right — auth panel */}
        <div>
          {renderAuthPanel()}
        </div>
      </section>

      {/* ── STATUS STRIP ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 overflow-hidden rounded-xl divide-x divide-y lg:divide-y-0"
        style={{ border: '1px solid rgba(255,255,255,0.07)', '--tw-divide-opacity': 1 } as React.CSSProperties}>
        {[
          {
            label: 'Hệ thống',
            value: health ? 'Online' : 'Offline',
            live: !!health,
            color: health ? '#4edea3' : '#8c909f',
          },
          { label: 'Mạng', value: 'Oasis Sapphire', color: '#4cd7f6' },
          { label: 'Bảo mật', value: 'On-chain', color: '#dae2fd' },
          {
            label: 'Ví',
            value: wallet.address
              ? `${wallet.address.slice(0, 6)}···${wallet.address.slice(-4)}`
              : 'Chưa kết nối',
            mono: true,
            color: wallet.address ? '#f2ca50' : '#848e9c',
          },
        ].map((s) => (
          <div key={s.label} className="px-5 py-4" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(218,226,253,0.3)', marginBottom: 8 }}>
              {s.label}
            </p>
            <div className="flex items-center gap-1.5">
              {s.live && <span className="live-dot" />}
              <p className="font-semibold leading-none" style={{ fontFamily: s.mono ? 'monospace' : 'Space Grotesk, sans-serif', fontSize: 13, color: s.color }}>
                {s.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* ── STEPS + NAV ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Steps */}
        <div className="lg:col-span-2">
          <Label className="mb-5">Cách hoạt động</Label>
          <div className="relative">
            {/* Connector line */}
            <div className="absolute top-3.5 left-3 right-3 hidden lg:block"
              style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 relative">
              {steps.map((s) => (
                <div key={s.n} className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 lg:gap-0">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold z-10"
                      style={{
                        fontFamily: 'Space Grotesk, sans-serif',
                        background: s.done ? 'rgba(242,202,80,0.12)' : 'rgba(11,14,17,1)',
                        border: `1px solid ${s.done ? 'rgba(242,202,80,0.35)' : 'rgba(255,255,255,0.05)'}`,
                        color: s.done ? '#f2ca50' : 'rgba(234,236,239,0.25)',
                      }}>
                      {s.done ? '✓' : s.n}
                    </div>
                  </div>
                  <p style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 12,
                    lineHeight: 1.5,
                    color: s.done ? 'rgba(218,226,253,0.65)' : 'rgba(218,226,253,0.28)',
                  }}>
                    {s.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {isAuthenticated && (
            <div className="mt-6 flex items-center gap-3 pt-5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <span className="material-symbols-outlined text-[16px]" style={{ color: '#4edea3' }}>check_circle</span>
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#4edea3' }}>Sẵn sàng bỏ phiếu</span>
              <button
                onClick={() => onNavigate('vote')}
                className="ml-auto text-xs font-bold hover:underline"
                style={{ fontFamily: 'Space Grotesk, sans-serif', color: '#4edea3' }}
              >
                Bắt đầu →
              </button>
            </div>
          )}
        </div>

        {/* Quick nav */}
        <div>
          <Label className="mb-5">Truy cập nhanh</Label>
          <nav className="space-y-1.5">
            {[
              { label: 'Bỏ phiếu', sub: 'Danh sách ứng viên', route: 'vote', accent: true },
              { label: 'Kết quả', sub: 'Thống kê & biểu đồ', route: 'results', accent: false },
              { label: 'Hồ sơ', sub: 'Tài khoản & lịch sử', route: 'profile', accent: false },
            ].map((item) => (
              <button
                key={item.route}
                onClick={() => onNavigate(item.route)}
                className="w-full text-left px-4 py-3.5 rounded-xl flex items-center justify-between group transition-all active:scale-[0.98]"
                style={{
                  background: item.accent ? 'rgba(242,202,80,0.07)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${item.accent ? 'rgba(242,202,80,0.14)' : 'rgba(255,255,255,0.05)'}`,
                }}
              >
                <div>
                  <p className="text-sm font-semibold leading-none mb-1"
                    style={{
                      fontFamily: 'Space Grotesk, sans-serif',
                      color: item.accent ? '#f2ca50' : '#eaecef',
                    }}>
                    {item.label}
                  </p>
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: 'rgba(218,226,253,0.3)' }}>
                    {item.sub}
                  </p>
                </div>
                <span className="material-symbols-outlined text-[16px] transition-transform group-hover:translate-x-0.5"
                  style={{ color: item.accent ? 'rgba(173,198,255,0.5)' : 'rgba(218,226,253,0.2)' }}>
                  arrow_forward
                </span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* ── WALLET + AUTH detail (wallet connected, not authed) ── */}
      {!isAuthenticated && wallet.address && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <Label className="mb-3">Trạng thái ví</Label>
            <div className="rounded-2xl overflow-hidden">
              <WalletConnect
                address={wallet.address}
                chainId={wallet.chainId}
                loading={wallet.loading}
                error={wallet.error}
                onConnect={wallet.connect}
                onSwitchNetwork={wallet.switchNetwork}
              />
            </div>
          </div>
          <div>
            <Label className="mb-3">Xác minh danh tính</Label>
            <div className="rounded-2xl overflow-hidden">
              <AuthFlow auth={auth} walletAddress={wallet.address} />
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────
function Label({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={className} style={{
      fontFamily: 'Inter, sans-serif',
      fontSize: 10,
      fontWeight: 600,
      letterSpacing: '0.09em',
      textTransform: 'uppercase',
      color: 'rgba(218,226,253,0.3)',
    }}>
      {children}
    </p>
  )
}
