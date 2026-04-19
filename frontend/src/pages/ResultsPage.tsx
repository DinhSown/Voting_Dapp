import { useState, useEffect, useCallback } from 'react'
import { Trophy, ChevronRight, RefreshCw } from 'lucide-react'
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

const ITEMS_PER_PAGE = 3
const RANK_COLORS = ['text-yellow-400', 'text-gray-300', 'text-amber-600']
const RANK_BG = [
  'bg-yellow-400/10 border-yellow-400/30',
  'bg-gray-400/10 border-gray-400/30',
  'bg-amber-600/10 border-amber-600/30',
]

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

  function handleElectionChange(idx: number) {
    setSelectedIdx(idx)
    setPage(1)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy size={20} className="text-[#f2ca50]" />
          <h2 className="text-lg font-bold text-white">Kết quả bầu cử</h2>
          {!loading && election && (
            <span className="text-xs text-white/30 ml-1">({totalVotes} phiếu)</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={load}
            disabled={loading}
            className="text-white/30 hover:text-white/70 transition-colors disabled:opacity-30"
            title="Làm mới"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => onNavigate('vote')}
            className="text-xs text-white/50 hover:text-white transition-colors flex items-center gap-1"
          >
            Bỏ phiếu <ChevronRight size={12} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          <div className="flex gap-2">
            {[1, 2].map((i) => <div key={i} className="h-9 w-32 rounded-xl bg-white/5 animate-pulse" />)}
          </div>
          {[1, 2, 3].map((i) => <div key={i} className="panel p-4 h-16 animate-pulse bg-white/5" />)}
        </div>
      ) : elections.length === 0 ? (
        <div className="text-center py-20 space-y-3">
          <div className="text-4xl">📊</div>
          <p className="text-white/50 text-sm">Chưa có cuộc bầu cử nào.</p>
        </div>
      ) : (
        <>
          {/* Election tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {elections.map((el, idx) => {
              const elVotes = voteData.filter((v) => v.categoryId === el.id).reduce((s, v) => s + v.voteCount, 0)
              return (
                <button
                  key={el.id}
                  onClick={() => handleElectionChange(idx)}
                  className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium border transition-all flex items-center gap-2 ${
                    idx === selectedIdx
                      ? 'bg-[#f2ca50]/20 border-[#f2ca50]/40 text-[#f2ca50]'
                      : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                  }`}
                >
                  <span className="truncate max-w-[140px]">{el.title}</span>
                  {elVotes > 0 && <span className="text-xs opacity-60 shrink-0">({elVotes})</span>}
                </button>
              )
            })}
          </div>

          {/* Results */}
          <div className="space-y-3">
            {paginatedResults.map((result) => {
              const rankIdx = result.rank - 1
              const isTopThree = result.rank <= 3
              const maxVotes = allResults[0]?.votes ?? 1
              const pct = maxVotes > 0 ? Math.round((result.votes / maxVotes) * 100) : 0
              return (
                <div
                  key={result.id}
                  className={`panel p-4 flex items-center gap-4 ${isTopThree ? RANK_BG[rankIdx] : ''}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                    isTopThree ? RANK_COLORS[rankIdx] : 'text-white/30'
                  }`}>
                    {isTopThree ? <Trophy size={16} /> : result.rank}
                  </div>

                  <img src={result.image} alt={result.name}
                    className="w-10 h-10 rounded-full object-cover shrink-0" />

                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${isTopThree ? RANK_COLORS[rankIdx] : 'text-white'}`}>
                      {result.name}
                    </p>
                    <div className="mt-1.5 w-full bg-white/10 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full transition-all ${isTopThree ? 'bg-current opacity-60' : 'bg-white/30'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className={`text-sm font-bold ${isTopThree ? RANK_COLORS[rankIdx] : 'text-white'}`}>
                      {result.votes}
                    </p>
                    <p className="text-xs text-white/40">phiếu</p>
                  </div>
                </div>
              )
            })}

            {allResults.every((r) => r.votes === 0) && (
              <div className="text-center py-8 text-white/30 text-sm">
                Chưa có phiếu nào trong cuộc bầu cử này
              </div>
            )}
          </div>

          <Pagination
            page={page}
            total={allResults.length}
            limit={ITEMS_PER_PAGE}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  )
}
