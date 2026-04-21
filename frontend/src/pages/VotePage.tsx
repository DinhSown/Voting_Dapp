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

const CARD_STYLE: React.CSSProperties = {
  background: 'rgba(255,255,255,0.025)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 16,
}

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 10,
  fontFamily: 'Inter, sans-serif',
  fontWeight: 600,
  letterSpacing: '0.09em',
  textTransform: 'uppercase',
  color: 'rgba(218,226,253,0.3)',
}

const TAB_ACTIVE_STYLE: React.CSSProperties = {
  background: 'rgba(242,202,80,0.1)',
  border: '1px solid rgba(242,202,80,0.2)',
  color: '#f2ca50',
}

const TAB_INACTIVE_STYLE: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.07)',
  color: 'rgba(218,226,253,0.4)',
}

function CheckRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
        style={{
          background: ok ? 'rgba(78,222,163,0.15)' : 'rgba(44,52,73,0.8)',
          border: `1px solid ${ok ? 'rgba(78,222,163,0.4)' : 'rgba(255,255,255,0.07)'}`,
        }}
      >
        {ok ? (
          <span className="material-symbols-outlined text-tertiary" style={{ fontSize: 10 }}>check</span>
        ) : (
          <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(140,144,159,0.4)', display: 'block' }} />
        )}
      </div>
      <span className="text-xs" style={{ color: ok ? '#c2c6d6' : '#8c909f', fontFamily: 'Inter, sans-serif' }}>
        {label}
      </span>
    </div>
  )
}

function FeeRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span style={{ ...LABEL_STYLE }}>
        {label}
      </span>
      <span
        className="text-xs font-mono font-bold"
        style={{ color: accent ? '#4edea3' : '#dae2fd', fontFamily: 'Inter, sans-serif' }}
      >
        {value}
      </span>
    </div>
  )
}

