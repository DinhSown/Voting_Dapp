import { useState, useEffect, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'
import { Pagination } from '../components/Pagination'
import { fetchPublicElections, fetchResults } from '../services/api'
import type { Election, VoteResult } from '../types'

interface CandidateResult {
  id: number
  name: string
  image: string
  votes: number
  rank: number
}

interface Props {
  onNavigate: (route: string) => void
}

const ITEMS_PER_PAGE = 5

function buildResults(election: Election, voteData: VoteResult[]): CandidateResult[] {
  const voteMap = new Map(
    voteData.filter((v) => v.categoryId === election.id).map((v) => [v.candidateId, v.voteCount])
  )
  return election.candidates
    .filter((c) => !c.isRemoved)
    .map((c) => ({
      id: c.id,
      name: c.name,
      image: c.image || `https://i.pravatar.cc/150?img=${c.id % 70}`,
      votes: voteMap.get(c.id) ?? 0,
      rank: 0,
    }))
    .sort((a, b) => b.votes - a.votes)
    .map((r, i) => ({ ...r, rank: i + 1 }))
}

function rankAccent(rank: number): string {
  if (rank === 1) return '#F59E0B'
  if (rank === 2) return '#adc6ff'
  if (rank === 3) return '#4edea3'
  return 'rgba(140,144,159,0.4)'
}

function IntegrityRow({ label, value, accent, live }: {
  label: string
  value: string
  accent?: string
  live?: boolean
}) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-[10px] text-outline font-mono">{label}</span>
      <div className="flex items-center gap-1.5">
        {live && <span className="live-dot" />}
        <span className={`text-[10px] font-mono font-bold ${accent ?? 'text-on-surface'}`}>{value}</span>
      </div>
    </div>
  )
}

