import { useState, useEffect, useCallback } from 'react'
import { Loader } from 'lucide-react'
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
        <Loader size={20} className="animate-spin text-on-surface-variant" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <span className="material-symbols-outlined text-5xl text-outline">lock</span>
        <p className="text-on-surface-variant text-sm">Bạn không có quyền truy cập trang này</p>
      </div>
    )
  }

  const tabs: { id: AdminTab; label: string; icon: string }[] = [
    { id: 'elections', label: 'Bầu cử', icon: 'how_to_vote' },
    { id: 'users', label: 'Người dùng', icon: 'group' },
    { id: 'logs', label: 'Nhật ký', icon: 'receipt_long' },
  ]

  return (
    <div className="space-y-8">

      {/* ── Page header ── */}
      <div>
        <p className="text-xs font-semibold text-secondary uppercase tracking-[0.08em] mb-1"
          style={{ fontFamily: 'Inter, sans-serif' }}>
          Hệ thống
        </p>
        <h1 className="text-on-surface"
          style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '36px', fontWeight: 700, lineHeight: 1.15, letterSpacing: '-0.02em' }}>
          Quản trị viên
        </h1>
      </div>

      {/* ── Tab nav ── */}
      <div className="flex gap-1 p-1 rounded-xl bg-surface-container border border-white/5 w-fit">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
              tab === t.id
                ? 'bg-surface-container-highest text-on-surface shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
            style={{ fontFamily: 'Space Grotesk, sans-serif' }}
          >
            <span className="material-symbols-outlined text-[17px]">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      {tab === 'elections' && <ElectionsTab />}
      {tab === 'users' && <UsersTab />}

      {tab === 'logs' && (
        <div>
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-base font-semibold text-on-surface"
              style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Nhật ký hệ thống
            </h2>
            {logs && (
              <span className="text-xs text-on-surface-variant">{logs.total} bản ghi</span>
            )}
          </div>

          <div className="glass-card rounded-xl overflow-hidden">
            {logsLoading ? (
              <div className="flex items-center justify-center py-16 gap-2">
                <Loader size={16} className="animate-spin text-on-surface-variant" />
                <span className="text-sm text-on-surface-variant">Đang tải...</span>
              </div>
            ) : logsError ? (
              <div className="p-6 flex items-center gap-3 border-l-4 border-l-error">
                <span className="material-symbols-outlined text-error text-[18px]">error</span>
                <p className="text-sm text-error">{logsError}</p>
              </div>
            ) : (
              <>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left px-5 py-3 text-[11px] font-semibold text-outline uppercase tracking-widest w-44"
                        style={{ fontFamily: 'Inter, sans-serif' }}>Thời gian</th>
                      <th className="text-left px-5 py-3 text-[11px] font-semibold text-outline uppercase tracking-widest w-48"
                        style={{ fontFamily: 'Inter, sans-serif' }}>Hành động</th>
                      <th className="text-left px-5 py-3 text-[11px] font-semibold text-outline uppercase tracking-widest"
                        style={{ fontFamily: 'Inter, sans-serif' }}>Mô tả</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs?.data.map((log: AdminLog) => (
                      <tr key={log.id} className="border-b border-white/5 hover:bg-white/[0.025] transition-colors">
                        <td className="px-5 py-3 text-xs text-on-surface-variant font-mono whitespace-nowrap">
                          {formatDate(log.timestamp)}
                        </td>
                        <td className="px-5 py-3">
                          <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-mono">
                            {log.action}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-xs text-on-surface-variant">{log.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-5 py-4 border-t border-white/10">
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
        </div>
      )}

    </div>
  )
}