export function VotePage({ wallet, vote, onToast }: Props) {
  const { isAuthenticated } = useAuthContext()
  const [elections, setElections] = useState<Election[]>([])
  const [loadingElections, setLoadingElections] = useState(true)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [selectedCandidateId, setSelectedCandidateId] = useState<number | null>(null)
  const [confirmed, setConfirmed] = useState(false)

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
  const selectedCandidate = election?.candidates.find((c) => c.id === selectedCandidateId)

  async function handleVote() {
    if (!selectedCandidateId || !election) return
    const candidate = election.candidates.find((c) => c.id === selectedCandidateId)
    if (!candidate) return
    try {
      const txHash = await vote.castVote(election, candidate)
      onToast(`Bỏ phiếu thành công! TX: ${txHash.slice(0, 10)}...`, 'success')
      setSelectedCandidateId(null)
      setConfirmed(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('-32002') || msg.includes('could not coalesce') || msg.includes('UNKNOWN_ERROR')) {
        onToast('Giao dịch đã gửi nhưng mạng chưa xác nhận. Kiểm tra lại ví của bạn.', 'info')
      } else {
        onToast(msg || 'Bỏ phiếu thất bại', 'error')
      }
    }
  }

  if (loadingElections || !vote.historyLoaded) {
    return (
      <div className="space-y-12">
        <div
          className="h-40 rounded-xl animate-pulse"
          style={{ background: 'rgba(255,255,255,0.04)' }}
        />
        <div className="flex gap-2">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-9 w-32 rounded-xl animate-pulse"
              style={{ background: 'rgba(255,255,255,0.04)' }}
            />
          ))}
        </div>
        <div className="grid grid-cols-12 gap-gutter">
          <div className="col-span-12 lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-md">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-52 rounded-xl animate-pulse"
                style={{ background: 'rgba(255,255,255,0.04)' }}
              />
            ))}
          </div>
          <div className="col-span-12 lg:col-span-4">
            <div
              className="h-80 rounded-xl animate-pulse"
              style={{ background: 'rgba(255,255,255,0.04)' }}
            />
          </div>
        </div>
      </div>
    )
  }

  if (elections.length === 0) {
    return (
      <div className="text-center py-24 space-y-4">
        <span className="material-symbols-outlined text-7xl" style={{ opacity: 0.4, color: 'rgba(218,226,253,0.3)' }}>how_to_vote</span>
        <p style={{ color: 'rgba(218,226,253,0.55)', fontSize: 14, fontFamily: 'Inter, sans-serif' }}>
          Hiện chưa có cuộc bầu cử nào đang diễn ra.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-12">

      {/* ── ELECTION HEADER ── */}
      {election && (
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(78,222,163,0.12)', border: '1px solid rgba(78,222,163,0.25)' }}
            >
              <span className="live-dot" />
              <span style={{ fontSize: 10, fontFamily: 'Inter, sans-serif', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#4edea3' }}>
                Đang diễn ra
              </span>
            </div>
            {election.onChainId !== null ? (
              <span style={{ fontSize: 10, fontFamily: 'Inter, sans-serif', color: 'rgba(218,226,253,0.3)' }}>
                ID #{election.onChainId}
              </span>
            ) : (
              <span
                style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.25)', color: '#facc15' }}
              >
                Chưa lên chain
              </span>
            )}
          </div>

          <h1
            style={{
              fontFamily: 'Space Grotesk, sans-serif',
              fontSize: 'clamp(28px, 5vw, 48px)',
              fontWeight: 800,
              lineHeight: 1.1,
              letterSpacing: '-0.025em',
              color: '#dae2fd',
            }}
          >
            {election.title}
          </h1>

          {election.description && (
            <p
              className="mt-3 max-w-2xl"
              style={{ fontSize: '15px', lineHeight: 1.75, fontFamily: 'Inter, sans-serif', color: 'rgba(218,226,253,0.55)' }}
            >
              {election.description}
            </p>
          )}

          <p className="mt-4" style={{ ...LABEL_STYLE }}>
            {election.candidates.length} ứng viên
          </p>
        </div>
      )}

      {/* ── ELECTION TABS ── */}
      {elections.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {elections.map((el, idx) => (
            <button
              key={el.id}
              onClick={() => { setSelectedIdx(idx); setSelectedCandidateId(null); setConfirmed(false) }}
              className="flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2"
              style={{
                fontFamily: 'Space Grotesk, sans-serif',
                ...(idx === selectedIdx ? TAB_ACTIVE_STYLE : TAB_INACTIVE_STYLE),
              }}
            >
              <span className="truncate max-w-[140px]">{el.title}</span>
              {vote.voted.has(el.id) && <CheckCircle size={12} style={{ color: '#4edea3', flexShrink: 0 }} />}
            </button>
          ))}
        </div>
      )}

      {/* ── ELIGIBILITY BANNER ── */}
      {!isEligible && (
        <div
          className="flex items-start gap-3 p-4"
          style={{
            background: 'rgba(255,180,171,0.04)',
            border: '1px solid rgba(255,180,171,0.12)',
            borderLeft: '2px solid rgba(255,180,171,0.5)',
            borderRadius: 12,
          }}
        >
          <AlertTriangle size={16} style={{ color: '#ffb4ab', flexShrink: 0, marginTop: 2 }} />
          <div>
            <p
              className="text-sm font-semibold mb-1"
              style={{ fontFamily: 'Space Grotesk, sans-serif', color: '#ffb4ab' }}
            >
              Yêu cầu để bỏ phiếu
            </p>
            <ul
              className="text-xs space-y-0.5 list-disc list-inside"
              style={{ fontFamily: 'Inter, sans-serif', color: 'rgba(218,226,253,0.55)' }}
            >
              {!wallet.address && <li>Kết nối ví MetaMask</li>}
              {wallet.address && !wallet.isCorrectNetwork && <li>Chuyển sang mạng Sapphire Testnet</li>}
              {!isAuthenticated && <li>Đăng nhập bằng ví MetaMask</li>}
            </ul>
          </div>
        </div>
      )}

      {/* ── MAIN GRID ── */}
      <div className="grid grid-cols-12 gap-8 lg:gap-10">

        {/* Left: Candidates (8 cols) */}
        <div className="col-span-12 lg:col-span-8 space-y-md">
          <div className="flex justify-between items-baseline">
            <h2
              style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '20px', fontWeight: 700, letterSpacing: '-0.025em', color: '#dae2fd' }}
            >
              Chọn ứng viên
            </h2>
            {hasVoted && (
              <span style={{ ...LABEL_STYLE, color: '#4edea3' }}>
                Đã bỏ phiếu
              </span>
            )}
          </div>

          {election?.candidates.length === 0 ? (
            <div
              className="text-center py-12 text-sm"
              style={{ fontFamily: 'Inter, sans-serif', color: 'rgba(218,226,253,0.55)' }}
            >
              Chưa có ứng viên nào
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
              {election?.candidates.map((candidate) => {
                const isSelected = selectedCandidateId === candidate.id
                const isVoting = vote.votingFor === candidate.id
                const isVotedFor = votedFor?.candidateId === candidate.id
                const notOnChain = candidate.onChainId === null
                const disabled = hasVoted || !isEligible || notOnChain

                const cardBorder = isVotedFor
                  ? '1px solid rgba(78,222,163,0.35)'
                  : isSelected
                  ? '1px solid rgba(242,202,80,0.4)'
                  : '1px solid rgba(255,255,255,0.07)'

                const cardBg = isVotedFor
                  ? 'rgba(78,222,163,0.05)'
                  : isSelected
                  ? 'rgba(242,202,80,0.07)'
                  : 'rgba(30,41,59,0.4)'

                const cardShadow = isSelected && !isVotedFor
                  ? '0 0 0 1px rgba(242,202,80,0.2), 0 0 24px rgba(242,202,80,0.08)'
                  : 'none'

                return (
                  <div
                    key={candidate.id}
                    onClick={() => !disabled && setSelectedCandidateId(isSelected ? null : candidate.id)}
                    className={`rounded-xl backdrop-blur-xl transition-all relative overflow-hidden group ${
                      disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                    }`}
                    style={{ border: cardBorder, background: cardBg, boxShadow: cardShadow, padding: '28px' }}
                  >
                    {/* Radio indicator */}
                    <div className="absolute top-4 right-4">
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center transition-all"
                        style={{
                          border: isVotedFor
                            ? '2px solid #4edea3'
                            : isSelected
                            ? '2px solid #f2ca50'
                            : '2px solid rgba(255,255,255,0.18)',
                          background: isVotedFor
                            ? 'rgba(78,222,163,0.2)'
                            : isSelected
                            ? 'rgba(242,202,80,0.2)'
                            : 'transparent',
                        }}
                      >
                        {(isVotedFor || isSelected) && (
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ background: isVotedFor ? '#4edea3' : '#f2ca50' }}
                          />
                        )}
                      </div>
                    </div>

                    {/* Candidate info */}
                    <div className="flex flex-col items-center text-center gap-3 mb-4">
                      {candidate.image ? (
                        <div className="relative group/img">
                          <img
                            src={candidate.image}
                            alt={candidate.name}
                            className="w-24 h-24 rounded-2xl object-cover shadow-lg transition-transform group-hover/img:scale-105"
                            style={{
                              border: isVotedFor
                                ? '2px solid #4edea3'
                                : isSelected
                                ? '2px solid #f2ca50'
                                : '2px solid rgba(255,255,255,0.1)',
                            }}
                          />
                          {(isVotedFor || isSelected) && (
                            <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center shadow-md"
                              style={{ background: isVotedFor ? '#4edea3' : '#f2ca50' }}>
                              <span className="material-symbols-outlined text-[14px] text-surface font-bold">
                                check
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div
                          className="w-24 h-24 rounded-2xl flex items-center justify-center text-3xl font-bold shadow-inner"
                          style={{
                            fontFamily: 'Space Grotesk, sans-serif',
                            background: isVotedFor
                              ? 'linear-gradient(135deg, rgba(78,222,163,0.2), rgba(78,222,163,0.05))'
                              : isSelected
                              ? 'linear-gradient(135deg, rgba(242,202,80,0.2), rgba(242,202,80,0.05))'
                              : 'rgba(45,52,73,0.8)',
                            border: isVotedFor
                              ? '1px solid rgba(78,222,163,0.3)'
                              : isSelected
                              ? '1px solid rgba(242,202,80,0.3)'
                              : '1px solid rgba(255,255,255,0.07)',
                            color: isVotedFor ? '#4edea3' : isSelected ? '#f2ca50' : '#8c909f',
                          }}
                        >
                          {candidate.name[0]}
                        </div>
                      )}

                      <div className="min-w-0">
                        <h3
                          style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '18px', fontWeight: 700, color: '#dae2fd' }}
                        >
                          {candidate.name}
                        </h3>
                        {notOnChain ? (
                          <span className="inline-block mt-1 px-2 py-0.5 rounded text-[9px] font-bold tracking-widest uppercase bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
                            Chưa lên chain
                          </span>
                        ) : (
                          <p className="mt-0.5 opacity-40" style={{ ...LABEL_STYLE }}>
                            Ứng cử viên
                          </p>
                        )}
                      </div>
                    </div>

                    {candidate.description && (
                      <p
                        className="text-xs leading-relaxed line-clamp-3 mb-4 text-center px-2"
                        style={{ fontFamily: 'Inter, sans-serif', color: 'rgba(218,226,253,0.6)' }}
                      >
                        {candidate.description}
                      </p>
                    )}

                    <div
                      className="flex justify-between items-center pt-3"
                      style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
                    >
                      {isVotedFor ? (
                        <span className="flex items-center gap-1.5 text-xs font-mono" style={{ color: '#4edea3' }}>
                          <CheckCircle size={12} /> Đã bỏ phiếu
                        </span>
                      ) : isVoting ? (
                        <span className="flex items-center gap-1.5 text-xs font-mono" style={{ color: '#adc6ff' }}>
                          <Loader size={12} className="animate-spin" /> Đang ký...
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono" style={{ color: 'rgba(218,226,253,0.3)' }}>
                          {isSelected ? 'Đã chọn →' : 'Nhấn để chọn'}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Right: Vote action sidebar (4 cols) */}
        <aside className="col-span-12 lg:col-span-4 space-y-md">

          {/* Voted confirmation card */}
          {hasVoted && votedCandidate && (
            <div
              className="p-7"
              style={{
                background: 'rgba(78,222,163,0.04)',
                border: '1px solid rgba(78,222,163,0.15)',
                borderRadius: 16,
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle size={16} style={{ color: '#4edea3', flexShrink: 0 }} />
                <p style={{ ...LABEL_STYLE, color: '#4edea3' }}>
                  Đã bỏ phiếu
                </p>
              </div>
              <div className="flex items-center gap-3">
                {votedCandidate.image && (
                  <img
                    src={votedCandidate.image}
                    alt={votedCandidate.name}
                    className="w-10 h-10 rounded-lg object-cover shrink-0"
                    style={{ border: '1px solid rgba(78,222,163,0.3)' }}
                  />
                )}
                <div>
                  <p className="mb-0.5" style={{ ...LABEL_STYLE }}>
                    Bạn đã bỏ phiếu cho
                  </p>
                  <p
                    className="text-sm font-bold"
                    style={{ fontFamily: 'Space Grotesk, sans-serif', color: '#4edea3' }}
                  >
                    {votedCandidate.name}
                  </p>
                </div>
              </div>
              <p className="mt-3" style={{ ...LABEL_STYLE }}>
                Phiếu đã được ghi vĩnh viễn lên Oasis Sapphire.
              </p>
            </div>
          )}

          {/* Unified vote action panel */}
          <div className="p-7 space-y-md" style={CARD_STYLE}>
            <div className="flex items-center justify-between">
              <h4
                className="text-sm font-bold"
                style={{ fontFamily: 'Space Grotesk, sans-serif', letterSpacing: '-0.025em', color: '#dae2fd' }}
              >
                Bỏ phiếu
              </h4>
              <span
                style={{
                  fontSize: 10,
                  padding: '2px 8px',
                  borderRadius: 999,
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 700,
                  letterSpacing: '0.07em',
                  textTransform: 'uppercase',
                  background: 'rgba(78,222,163,0.12)',
                  border: '1px solid rgba(78,222,163,0.2)',
                  color: '#4edea3',
                }}
              >
                On-chain
              </span>
            </div>

            {/* Eligibility checklist */}
            <div className="space-y-2">
              <CheckRow ok={!!wallet.address} label="Ví kết nối" />
              <CheckRow ok={isAuthenticated} label="Đã xác thực JWT" />
              <CheckRow ok={wallet.isCorrectNetwork} label="Đúng mạng (Sapphire)" />
            </div>

            {/* Transaction fee */}
            <div
              className="p-3 space-y-2"
              style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: 12,
              }}
            >
              <FeeRow label="Phí bỏ phiếu" value={`${VOTE_FEE_NATIVE} ${VOTE_FEE_SYMBOL}`} />
              <FeeRow label="Mạng" value="Sapphire Testnet" />
              <FeeRow label="Loại" value="On-chain" accent />
            </div>

            {/* Selected candidate preview */}
            {selectedCandidate && !hasVoted && (
              <div
                className="p-3"
                style={{ background: 'rgba(242,202,80,0.08)', border: '1px solid rgba(242,202,80,0.2)', borderRadius: 12 }}
              >
                <p className="mb-1.5" style={{ ...LABEL_STYLE }}>
                  Ứng viên đã chọn
                </p>
                <div className="flex items-center gap-2">
                  {selectedCandidate.image ? (
                    <img
                      src={selectedCandidate.image}
                      alt={selectedCandidate.name}
                      className="w-7 h-7 rounded-lg object-cover shrink-0"
                    />
                  ) : (
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ background: 'rgba(242,202,80,0.2)', color: '#f2ca50', fontFamily: 'Space Grotesk, sans-serif' }}
                    >
                      {selectedCandidate.name[0]}
                    </div>
                  )}
                  <span
                    className="text-sm font-bold"
                    style={{ fontFamily: 'Space Grotesk, sans-serif', color: '#f2ca50' }}
                  >
                    {selectedCandidate.name}
                  </span>
                </div>
              </div>
            )}

            {/* Confirmation + submit */}
            {isEligible && !hasVoted && (
              <div className="space-y-3">
                <label className="flex items-start gap-2.5 cursor-pointer group">
                  <input
                    id="confirm"
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                    className="mt-0.5 w-4 h-4 shrink-0 rounded accent-primary cursor-pointer"
                  />
                  <span
                    className="text-xs leading-relaxed"
                    style={{ fontFamily: 'Inter, sans-serif', color: 'rgba(218,226,253,0.55)' }}
                  >
                    Tôi hiểu rằng phiếu bầu này không thể thay đổi và được ghi lên blockchain. Chữ ký ví của tôi sẽ được yêu cầu.
                  </span>
                </label>

                <button
                  onClick={handleVote}
                  disabled={!selectedCandidateId || !confirmed || vote.votingFor !== null || election?.onChainId === null}
                  className="w-full civic-btn py-3.5 rounded-xl flex justify-center items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-all text-sm"
                  style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700 }}
                >
                  {vote.votingFor !== null ? (
                    <><Loader size={15} className="animate-spin" /> Đang ký giao dịch...</>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-lg" style={{ fontSize: 18 }}>fingerprint</span>
                      {selectedCandidateId ? `BỎ PHIẾU (${VOTE_FEE_NATIVE} ${VOTE_FEE_SYMBOL})` : 'CHỌN ỨNG VIÊN'}
                    </>
                  )}
                </button>

                {!selectedCandidateId && (
                  <p
                    className="text-center"
                    style={{ ...LABEL_STYLE }}
                  >
                    Chọn một ứng viên ở bên trái để tiếp tục
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Pending TX notice */}
          {vote.votingFor !== null && (
            <div
              className="flex items-center gap-3 p-4"
              style={{
                background: 'rgba(76,215,246,0.04)',
                border: '1px solid rgba(76,215,246,0.12)',
                borderLeft: '2px solid rgba(76,215,246,0.5)',
                borderRadius: 12,
              }}
            >
              <Loader size={14} className="animate-spin shrink-0" style={{ color: '#4cd7f6' }} />
              <p
                className="text-xs"
                style={{ fontFamily: 'Inter, sans-serif', color: 'rgba(218,226,253,0.55)' }}
              >
                MetaMask đang yêu cầu xác nhận giao dịch...
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
