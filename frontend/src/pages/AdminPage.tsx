import { useState, useEffect } from 'react'
import { Users, ScrollText, RefreshCw, Loader } from 'lucide-react'
import { Pagination } from '../components/Pagination'
import { fetchAdminUsers, fetchAdminLogs } from '../services/api'
import type { AdminUser, AdminLog, PaginatedResponse } from '../types'

const PAGE_SIZE = 8

type AdminTab = 'users' | 'logs'

export function AdminPage() {
  const [tab, setTab] = useState<AdminTab>('users')

  const [users, setUsers] = useState<PaginatedResponse<AdminUser> | null>(null)
  const [usersPage, setUsersPage] = useState(1)
  const [usersLoading, setUsersLoading] = useState(false)
  const [usersError, setUsersError] = useState('')

  const [logs, setLogs] = useState<PaginatedResponse<AdminLog> | null>(null)
  const [logsPage, setLogsPage] = useState(1)
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsError, setLogsError] = useState('')

  useEffect(() => {
    if (tab !== 'users') return
    setUsersLoading(true)
    setUsersError('')
    fetchAdminUsers(usersPage, PAGE_SIZE)
      .then(setUsers)
      .catch(() => setUsersError('Không thể tải danh sách người dùng'))
      .finally(() => setUsersLoading(false))
  }, [tab, usersPage])

  useEffect(() => {
    if (tab !== 'logs') return
    setLogsLoading(true)
    setLogsError('')
    fetchAdminLogs(logsPage, PAGE_SIZE)
      .then(setLogs)
      .catch(() => setLogsError('Không thể tải nhật ký'))
      .finally(() => setLogsLoading(false))
  }, [tab, logsPage])

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Quản trị viên</h2>
        <button
          onClick={() => {
            if (tab === 'users') setUsersPage(1)
            else setLogsPage(1)
          }}
          className="p-2 rounded-xl border border-white/10 text-white/50 hover:text-white hover:bg-white/5 transition-all"
          aria-label="Làm mới"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setTab('users')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
            tab === 'users'
              ? 'bg-[#f2ca50]/20 border-[#f2ca50]/40 text-[#f2ca50]'
              : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
          }`}
        >
          <Users size={14} /> Người dùng
          {users && (
            <span className="ml-1 text-xs bg-white/10 px-1.5 py-0.5 rounded-full">
              {users.total}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('logs')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
            tab === 'logs'
              ? 'bg-[#f2ca50]/20 border-[#f2ca50]/40 text-[#f2ca50]'
              : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
          }`}
        >
          <ScrollText size={14} /> Nhật ký
          {logs && (
            <span className="ml-1 text-xs bg-white/10 px-1.5 py-0.5 rounded-full">
              {logs.total}
            </span>
          )}
        </button>
      </div>

      {tab === 'users' && (
        <div className="panel overflow-hidden">
          {usersLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader size={20} className="animate-spin text-white/40" />
            </div>
          ) : usersError ? (
            <p className="text-sm text-red-400 p-4">{usersError}</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left px-4 py-3 text-xs text-white/40 font-medium">ID</th>
                      <th className="text-left px-4 py-3 text-xs text-white/40 font-medium">Email</th>
                      <th className="text-left px-4 py-3 text-xs text-white/40 font-medium">Số ĐT</th>
                      <th className="text-left px-4 py-3 text-xs text-white/40 font-medium">Ví</th>
                      <th className="text-left px-4 py-3 text-xs text-white/40 font-medium">Trạng thái</th>
                      <th className="text-left px-4 py-3 text-xs text-white/40 font-medium">Ngày tạo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users?.data.map((user) => (
                      <tr key={user.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                        <td className="px-4 py-3 text-white/40">{user.id}</td>
                        <td className="px-4 py-3 text-white/80">{user.email ?? '—'}</td>
                        <td className="px-4 py-3 text-white/80">{user.phone ?? '—'}</td>
                        <td className="px-4 py-3 font-mono text-xs text-white/60">
                          {user.walletAddress
                            ? `${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-4)}`
                            : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              user.isVerified
                                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                : 'bg-white/10 text-white/40 border border-white/10'
                            }`}
                          >
                            {user.isVerified ? 'Đã xác minh' : 'Chưa xác minh'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-white/40">{formatDate(user.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-4 border-t border-white/10">
                <Pagination
                  page={usersPage}
                  total={users?.total ?? 0}
                  limit={PAGE_SIZE}
                  onPageChange={setUsersPage}
                />
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'logs' && (
        <div className="panel overflow-hidden">
          {logsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader size={20} className="animate-spin text-white/40" />
            </div>
          ) : logsError ? (
            <p className="text-sm text-red-400 p-4">{logsError}</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left px-4 py-3 text-xs text-white/40 font-medium">Thời gian</th>
                      <th className="text-left px-4 py-3 text-xs text-white/40 font-medium">Hành động</th>
                      <th className="text-left px-4 py-3 text-xs text-white/40 font-medium">Mô tả</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs?.data.map((log) => (
                      <tr key={log.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                        <td className="px-4 py-3 text-xs text-white/40 whitespace-nowrap">
                          {formatDate(log.timestamp)}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-mono">
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-white/60">{log.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-4 border-t border-white/10">
                <Pagination
                  page={logsPage}
                  total={logs?.total ?? 0}
                  limit={PAGE_SIZE}
                  onPageChange={setLogsPage}
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
