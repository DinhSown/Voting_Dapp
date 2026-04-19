import { useState, useEffect, useCallback } from 'react'
import { fetchAdminUsers, banUser, getApiErrorMessage } from '../../services/api'
import type { AdminUser } from '../../types'

export function UsersTab() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const limit = 10

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetchAdminUsers(page, limit, search || undefined)
      setUsers(res.data)
      setTotal(res.total)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Không thể tải danh sách người dùng'))
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => { load() }, [load])

  const handleSearch = () => {
    setSearch(searchInput)
    setPage(1)
  }

  const handleBan = async (user: AdminUser) => {
    const action = user.isBanned ? 'bỏ cấm' : 'cấm'
    if (!confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} người dùng "${user.name || user.walletAddress}"?`)) return
    try {
      await banUser(user.id, !user.isBanned)
      load()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Thao tác thất bại'))
    }
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Tìm theo ví, email hoặc tên..."
          className="flex-1 px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-purple-500"
        />
        <button
          onClick={handleSearch}
          className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm transition-colors"
        >
          Tìm
        </button>
      </div>

      <div className="text-xs text-white/40">{total} người dùng</div>

      {loading ? (
        <div className="text-white/40 py-8 text-center text-sm">Đang tải...</div>
      ) : users.length === 0 ? (
        <div className="text-center py-12 text-white/30 text-sm">Không có người dùng nào</div>
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <div
              key={u.id}
              className={`rounded-xl border px-4 py-3 flex items-start justify-between gap-3 ${
                u.isBanned
                  ? 'bg-red-500/5 border-red-500/20'
                  : 'bg-white/5 border-white/10'
              }`}
            >
              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-white truncate">
                    {u.name || 'Unknown User'}
                  </span>
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded-full border ${
                      u.role === 'admin'
                        ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                        : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                    }`}
                  >
                    {u.role}
                  </span>
                  {u.isBanned && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                      Đã cấm
                    </span>
                  )}
                </div>
                <p className="text-xs text-white/40 font-mono">
                  {u.walletAddress
                    ? `${u.walletAddress.slice(0, 10)}...${u.walletAddress.slice(-6)}`
                    : '—'}
                </p>
                {u.email && (
                  <p className="text-xs text-white/40">
                    {u.email.replace(/(.{2}).*(@.*)/, '$1***$2')}
                  </p>
                )}
                <p className="text-xs text-white/25">
                  {u.emailVerified ? 'Đã xác minh' : 'Chưa xác minh'} ·{' '}
                  {new Date(u.createdAt).toLocaleDateString('vi-VN')}
                </p>
              </div>

              <button
                onClick={() => handleBan(u)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors flex-shrink-0 ${
                  u.isBanned
                    ? 'bg-green-600/80 hover:bg-green-500 text-white'
                    : 'bg-white/10 hover:bg-red-500/20 hover:text-red-400 text-white/60'
                }`}
              >
                {u.isBanned ? 'Bỏ cấm' : 'Cấm'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-40 text-sm transition-colors"
          >
            ←
          </button>
          <span className="text-sm text-white/50">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-40 text-sm transition-colors"
          >
            →
          </button>
        </div>
      )}
    </div>
  )
}
