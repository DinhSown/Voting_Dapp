import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  page: number
  total: number
  limit: number
  onPageChange: (page: number) => void
}

export function Pagination({ page, total, limit, onPageChange }: Props) {
  const totalPages = Math.ceil(total / limit)
  if (totalPages <= 1) return null

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)

  return (
    <div className="flex items-center gap-2 justify-center mt-4">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        className="p-1.5 rounded-lg border border-white/10 text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        aria-label="Previous page"
      >
        <ChevronLeft size={16} />
      </button>

      {pages.map((p) => (
        <button
          key={p}
          onClick={() => onPageChange(p)}
          className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${
            p === page
              ? 'bg-[#f2ca50] text-black'
              : 'border border-white/10 text-white/60 hover:text-white hover:bg-white/10'
          }`}
        >
          {p}
        </button>
      ))}

      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page === totalPages}
        className="p-1.5 rounded-lg border border-white/10 text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        aria-label="Next page"
      >
        <ChevronRight size={16} />
      </button>

      <span className="text-xs text-white/40 ml-2">
        {page} / {totalPages} ({total} mục)
      </span>
    </div>
  )
}
