import { Wallet, AlertCircle, CheckCircle, Loader, RefreshCw } from 'lucide-react'
import { HARDHAT_CHAIN_ID } from '../constants'

interface Props {
  address: string
  chainId: number
  loading: boolean
  error: string
  onConnect: () => void
  onSwitchNetwork: () => void
}

interface StepProps {
  num: number
  done: boolean
  active: boolean
  title: string
  desc: string
}

function Step({ num, done, active, title, desc }: StepProps) {
  return (
    <div className={`flex items-start gap-3 p-3 rounded-xl transition-all ${active ? 'bg-white/5' : ''}`}>
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
          done
            ? 'bg-green-500/20 text-green-400 border border-green-500/40'
            : active
            ? 'bg-[#f2ca50]/20 text-[#f2ca50] border border-[#f2ca50]/40'
            : 'bg-white/5 text-white/30 border border-white/10'
        }`}
      >
        {done ? <CheckCircle size={14} /> : num}
      </div>
      <div>
        <p className={`text-sm font-medium ${done ? 'text-white/50 line-through' : active ? 'text-white' : 'text-white/30'}`}>
          {title}
        </p>
        <p className="text-xs text-white/30 mt-0.5">{desc}</p>
      </div>
    </div>
  )
}

export function WalletConnect({ address, chainId, loading, error, onConnect, onSwitchNetwork }: Props) {
  const isConnected = !!address
  const isCorrectNetwork = chainId === HARDHAT_CHAIN_ID

  if (isConnected && isCorrectNetwork) {
    return (
      <div className="panel p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
            <CheckCircle size={20} className="text-green-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">Ví đã kết nối</p>
            <p className="text-xs font-mono text-white/50">
              {address.slice(0, 10)}...{address.slice(-8)}
            </p>
          </div>
          <div className="ml-auto">
            <span className="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
              Hardhat Local
            </span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="panel p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Wallet size={18} className="text-[#f2ca50]" />
        <h3 className="text-sm font-semibold text-white">Kết nối ví</h3>
      </div>

      <div className="space-y-1">
        <Step
          num={1}
          done={isConnected}
          active={!isConnected}
          title="Cài MetaMask"
          desc="Tiện ích mở rộng trình duyệt ví Web3"
        />
        <Step
          num={2}
          done={isConnected}
          active={!isConnected}
          title="Kết nối ví"
          desc="Cho phép trang web truy cập địa chỉ ví"
        />
        <Step
          num={3}
          done={isConnected && isCorrectNetwork}
          active={isConnected && !isCorrectNetwork}
          title="Chuyển sang Hardhat Local"
          desc="Mạng blockchain cục bộ cho bầu cử"
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
          <AlertCircle size={14} className="text-red-400 mt-0.5 shrink-0" />
          <p className="text-xs text-red-300">{error}</p>
        </div>
      )}

      {!isConnected ? (
        <button
          onClick={onConnect}
          disabled={loading}
          aria-label={loading ? 'Đang kết nối ví' : 'Kết nối MetaMask'}
          className="w-full py-2.5 px-4 rounded-xl bg-[#f2ca50] text-black font-semibold text-sm hover:bg-[#f2ca50]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
        >
          {loading ? <Loader size={16} className="animate-spin" /> : <Wallet size={16} />}
          {loading ? 'Đang kết nối...' : 'Kết nối MetaMask'}
        </button>
      ) : (
        <button
          onClick={onSwitchNetwork}
          disabled={loading}
          aria-label={loading ? 'Đang chuyển mạng' : 'Chuyển sang Hardhat Local'}
          className="w-full py-2.5 px-4 rounded-xl bg-orange-500/20 text-orange-300 border border-orange-500/30 font-semibold text-sm hover:bg-orange-500/30 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
        >
          {loading ? <Loader size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          {loading ? 'Đang chuyển mạng...' : 'Chuyển sang Hardhat Local'}
        </button>
      )}
    </div>
  )
}
