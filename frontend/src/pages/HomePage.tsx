import { WalletConnect } from '../components/WalletConnect'
import { AuthFlow } from '../components/AuthFlow'
import { StatusBar } from '../components/StatusBar'
import type { WalletState } from '../hooks/useWallet'
import type { AuthState } from '../hooks/useAuth'
import type { HealthStatus } from '../types'

interface Props {
  wallet: WalletState
  auth: AuthState
  health: HealthStatus | null
  onNavigate: (route: string) => void
}

export function HomePage({ wallet, auth, health, onNavigate }: Props) {
  return (
    <div className="space-y-6">
      <div className="panel-glow p-8 text-center space-y-3">
        <p className="text-xs text-[#f2ca50] uppercase tracking-widest font-label">
          Vietnam Blockchain Week 2025
        </p>
        <h1 className="text-4xl md:text-5xl font-headline font-bold text-white leading-tight">
          Bình chọn <br />
          <span className="text-[#f2ca50]">Web3 Awards</span>
        </h1>
        <p className="text-white/50 text-sm max-w-md mx-auto">
          Bình chọn cho các cá nhân và dự án xuất sắc nhất trong hệ sinh thái blockchain Việt Nam
        </p>
        <div className="flex flex-wrap gap-3 justify-center pt-2">
          <button
            onClick={() => onNavigate('vote')}
            className="px-6 py-2.5 rounded-xl bg-[#f2ca50] text-black font-semibold text-sm hover:bg-[#f2ca50]/90 transition-all"
          >
            Bỏ phiếu ngay
          </button>
          <button
            onClick={() => onNavigate('results')}
            className="px-6 py-2.5 rounded-xl border border-white/20 text-white/80 font-semibold text-sm hover:bg-white/5 transition-all"
          >
            Xem kết quả
          </button>
        </div>
      </div>

      <StatusBar
        walletAddress={wallet.address}
        chainId={wallet.chainId}
        authVerified={auth.step === 'VERIFIED'}
        health={health}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <WalletConnect
          address={wallet.address}
          chainId={wallet.chainId}
          loading={wallet.loading}
          error={wallet.error}
          onConnect={wallet.connect}
          onSwitchNetwork={wallet.switchNetwork}
        />
        <AuthFlow auth={auth} walletAddress={wallet.address} />
      </div>

      {wallet.address && auth.step === 'VERIFIED' && (
        <div className="panel p-4 flex items-center justify-between">
          <p className="text-sm text-white/70">
            Sẵn sàng bỏ phiếu! 4 hạng mục đang chờ bạn.
          </p>
          <button
            onClick={() => onNavigate('vote')}
            className="px-4 py-2 rounded-xl bg-[#f2ca50] text-black font-semibold text-xs hover:bg-[#f2ca50]/90 transition-all"
          >
            Bắt đầu →
          </button>
        </div>
      )}
    </div>
  )
}