export function ResultsPage({ onNavigate }: Props) {
  const [elections, setElections] = useState<Election[]>([])
  const [voteData, setVoteData] = useState<VoteResult[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [page, setPage] = useState(1)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([fetchPublicElections(false), fetchResults()])
      .then(([els, votes]) => { setElections(els); setVoteData(votes) })
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const election = elections[selectedIdx]
  const allResults = election ? buildResults(election, voteData) : []
  const totalVotes = election
    ? voteData.filter((v) => v.categoryId === election.id).reduce((s, v) => s + v.voteCount, 0)
    : 0
  const paginatedResults = allResults.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)
  const maxVotes = allResults[0]?.votes || 1
  const leader = allResults[0]
  const leaderShare = totalVotes > 0 && leader?.votes > 0
    ? Math.round((leader.votes / totalVotes) * 100)
    : 0

  function handleElectionChange(idx: number) {
    setSelectedIdx(idx)
    setPage(1)
  }

  if (loading) {
    return (
      <div className="space-y-12">
        <div className="h-44 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
        <div className="flex gap-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-9 w-32 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
          ))}
        </div>
        <div className="grid grid-cols-12 gap-gutter">
          <div className="col-span-12 lg:col-span-8 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
            ))}
          </div>
          <div className="col-span-12 lg:col-span-4 space-y-gutter">
            <div className="h-72 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
            <div className="h-40 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
          </div>
        </div>
      </div>
    )
  }

  if (elections.length === 0) {
    return (
      <div className="text-center py-24 space-y-4">
        <span className="material-symbols-outlined text-7xl text-outline" style={{ opacity: 0.4 }}>bar_chart</span>
        <p className="text-on-surface-variant text-sm">Chưa có cuộc bầu cử nào.</p>
      </div>
    )
  }

  return (
    <div className="space-y-12">

      {/* ── HEADER ── */}
      <div>
        {/* Top row: eyebrow badge + action buttons */}
        <div className="flex items-center justify-between mb-4">
          <div
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
            style={{ background: 'rgba(76,215,246,0.10)', border: '1px solid rgba(76,215,246,0.22)' }}
          >
            <span className="live-dot" style={{ background: '#4cd7f6', animation: 'none' }} />
            <span
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.09em',
                textTransform: 'uppercase',
                color: 'rgba(218,226,253,0.3)',
              }}
            >
              Kết quả cuối cùng
            </span>
          </div>

          <div className="flex gap-2 shrink-0">
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl transition-colors disabled:opacity-40"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                color: 'rgba(218,226,253,0.4)',
              }}
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              <span
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: '0.09em',
                  textTransform: 'uppercase' as const,
                  color: 'rgba(218,226,253,0.4)',
                }}
              >
                Làm mới
              </span>
            </button>
            <button
              onClick={() => onNavigate('vote')}
              className="civic-btn px-4 py-2 flex items-center gap-2 rounded-xl active:scale-95 transition-transform"
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.09em',
                textTransform: 'uppercase' as const,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>how_to_vote</span>
              Bỏ phiếu
            </button>
          </div>
        </div>

        {/* h1 title */}
        <h1
          className="text-on-surface"
          style={{
            fontFamily: 'Space Grotesk, sans-serif',
            fontSize: 'clamp(28px, 5vw, 48px)',
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: '-0.025em',
          }}
        >
          {election?.title ?? 'Kết quả bầu cử'}
        </h1>

        {/* Stats strip */}
        <div className="flex flex-wrap items-center gap-6 mt-4">
          <div>
            <p
              className="text-on-surface font-bold"
              style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 28, fontWeight: 800, lineHeight: 1 }}
            >
              {totalVotes.toLocaleString()}
            </p>
            <p
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.09em',
                textTransform: 'uppercase' as const,
                color: 'rgba(218,226,253,0.3)',
                marginTop: 2,
              }}
            >
              Tổng phiếu
            </p>
          </div>
          <div className="w-px h-8 self-center" style={{ background: 'rgba(255,255,255,0.08)' }} />
          <div>
            <p
              className="text-on-surface font-bold"
              style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 28, fontWeight: 800, lineHeight: 1 }}
            >
              {allResults.length}
            </p>
            <p
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.09em',
                textTransform: 'uppercase' as const,
                color: 'rgba(218,226,253,0.3)',
                marginTop: 2,
              }}
            >
              Ứng viên
            </p>
          </div>
          <div className="w-px h-8 self-center" style={{ background: 'rgba(255,255,255,0.08)' }} />
          <div>
            <p
              className="font-bold"
              style={{
                fontFamily: 'Space Grotesk, sans-serif',
                fontSize: 28,
                fontWeight: 800,
                lineHeight: 1,
                color: leaderShare > 0 ? '#F59E0B' : '#8c909f',
              }}
            >
              {leaderShare > 0 ? `${leaderShare}%` : '—'}
            </p>
            <p
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.09em',
                textTransform: 'uppercase' as const,
                color: 'rgba(218,226,253,0.3)',
                marginTop: 2,
              }}
            >
              {leader?.votes > 0 ? leader.name : 'Dẫn đầu'}
            </p>
          </div>
        </div>
      </div>

      {/* ── ELECTION TABS ── */}
      {elections.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {elections.map((el, idx) => {
            const elVotes = voteData.filter((v) => v.categoryId === el.id).reduce((s, v) => s + v.voteCount, 0)
            const isActive = idx === selectedIdx
            return (
              <button
                key={el.id}
                onClick={() => handleElectionChange(idx)}
                className="flex-shrink-0 flex items-center gap-2 transition-all"
                style={
                  isActive
                    ? {
                        background: 'rgba(173,198,255,0.1)',
                        border: '1px solid rgba(173,198,255,0.2)',
                        color: '#adc6ff',
                        borderRadius: 10,
                        padding: '6px 16px',
                        fontSize: 13,
                        fontWeight: 600,
                        fontFamily: 'Space Grotesk, sans-serif',
                      }
                    : {
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.07)',
                        color: 'rgba(218,226,253,0.4)',
                        borderRadius: 10,
                        padding: '6px 16px',
                        fontSize: 13,
                        fontFamily: 'Space Grotesk, sans-serif',
                      }
                }
              >
                <span className="truncate max-w-[140px]">{el.title}</span>
                {elVotes > 0 && (
                  <span className="text-[10px] opacity-50 shrink-0 font-mono">({elVotes})</span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* ── MAIN GRID ── */}
      <div className="grid grid-cols-12 gap-gutter">

        {/* Left: Leaderboard (8 cols) */}
        <div className="col-span-12 lg:col-span-8 space-y-md">
          <div className="flex items-baseline justify-between">
            <h2
              className="text-on-surface"
              style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 20, fontWeight: 700 }}
            >
              Bảng xếp hạng
            </h2>
            <span
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.09em',
                textTransform: 'uppercase' as const,
                color: 'rgba(218,226,253,0.3)',
              }}
            >
              {allResults.length} ứng viên
            </span>
          </div>

          {!allResults.some((r) => r.votes > 0) ? (
            <div
              className="rounded-xl p-lg text-center"
              style={{
                background: 'rgba(255,255,255,0.025)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 16,
              }}
            >
              <span className="material-symbols-outlined text-outline text-4xl mb-3 block" style={{ opacity: 0.4 }}>
                how_to_vote
              </span>
              <p className="text-on-surface-variant text-sm">Chưa có phiếu nào trong cuộc bầu cử này.</p>
            </div>
          ) : (
            <div
              className="overflow-hidden"
              style={{
                background: 'rgba(255,255,255,0.025)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 16,
              }}
            >
              {paginatedResults.map((result, i) => {
                const pct = maxVotes > 0 ? (result.votes / maxVotes) * 100 : 0
                const sharePct = totalVotes > 0 ? Math.round((result.votes / totalVotes) * 100) : 0
                const accent = rankAccent(result.rank)
                const isTop = result.rank <= 3
                const isLast = i === paginatedResults.length - 1

                return (
                  <div
                    key={result.id}
                    className="px-md py-4"
                    style={{
                      borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.04)',
                    }}
                  >
                    {/* Top row: rank + avatar + name + pct */}
                    <div className="flex items-center gap-3 mb-2.5">
                      <span
                        className="w-8 text-right shrink-0 font-mono font-bold text-xs"
                        style={{ color: accent }}
                      >
                        #{result.rank}
                      </span>
                      <img
                        src={result.image}
                        alt={result.name}
                        className="w-9 h-9 rounded-full object-cover shrink-0"
                        style={{ border: `1px solid ${isTop ? accent + '50' : 'rgba(255,255,255,0.07)'}` }}
                      />
                      <span
                        className="flex-1 font-bold truncate"
                        style={{
                          fontFamily: 'Space Grotesk, sans-serif',
                          fontSize: 15,
                          color: isTop ? '#dae2fd' : '#c2c6d6',
                        }}
                      >
                        {result.name}
                      </span>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-sm" style={{ fontFamily: 'Space Grotesk, sans-serif', color: accent }}>
                          {sharePct}%
                        </p>
                        <p className="font-mono text-[10px] text-outline">{result.votes} phiếu</p>
                      </div>
                    </div>

                    {/* Bar */}
                    <div
                      className="h-1.5 rounded-full overflow-hidden"
                      style={{ background: 'rgba(44,52,73,0.8)', marginLeft: 44 }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          background: accent,
                          boxShadow: isTop ? `0 0 8px ${accent}55` : 'none',
                          transition: 'width 0.8s cubic-bezier(0.23,1,0.32,1)',
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <Pagination
            page={page}
            total={allResults.length}
            limit={ITEMS_PER_PAGE}
            onPageChange={setPage}
          />
        </div>

        {/* Right sidebar (4 cols) */}
        <div className="col-span-12 lg:col-span-4 space-y-md">

          {/* Winner spotlight */}
          {leader?.votes > 0 ? (
            <div
              className="rounded-xl p-md"
              style={{
                background: 'rgba(245,158,11,0.04)',
                border: '1px solid rgba(245,158,11,0.12)',
                borderRadius: 16,
              }}
            >
              {/* Label */}
              <div className="flex items-center justify-between mb-4">
                <p
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: '0.09em',
                    textTransform: 'uppercase' as const,
                    color: '#F59E0B',
                  }}
                >
                  Dẫn đầu
                </p>
                <span className="text-[10px] font-mono text-outline">#1</span>
              </div>

              {/* Winner avatar + name */}
              <div className="flex items-center gap-3 mb-4">
                <img
                  src={leader.image}
                  alt={leader.name}
                  className="w-16 h-16 rounded-xl object-cover shrink-0"
                  style={{
                    border: '2px solid rgba(245,158,11,0.4)',
                    boxShadow: '0 0 20px rgba(245,158,11,0.12)',
                  }}
                />
                <div className="min-w-0">
                  <p
                    className="text-on-surface font-bold truncate"
                    style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 17, fontWeight: 800, lineHeight: 1.2 }}
                  >
                    {leader.name}
                  </p>
                  <p className="text-[10px] text-outline mt-1 font-mono">{leader.votes} phiếu</p>
                </div>
              </div>

              {/* Big percentage */}
              <div className="mb-5">
                <span
                  className="font-bold"
                  style={{
                    fontFamily: 'Space Grotesk, sans-serif',
                    fontSize: 44,
                    fontWeight: 800,
                    color: '#F59E0B',
                    lineHeight: 1,
                    display: 'block',
                  }}
                >
                  {leaderShare}%
                </span>
                <span className="text-[10px] text-outline" style={{ fontFamily: 'Inter, sans-serif' }}>
                  của tổng phiếu bầu
                </span>
              </div>

              {/* Mini #2, #3 */}
              {allResults.slice(1, 3).filter((r) => r.votes > 0).map((r) => {
                const rShare = totalVotes > 0 ? Math.round((r.votes / totalVotes) * 100) : 0
                const accent = rankAccent(r.rank)
                return (
                  <div key={r.id} className="flex items-center gap-2 mb-2">
                    <span className="font-mono text-[10px] shrink-0 text-right" style={{ color: accent, width: 18 }}>
                      #{r.rank}
                    </span>
                    <img src={r.image} alt={r.name} className="w-5 h-5 rounded-full object-cover shrink-0" />
                    <span className="text-xs text-on-surface-variant truncate flex-1">{r.name}</span>
                    <span className="font-mono text-[10px] shrink-0" style={{ color: accent }}>{rShare}%</span>
                  </div>
                )
              })}

              <button
                onClick={() => onNavigate('vote')}
                className="w-full mt-4 civic-btn py-3 rounded-xl text-sm active:scale-[0.98] transition-transform"
                style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700 }}
              >
                Tham gia bỏ phiếu →
              </button>
            </div>
          ) : (
            <div
              className="rounded-xl p-md text-center"
              style={{
                background: 'rgba(255,255,255,0.025)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 16,
              }}
            >
              <span className="material-symbols-outlined text-outline text-3xl mb-2 block" style={{ opacity: 0.4 }}>
                emoji_events
              </span>
              <p className="text-xs text-on-surface-variant">Chưa có phiếu nào</p>
            </div>
          )}

          {/* Integrity panel */}
          <div
            className="p-md rounded-xl"
            style={{
              background: 'rgba(255,255,255,0.025)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 16,
            }}
          >
            <p
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.09em',
                textTransform: 'uppercase' as const,
                color: 'rgba(218,226,253,0.3)',
                marginBottom: 16,
              }}
            >
              Tính toàn vẹn
            </p>
            <div className="space-y-3">
              <IntegrityRow label="Nền tảng" value="Oasis Sapphire" />
              <IntegrityRow label="Loại" value="Smart Contract" accent="text-tertiary" />
              <IntegrityRow label="Trạng thái" value="Healthy" accent="text-tertiary" live />
              <IntegrityRow label="Xác minh" value="On-chain" accent="text-secondary" />
            </div>
            <div className="mt-4 flex justify-center">
              <span
                className="material-symbols-outlined text-outline"
                style={{ fontSize: 48, opacity: 0.2 }}
              >
                fingerprint
              </span>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
