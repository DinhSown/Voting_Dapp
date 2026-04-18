import { useState } from 'react'
import { Trophy, ChevronRight } from 'lucide-react'
import { Pagination } from '../components/Pagination'
import { CATEGORIES } from '../constants'

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

function getMockResults(categoryId: number): CandidateResult[] {
  const category = CATEGORIES.find((c) => c.id === categoryId)
  if (!category) return []
  const sorted = category.nominees
    .map((n, i) => ({
      id: n.id,
      name: n.name,
      image: n.image,
      votes: 150 - i * 40,
      rank: 0,
    }))
    .sort((a, b) => b.votes - a.votes)
  return sorted.map((r, i) => ({ ...r, rank: i + 1 }))
}

export function ResultsPage({ onNavigate }: Props) {
  const [selectedCategory, setSelectedCategory] = useState(0)
  const [page, setPage] = useState(1)

  const category = CATEGORIES[selectedCategory]
  const allResults = getMockResults(category.id)
  const totalItems = allResults.length
  const paginatedResults = allResults.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)

  function handleCategoryChange(idx: number) {
    setSelectedCategory(idx)
    setPage(1)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy size={20} className="text-[#f2ca50]" />
          <h2 className="text-lg font-bold text-white">Kết quả bầu cử</h2>
        </div>
        <button
          onClick={() => onNavigate('vote')}
          className="text-xs text-white/50 hover:text-white transition-colors flex items-center gap-1"
        >
          Bỏ phiếu <ChevronRight size={12} />
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {CATEGORIES.map((cat, idx) => (
          <button
            key={cat.id}
            onClick={() => handleCategoryChange(idx)}
            className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
              idx === selectedCategory
                ? 'bg-[#f2ca50]/20 border-[#f2ca50]/40 text-[#f2ca50]'
                : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
            }`}
          >
            {cat.icon}{' '}
            <span className="hidden sm:inline ml-1">{cat.title}</span>
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {paginatedResults.map((result) => {
          const rankIdx = result.rank - 1
          const isTopThree = result.rank <= 3
          return (
            <div
              key={result.id}
              className={`panel p-4 flex items-center gap-4 ${isTopThree ? RANK_BG[rankIdx] : ''}`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                  isTopThree ? RANK_COLORS[rankIdx] : 'text-white/30'
                }`}
              >
                {isTopThree ? <Trophy size={16} /> : result.rank}
              </div>

              <img
                src={result.image}
                alt={result.name}
                className="w-10 h-10 rounded-full object-cover shrink-0"
              />

              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-semibold ${isTopThree ? RANK_COLORS[rankIdx] : 'text-white'}`}
                >
                  {result.name}
                </p>
                <p className="text-xs text-white/40 mt-0.5">Hạng #{result.rank}</p>
              </div>

              <div className="text-right shrink-0">
                <p
                  className={`text-sm font-bold ${isTopThree ? RANK_COLORS[rankIdx] : 'text-white'}`}
                >
                  {result.votes}
                </p>
                <p className="text-xs text-white/40">phiếu</p>
              </div>
            </div>
          )
        })}
      </div>

      <Pagination
        page={page}
        total={totalItems}
        limit={ITEMS_PER_PAGE}
        onPageChange={setPage}
      />
    </div>
  )
}
