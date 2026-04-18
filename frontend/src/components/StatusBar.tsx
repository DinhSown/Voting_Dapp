import { Wallet, Mail, Cpu, Blocks } from 'lucide-react'
import type { HealthStatus } from '../types'
import { HARDHAT_CHAIN_ID } from '../constants'

interface Props {
  walletAddress: string
  chainId: number
  authVerified: boolean
  health: HealthStatus | null
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${ok ? 'bg-green-400' : 'bg-red-400'}`}
    />
  )
}

export function StatusBar({ walletAddress, chainId, authVerified, health }: Props) {
  const isCorrectNetwork = chainId === HARDHAT_CHAIN_ID

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div className="panel p-3 flex items-center gap-2">
        <Wallet size={16} className="text-[#f2ca50]" />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-white/40">Ví</p>
          <p className="text-xs font-mono text-white truncate">
            {walletAddress
              ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
              : 'Chưa kết nối'}
          </p>
        </div>
        <StatusDot ok={!!walletAddress} />
      </div>

      <div className="panel p-3 flex items-center gap-2">
        <Mail size={16} className="text-[#a2e7ff]" />
        <div className="flex-1">
          <p className="text-xs text-white/40">Xác minh</p>
          <p className="text-xs text-white">{authVerified ? 'Đã xác minh' : 'Chưa xác minh'}</p>
        </div>
        <StatusDot ok={authVerified} />
      </div>

      <div className="panel p-3 flex items-center gap-2">
        <Cpu size={16} className="text-purple-400" />
        <div className="flex-1">
          <p className="text-xs text-white/40">Backend</p>
          <p className="text-xs text-white">
            {health?.status === 'ok' ? 'Online' : 'Offline'}
          </p>
        </div>
        <StatusDot ok={health?.status === 'ok'} />
      </div>

      <div className="panel p-3 flex items-center gap-2">
        <Blocks size={16} className="text-orange-400" />
        <div className="flex-1">
          <p className="text-xs text-white/40">Mạng</p>
          <p className="text-xs text-white">
            {isCorrectNetwork ? 'Hardhat Local' : chainId ? `Chain ${chainId}` : 'Chưa kết nối'}
          </p>
        </div>
        <StatusDot ok={isCorrectNetwork} />
      </div>
    </div>
  )
}
