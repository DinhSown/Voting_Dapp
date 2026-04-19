import { useState, useEffect } from 'react'
import { CheckCircle, Loader, AlertTriangle } from 'lucide-react'
import { fetchPublicElections } from '../services/api'
import { useAuthContext } from '../context/AuthContext'
import { VOTE_FEE_NATIVE, VOTE_FEE_SYMBOL } from '../constants'
import type { Election } from '../types'
import type { WalletState } from '../hooks/useWallet'
import type { VoteState } from '../hooks/useVote'

interface Props {
  wallet: WalletState
  vote: VoteState
  onToast: (msg: string, type: 'success' | 'error' | 'info') => void
}

export function VotePage({ wallet, vote, onToast }: Props) {
  const { isAuthenticated } = useAuthContext()
  const [elections, setElections] = useState<Election[]>([])
  const [loadingElections, setLoadingElections] = useState(true)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [selectedCandidateId, setSelectedCandidateId] = useState<number | null>(null)

  const isEligible = !!wallet.address && wallet.isCorrectNetwork && isAuthenticated

  useEffect(() => {
    fetchPublicElections(true)
      .then((data) => { setElections(data); setSelectedIdx(0) })
      .catch(() => undefined)
      .finally(() => setLoadingElections(false))
  }, [])

  const election = elections[selectedIdx]
  const hasVoted = election ? vote.voted.has(election.id) : false
  const votedFor = election ? vote.votedCandidates.get(election.id) : undefined
  const votedCandidate = votedFor ? election?.candidates.find((c) => c.id === votedFor.candidateId) : undefined

  async function handleVote() {
    if (!selectedCandidateId || !election) return
    const candidate = election.candidates.find((c) => c.id === selectedCandidateId)
    if (!candidate) return
    try {
      const txHash = await vote.castVote(election, candidate)
      onToast(`Bỏ phiếu thành công! TX: ${txHash.slice(0, 10)}...`, 'success')
      setSelectedCandidateId(null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('-32002') || msg.includes('could not coalesce') || msg.includes('UNKNOWN_ERROR')) {
        onToast('Giao dịch đã gửi nhưng mạng chưa xác nhận. Kiểm tra lại ví của bạn.', 'info')
      } else {
        onToast(msg || 'Bỏ phiếu thất bại', 'error')
      }
    }
  }

  // Loading state (elections or history)
  if (loadingElections || !vote.historyLoaded) {
    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-9 w-28 rounded-xl bg-white/5 animate-pulse" />)}
        </div>
        <div className="h-32 rounded-xl bg-white/5 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-xl bg-white/5 animate-pulse" />)}
        </div>
      </div>
    )
  }

  if (elections.length === 0) {
    return (
      <div className="text-center py-20 space-y-3">
        <div className="text-4xl">🗳️</div>
        <p className="text-white/50 text-sm">Hiện chưa có cuộc bầu cử nào đang diễn ra.</p>
      </div>
    )
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
              {wallet.address && !wallet.isCorrectNetwork && <li>Chuyển sang mạng Sapphire Testnet</li>}
              {!isAuthenticated && <li>Đăng nhập bằng ví MetaMask</li>}
            </ul>
          </div>
        </div>
      )}

      {/* Election tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {elections.map((el, idx) => (
          <button
            key={el.id}
            onClick={() => { setSelectedIdx(idx); setSelectedCandidateId(null) }}
            className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium border transition-all flex items-center gap-2 ${
              idx === selectedIdx
                ? 'bg-[#f2ca50]/20 border-[#f2ca50]/40 text-[#f2ca50]'
                : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'
            }`}
          >
            <span className="truncate max-w-[140px]">{el.title}</span>
            {vote.voted.has(el.id) && <CheckCircle size={12} className="text-green-400 shrink-0" />}
          </button>
        ))}
      </div>

      {/* Election header */}
      <div className="panel p-4 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-white">{election.title}</h2>
            {election.description && (
              <p className="text-sm text-white/50 mt-1">{election.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {hasVoted && (
              <span className="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
                Đã bỏ phiếu
              </span>
            )}
            {election.onChainId === null && (
              <span className="text-xs px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                Chưa lên chain
              </span>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-[#f2ca50]/20 bg-[#f2ca50]/10 px-3 py-2">
          <p className="text-xs text-[#f2ca50]">
            Mỗi lần bỏ phiếu sẽ tốn <span className="font-semibold">{VOTE_FEE_NATIVE} {VOTE_FEE_SYMBOL}</span> để xác thực giao dịch on-chain.
          </p>
        </div>

        {hasVoted && votedCandidate && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
            {votedCandidate.image && (
              <img src={votedCandidate.image} alt={votedCandidate.name}
                className="w-9 h-9 rounded-full object-cover shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-green-400/70">Bạn đã bỏ phiếu cho</p>
              <p className="text-sm font-semibold text-green-300 truncate">{votedCandidate.name}</p>
            </div>
            <CheckCircle size={16} className="text-green-400 shrink-0" />
          </div>
        )}
      </div>

      {/* Candidates */}
      {election.candidates.length === 0 ? (
        <div className="text-center py-8 text-white/30 text-sm">Chưa có ứng viên nào</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {election.candidates.map((candidate) => {
            const isSelected = selectedCandidateId === candidate.id
            const isVoting = vote.votingFor === candidate.id
            const isVotedFor = votedFor?.candidateId === candidate.id
            const notOnChain = candidate.onChainId === null
            return (
              <button
                key={candidate.id}
                onClick={() => !hasVoted && isEligible && !notOnChain && setSelectedCandidateId(isSelected ? null : candidate.id)}
                disabled={hasVoted || !isEligible || notOnChain}
                className={`panel p-4 text-left transition-all ${
                  isVotedFor
                    ? 'border-green-500/40 bg-green-500/5'
                    : isSelected
                    ? 'border-[#f2ca50]/50 bg-[#f2ca50]/5'
                    : hasVoted || !isEligible || notOnChain
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:border-white/20 hover:bg-white/5 cursor-pointer'
                }`}
              >
                <div className="flex items-start gap-3">
                  {candidate.image ? (
                    <img src={candidate.image} alt={candidate.name}
                      className="w-12 h-12 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500/40 to-blue-500/40 flex items-center justify-center text-lg font-bold text-white/50 shrink-0">
                      {candidate.name[0]}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{candidate.name}</p>
                    {candidate.description && (
                      <p className="text-xs text-white/50 mt-0.5 line-clamp-2">{candidate.description}</p>
                    )}
                    {notOnChain && (
                      <p className="text-xs text-yellow-400/70 mt-1">Chưa lên chain</p>
                    )}
                  </div>
                  {isVotedFor && <CheckCircle size={18} className="text-green-400 shrink-0" />}
                  {!isVotedFor && isSelected && <CheckCircle size={18} className="text-[#f2ca50] shrink-0" />}
                  {isVoting && <Loader size={18} className="text-[#f2ca50] shrink-0 animate-spin" />}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {isEligible && !hasVoted && (
        <button
          onClick={handleVote}
          disabled={!selectedCandidateId || vote.votingFor !== null || election.onChainId === null}
          className="w-full py-3 px-6 rounded-xl bg-[#f2ca50] text-black font-bold text-sm hover:bg-[#f2ca50]/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
        >
          {vote.votingFor !== null ? (
            <><Loader size={16} className="animate-spin" /> Đang ký giao dịch...</>
          ) : selectedCandidateId ? (
            <><CheckCircle size={16} /> Bỏ phiếu cho {election.candidates.find((c) => c.id === selectedCandidateId)?.name} ({VOTE_FEE_NATIVE} {VOTE_FEE_SYMBOL})</>
          ) : (
            'Chọn ứng viên để bỏ phiếu'
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
