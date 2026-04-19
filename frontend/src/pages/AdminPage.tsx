import { useState, useEffect, useCallback } from 'react'
import { ScrollText, Loader, Vote, Users } from 'lucide-react'
import { Pagination } from '../components/Pagination'
import { fetchAdminLogs } from '../services/api'
import { useAuthContext } from '../context/AuthContext'
import { ElectionsTab } from './admin/ElectionsTab'
import { UsersTab } from './admin/UsersTab'
import type { AdminLog, PaginatedResponse } from '../types'

const PAGE_SIZE = 8

type AdminTab = 'elections' | 'users' | 'logs'

export function AdminPage() {
  const { isAdmin, loading: authLoading } = useAuthContext()
  const [tab, setTab] = useState<AdminTab>('elections')

  const [logs, setLogs] = useState<PaginatedResponse<AdminLog> | null>(null)
  const [logsPage, setLogsPage] = useState(1)
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsError, setLogsError] = useState('')

  const loadLogs = useCallback(() => {
    if (tab !== 'logs') return
    setLogsLoading(true)
    setLogsError('')
    fetchAdminLogs(logsPage, PAGE_SIZE)
      .then(setLogs)
      .catch(() => setLogsError('Không thể tải nhật ký'))
      .finally(() => setLogsLoading(false))
  }, [tab, logsPage])

  useEffect(() => { loadLogs() }, [loadLogs])

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader size={20} className="animate-spin text-white/40" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="text-center py-20 space-y-3">
        <div className="text-4xl">🔒</div>
        <p className="text-white/60 text-sm">Bạn không có quyền truy cập trang này</p>
      </div>
    )
  }

  const tabs: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
    { id: 'elections', label: 'Bầu cử', icon: <Vote size={14} /> },
    { id: 'users', label: 'Người dùng', icon: <Users size={14} /> },
    { id: 'logs', label: 'Nhật ký', icon: <ScrollText size={14} /> },
  ]

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-white">Quản trị viên</h2>

      {/* Tabs */}
      <div className="flex gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
              tab === t.id
                ? 'bg-[#f2ca50]/20 border-[#f2ca50]/40 text-[#f2ca50]'
                : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'elections' && <ElectionsTab />}
      {tab === 'users' && <UsersTab />}

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
