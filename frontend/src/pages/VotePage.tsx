import { useState } from 'react'
import { CheckCircle, Loader, AlertTriangle } from 'lucide-react'
import { CATEGORIES } from '../constants'
import type { WalletState } from '../hooks/useWallet'
import type { VoteState } from '../hooks/useVote'
import type { AuthStep } from '../types'

interface Props {
  wallet: WalletState
  vote: VoteState
  authStep: AuthStep
  onToast: (msg: string, type: 'success' | 'error' | 'info') => void
}

export function VotePage({ wallet, vote, authStep, onToast }: Props) {
  const [selectedCategory, setSelectedCategory] = useState(0)
  const [selectedCandidate, setSelectedCandidate] = useState<number | null>(null)
  const isEligible = !!wallet.address && wallet.isCorrectNetwork && authStep === 'VERIFIED'
  const category = CATEGORIES[selectedCategory]
  const hasVotedThisCategory = vote.voted.has(category.id)

  async function handleVote() {
    if (!selectedCandidate) return
    try {
      const txHash = await vote.castVote(selectedCandidate, category.id)
      onToast(`Bỏ phiếu thành công! TX: ${txHash.slice(0, 10)}...`, 'success')
      setSelectedCandidate(null)
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Bỏ phiếu thất bại', 'error')
    }
  }

  return (
    <div className="space-y-6">
      {!isEligible && (
        <div className="panel p-4 flex items-start gap-3 border-amber-500/30 bg-amber-500/10">
          <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-300">Yêu cầu để bỏ phiếu</p>
            <ul className="text-xs text-amber-300/70 mt-1 space-y-0.5 list-disc list-inside">
              {!wallet.address && <li>Kết nối ví MetaMask</li>}
              {wallet.address && !wallet.isCorrectNetwork && <li>Chuyển sang mạng Hardhat Local</li>}
              {authStep !== 'VERIFIED' && <li>Xác minh email hoặc số điện thoại</li>}
            </ul>
          </div>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {CATEGORIES.map((cat, idx) => (
          <button
            key={cat.id}
            onClick={() => { setSelectedCategory(idx); setSelectedCandidate(null) }}
            className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium border transition-all flex items-center gap-2 ${
              idx === selectedCategory
                ? 'bg-[#f2ca50]/20 border-[#f2ca50]/40 text-[#f2ca50]'
                : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'
            }`}
          >
            <span>{cat.icon}</span>
            <span className="hidden sm:inline">{cat.title}</span>
            {vote.voted.has(cat.id) && <CheckCircle size={12} className="text-green-400" />}
          </button>
        ))}
      </div>

      <div className="panel p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white">
              {category.icon} {category.title}
            </h2>
            <p className="text-sm text-white/50 mt-1">{category.description}</p>
          </div>
          {hasVotedThisCategory && (
            <span className="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-400 border border-green-500/30 shrink-0">
              Đã bỏ phiếu
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {category.nominees.map((nominee) => {
          const isSelected = selectedCandidate === nominee.id
          const isVoting = vote.votingFor === nominee.id
          return (
            <button
              key={nominee.id}
              onClick={() => !hasVotedThisCategory && isEligible && setSelectedCandidate(isSelected ? null : nominee.id)}
              disabled={hasVotedThisCategory || !isEligible}
              className={`panel p-4 text-left transition-all ${
                isSelected
                  ? 'border-[#f2ca50]/50 bg-[#f2ca50]/5'
                  : hasVotedThisCategory || !isEligible
                  ? 'opacity-60 cursor-not-allowed'
                  : 'hover:border-white/20 hover:bg-white/5 cursor-pointer'
              }`}
            >
              <div className="flex items-start gap-3">
                <img
                  src={nominee.image}
                  alt={nominee.name}
                  className="w-12 h-12 rounded-full object-cover shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{nominee.name}</p>
                  <p className="text-xs text-white/50 mt-0.5 line-clamp-2">{nominee.description}</p>
                </div>
                {isSelected && (
                  <CheckCircle size={18} className="text-[#f2ca50] shrink-0" />
                )}
                {isVoting && (
                  <Loader size={18} className="text-[#f2ca50] shrink-0 animate-spin" />
                )}
              </div>
            </button>
          )
        })}
      </div>

      {isEligible && !hasVotedThisCategory && (
        <button
          onClick={handleVote}
          disabled={!selectedCandidate || vote.votingFor !== null}
          className="w-full py-3 px-6 rounded-xl bg-[#f2ca50] text-black font-bold text-sm hover:bg-[#f2ca50]/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
        >
          {vote.votingFor !== null ? (
            <>
              <Loader size={16} className="animate-spin" />
              Đang ký giao dịch...
            </>
          ) : (
            <>
              <CheckCircle size={16} />
              {selectedCandidate
                ? `Bỏ phiếu cho ${category.nominees.find((n) => n.id === selectedCandidate)?.name ?? ''}`
                : 'Chọn ứng viên để bỏ phiếu'}
            </>
          )}
        </button>
      )}

      {vote.votingFor !== null && (
        <div className="panel p-4 border-blue-500/30 bg-blue-500/10">
          <p className="text-sm text-blue-300 flex items-center gap-2">
            <Loader size={14} className="animate-spin" />
            MetaMask đang yêu cầu xác nhận giao dịch. Vui lòng kiểm tra ví của bạn...
          </p>
        </div>
      )}
    </div>
  )
}
