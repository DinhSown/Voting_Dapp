import { useState, useEffect } from 'react'
import { useAuthContext } from '../context/AuthContext'
import { updateProfile, getApiErrorMessage, fetchMyVotes } from '../services/api'
import type { VoteRecord } from '../types'
import { CheckCircle, ExternalLink } from 'lucide-react'

export function ProfilePage() {
  const { user, refreshProfile, logout } = useAuthContext()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(user?.name ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [voteHistory, setVoteHistory] = useState<VoteRecord[]>([])
  const [loadingVotes, setLoadingVotes] = useState(false)

  useEffect(() => {
    setLoadingProfile(true)
    refreshProfile().finally(() => setLoadingProfile(false))
  }, [refreshProfile])

  useEffect(() => {
    setLoadingVotes(true)
    fetchMyVotes()
      .then(setVoteHistory)
      .catch(() => undefined)
      .finally(() => setLoadingVotes(false))
  }, [])

  if (!user) {
    return (
      <div className="text-center py-20 text-white/40">
        Vui lòng đăng nhập để xem hồ sơ
      </div>
    )
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await updateProfile(name)
      await refreshProfile()
      setSuccess('Đã cập nhật tên thành công')
      setEditing(false)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Cập nhật thất bại'))
    } finally {
      setSaving(false)
    }
  }

  const shortAddress = user.walletAddress
    ? `${user.walletAddress.slice(0, 8)}...${user.walletAddress.slice(-6)}`
    : '—'

  const copyAddress = () => {
    if (user.walletAddress) navigator.clipboard.writeText(user.walletAddress)
  }

  const roleBadgeClass =
    user.role === 'admin'
      ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
      : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-white">Hồ sơ của tôi</h1>

      {/* Profile card */}
      <div className="rounded-2xl bg-white/5 border border-white/10 p-6 space-y-5">

        {/* Avatar + name */}
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-2xl font-bold text-white select-none">
            {(user.name || 'U')[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            {editing ? (
              <div className="flex gap-2 items-center">
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={50}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-sm text-white focus:outline-none focus:border-purple-500"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSave()
                    if (e.key === 'Escape') { setEditing(false); setName(user.name) }
                  }}
                />
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-xs font-medium disabled:opacity-50 transition-colors"
                >
                  {saving ? '...' : 'Lưu'}
                </button>
                <button
                  onClick={() => { setEditing(false); setName(user.name) }}
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs transition-colors"
                >
                  Hủy
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold text-white truncate">{user.name}</span>
                <button
                  onClick={() => { setEditing(true); setName(user.name) }}
                  className="text-white/30 hover:text-white/70 transition-colors text-xs"
                  title="Chỉnh sửa tên"
                >
                  ✏️
                </button>
              </div>
            )}
            <span className={`mt-1 inline-block text-xs px-2 py-0.5 rounded-full ${roleBadgeClass}`}>
              {user.role === 'admin' ? 'Admin' : 'Người dùng'}
            </span>
          </div>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}
        {success && <p className="text-green-400 text-sm">{success}</p>}

        {/* Info rows */}
        <div className="space-y-3 divide-y divide-white/5">
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-white/50">Địa chỉ ví</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono text-white/80">{shortAddress}</span>
              <button
                onClick={copyAddress}
                className="text-white/30 hover:text-white/70 text-xs transition-colors"
                title="Sao chép"
              >
                📋
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-white/50">Email đã xác thực</span>
            <span className="text-sm text-white/80">
              {loadingProfile ? (
                <span className="text-white/30 animate-pulse">Đang tải…</span>
              ) : user.email ? user.email : '—'}
            </span>
          </div>

          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-white/50">Số dư (Sapphire Testnet)</span>
            <span className="text-sm text-white font-mono">
              {loadingProfile ? (
                <span className="text-white/30 animate-pulse">Đang tải…</span>
              ) : user.balance !== undefined && user.balance !== null
                ? `${parseFloat(user.balance).toFixed(4)} ROSE`
                : '—'}
            </span>
          </div>

          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-white/50">Trạng thái xác minh</span>
            <span className={`text-sm ${user.emailVerified ? 'text-green-400' : 'text-yellow-400'}`}>
              {user.emailVerified ? 'Đã xác minh' : 'Chưa xác minh'}
            </span>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={logout}
          className="w-full py-2.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 text-sm font-medium transition-colors"
        >
          Đăng xuất
        </button>
      </div>

      {/* Vote history */}
      <div className="rounded-2xl bg-white/5 border border-white/10 p-6 space-y-4">
        <h2 className="text-base font-semibold text-white flex items-center gap-2">
          <CheckCircle size={16} className="text-green-400" />
          Lịch sử bỏ phiếu
        </h2>

        {loadingVotes ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : voteHistory.length === 0 ? (
          <p className="text-sm text-white/40 text-center py-4">
            Bạn chưa bỏ phiếu cho cuộc bình chọn nào.
          </p>
        ) : (
          <div className="space-y-3">
            {voteHistory.map((record) => (
              <div
                key={record.id}
                className="rounded-xl bg-white/5 border border-white/10 p-4 flex items-start justify-between gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white/40 mb-1">{record.categoryTitle || `Danh mục #${record.categoryId}`}</p>
                  <div className="flex items-center gap-2">
                    <CheckCircle size={14} className="text-green-400 shrink-0" />
                    <span className="text-sm font-semibold text-white truncate">
                      {record.candidateName || `Ứng viên #${record.candidateId}`}
                    </span>
                  </div>
                  <p className="text-xs text-white/30 mt-1">
                    {new Date(record.votedAt).toLocaleString('vi-VN', {
                      year: 'numeric', month: '2-digit', day: '2-digit',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                </div>
                {record.txHash && (
                  <a
                    href={`https://explorer.oasis.io/testnet/sapphire/tx/${record.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white/30 hover:text-white/70 transition-colors shrink-0 mt-0.5"
                    title="Xem giao dịch trên Explorer"
                  >
                    <ExternalLink size={14} />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
