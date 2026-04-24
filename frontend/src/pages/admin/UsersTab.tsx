import { useState, useEffect, useCallback } from 'react'
import { fetchAdminUsers, banUser, getApiErrorMessage } from '../../services/api'
import type { AdminUser } from '../../types'

function initials(user: AdminUser) {
  if (user.name) return user.name.trim().split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
  if (user.walletAddress) return user.walletAddress.slice(2, 4).toUpperCase()
  return '??'
}

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

  const handleSearch = () => { setSearch(searchInput); setPage(1) }

  const handleBan = async (user: AdminUser) => {
    const action = user.isBanned ? 'bỏ cấm' : 'cấm'
    if (!confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} người dùng "${user.name || user.walletAddress}"?`)) return
    try { await banUser(user.id, !user.isBanned); load() }
    catch (err) { setError(getApiErrorMessage(err, 'Thao tác thất bại')) }
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl bg-error/10 border border-error/20 px-4 py-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-error text-[18px]">error</span>
          <span className="text-sm text-error">{error}</span>
        </div>
      )}

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[17px] text-outline pointer-events-none">
            search
          </span>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Tìm theo ví, email hoặc tên..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-surface-container border border-white/10 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-primary/40 transition-colors"
          />
        </div>
        <button
          onClick={handleSearch}
          className="px-4 py-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-sm text-on-surface-variant border border-white/5 transition-colors"
        >
          Tìm
        </button>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-outline">{total} người dùng</span>
          {search && (
            <button
              onClick={() => { setSearch(''); setSearchInput(''); setPage(1) }}
              className="flex items-center gap-0.5 text-xs text-on-surface-variant hover:text-on-surface transition-colors"
            >
              <span className="material-symbols-outlined text-[13px]">close</span>
              Xóa bộ lọc
            </button>
          )}
        </div>
      </div>

      {/* ── Table ── */}
      <div className="glass-card rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2">
            <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            <span className="text-sm text-on-surface-variant">Đang tải...</span>
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <span className="material-symbols-outlined text-4xl text-outline">person_search</span>
            <p className="text-sm text-on-surface-variant">Không có người dùng nào</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-outline uppercase tracking-widest"
                  style={{ fontFamily: 'Inter, sans-serif' }}>Người dùng</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-outline uppercase tracking-widest hidden sm:table-cell"
                  style={{ fontFamily: 'Inter, sans-serif' }}>Vai trò</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-outline uppercase tracking-widest hidden md:table-cell"
                  style={{ fontFamily: 'Inter, sans-serif' }}>Ví / Email</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-outline uppercase tracking-widest hidden lg:table-cell"
                  style={{ fontFamily: 'Inter, sans-serif' }}>Ngày tạo</th>
                <th className="text-right px-5 py-3 text-[11px] font-semibold text-outline uppercase tracking-widest"
                  style={{ fontFamily: 'Inter, sans-serif' }}>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.id}
                  className={`border-b border-white/5 hover:bg-white/[0.025] transition-colors ${u.isBanned ? 'bg-error/[0.03]' : ''}`}
                >
                  {/* User cell */}
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                        <span className="text-xs font-semibold text-primary" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                          {initials(u)}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-on-surface leading-none mb-0.5"
                          style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                          {u.name || 'Unknown User'}
                        </p>
                        <div className="flex items-center gap-1.5">
                          {u.isBanned && (
                            <span className="text-[10px] text-error">Đã cấm</span>
                          )}
                          {!u.emailVerified && (
                            <span className="text-[10px] text-outline">Chưa xác minh</span>
                          )}
                          {u.emailVerified && !u.isBanned && (
                            <span className="text-[10px] text-outline">Đã xác minh</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Role cell */}
                  <td className="px-5 py-3 hidden sm:table-cell">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${
                      u.role === 'admin'
                        ? 'bg-secondary/15 text-secondary border-secondary/20'
                        : 'bg-primary/10 text-primary border-primary/15'
                    }`}>
                      {u.role}
                    </span>
                  </td>

                  {/* Wallet / Email cell */}
                  <td className="px-5 py-3 hidden md:table-cell">
                    <div className="space-y-0.5">
                      {u.walletAddress && (
                        <p className="text-xs text-on-surface-variant font-mono">
                          {u.walletAddress.slice(0, 8)}…{u.walletAddress.slice(-6)}
                        </p>
                      )}
                      {u.email && (
                        <p className="text-xs text-outline">
                          {u.email.replace(/(.{2}).*(@.*)/, '$1***$2')}
                        </p>
                      )}
                    </div>
                  </td>

                  {/* Date cell */}
                  <td className="px-5 py-3 hidden lg:table-cell">
                    <span className="text-xs text-outline">
                      {new Date(u.createdAt).toLocaleDateString('vi-VN')}
                    </span>
                  </td>

                  {/* Action cell */}
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => handleBan(u)}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all border ${
                        u.isBanned
                          ? 'bg-tertiary/10 hover:bg-tertiary/20 text-tertiary border-tertiary/20'
                          : 'bg-surface-container-high hover:bg-error/10 hover:text-error hover:border-error/20 text-on-surface-variant border-white/5'
                      }`}
                    >
                      {u.isBanned ? 'Bỏ cấm' : 'Cấm'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* ── Pagination ── */}
        {totalPages > 1 && !loading && (
          <div className="flex items-center justify-center gap-2 px-5 py-3.5 border-t border-white/10">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest disabled:opacity-30 text-on-surface-variant border border-white/5 transition-all"
            >
              <span className="material-symbols-outlined text-[16px]">chevron_left</span>
            </button>
            <span className="text-xs text-on-surface-variant px-2">{page} / {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest disabled:opacity-30 text-on-surface-variant border border-white/5 transition-all"
            >
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
