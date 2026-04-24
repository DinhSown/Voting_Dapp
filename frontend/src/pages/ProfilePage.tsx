import { useState, useEffect } from 'react'
import { useAuthContext } from '../context/AuthContext'
import { updateProfile, getApiErrorMessage, fetchMyVotes } from '../services/api'
import type { VoteRecord } from '../types'
import { ExternalLink } from 'lucide-react'

const CARD_STYLE: React.CSSProperties = {
  background: 'rgba(255,255,255,0.025)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 16,
}

const LABEL_STYLE: React.CSSProperties = {
  fontFamily: 'Inter, sans-serif',
  fontWeight: 600,
  fontSize: 10,
  letterSpacing: '0.09em',
  textTransform: 'uppercase',
  color: 'rgba(218,226,253,0.3)',
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      className="flex items-center justify-between py-3"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
    >
      <span className="shrink-0" style={LABEL_STYLE}>
        {label}
      </span>
      <div className="text-right">{children}</div>
    </div>
  )
}

function NetRow({ label, value, accent, live }: {
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
      <div className="text-center py-24 text-on-surface-variant text-sm">
        Vui lòng đăng nhập để xem hồ sơ.
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
    ? `${user.walletAddress.slice(0, 8)}···${user.walletAddress.slice(-6)}`
    : '—'

  const copyAddress = () => {
    if (user.walletAddress) navigator.clipboard.writeText(user.walletAddress)
  }

  const initials = (user.name || 'U')[0].toUpperCase()
  const isAdmin = user.role === 'admin'

  return (
    <div className="space-y-12">

      {/* ── PROFILE HEADER ── */}
      <div>
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-start gap-5">
            {/* Avatar */}
            <div
              className="w-20 h-20 flex items-center justify-center text-3xl font-bold text-primary select-none shrink-0"
              style={{
                fontFamily: 'Space Grotesk, sans-serif',
                background: 'linear-gradient(135deg, rgba(242,202,80,0.15), rgba(217,119,6,0.1))',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 16,
              }}
            >
              {initials}
            </div>

            {/* Name + meta */}
            <div className="flex-1 min-w-0 pt-1">
              {editing ? (
                <div className="flex gap-2 items-center mb-2">
                  <input
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={50}
                    className="flex-1 px-3 py-2 text-sm text-on-surface focus:outline-none"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(242,202,80,0.25)',
                      borderRadius: 10,
                      fontFamily: 'Space Grotesk, sans-serif',
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSave()
                      if (e.key === 'Escape') { setEditing(false); setName(user.name) }
                    }}
                  />
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="civic-btn px-3 py-2 rounded-xl text-xs font-bold disabled:opacity-50 transition-all"
                    style={{ fontFamily: 'Space Grotesk, sans-serif' }}
                  >
                    {saving ? '...' : 'Lưu'}
                  </button>
                  <button
                    onClick={() => { setEditing(false); setName(user.name) }}
                    className="px-3 py-2 rounded-xl text-xs text-on-surface-variant hover:text-on-surface transition-colors"
                    style={{ background: 'rgba(44,52,73,0.6)' }}
                  >
                    Hủy
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 mb-2">
                  <h1
                    className="text-on-surface truncate"
                    style={{
                      fontFamily: 'Space Grotesk, sans-serif',
                      fontSize: 'clamp(22px, 4vw, 34px)',
                      fontWeight: 800,
                      lineHeight: 1.1,
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {user.name}
                  </h1>
                  <button
                    onClick={() => { setEditing(true); setName(user.name) }}
                    className="text-outline hover:text-on-surface-variant transition-colors shrink-0"
                    title="Chỉnh sửa tên"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                  </button>
                </div>
              )}

              {/* Role badge */}
              <span
                className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-widest"
                style={{
                  fontFamily: 'Inter, sans-serif',
                  letterSpacing: '0.07em',
                  background: isAdmin ? 'rgba(242,202,80,0.12)' : 'rgba(242,202,80,0.12)',
                  border: `1px solid ${isAdmin ? 'rgba(242,202,80,0.25)' : 'rgba(242,202,80,0.22)'}`,
                  color: isAdmin ? '#f2ca50' : '#f2ca50',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 11 }}>
                  {isAdmin ? 'admin_panel_settings' : 'person'}
                </span>
                {isAdmin ? 'Admin' : 'Người dùng'}
              </span>

              {/* Wallet address */}
              <div className="flex items-center gap-1.5 mt-2">
                <span className="font-mono text-[11px] text-outline">{shortAddress}</span>
                <button
                  onClick={copyAddress}
                  className="text-outline hover:text-on-surface-variant transition-colors"
                  title="Sao chép địa chỉ"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 13 }}>content_copy</span>
                </button>
              </div>
            </div>
          </div>

          {/* Logout */}
          <button
            onClick={logout}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-error text-xs font-medium hover:bg-error/10 transition-colors shrink-0"
            style={{
              fontFamily: 'Space Grotesk, sans-serif',
              border: '1px solid rgba(255,180,171,0.2)',
              background: 'rgba(147,0,10,0.08)',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>logout</span>
            Đăng xuất
          </button>
        </div>

        {/* Inline feedback */}
        {error && (
          <p className="mt-3 text-xs text-error" style={{ fontFamily: 'Inter, sans-serif' }}>{error}</p>
        )}
        {success && (
          <p className="mt-3 text-xs text-tertiary" style={{ fontFamily: 'Inter, sans-serif' }}>{success}</p>
        )}
      </div>

      {/* ── MAIN GRID ── */}
      <div className="grid grid-cols-12 gap-gutter">

        {/* Left: Info + Vote history (8 cols) */}
        <div className="col-span-12 lg:col-span-8 space-y-6">

          {/* Account info panel */}
          <div style={{ ...CARD_STYLE, padding: 24 }}>
            <p className="mb-1" style={LABEL_STYLE}>
              Thông tin tài khoản
            </p>

            <div>
              <InfoRow label="Email">
                <span className="text-sm text-on-surface font-mono">
                  {loadingProfile
                    ? <span className="text-outline animate-pulse">Đang tải…</span>
                    : user.email || '—'}
                </span>
              </InfoRow>

              <InfoRow label="Số dư (Testnet)">
                <span className="text-sm text-on-surface font-mono">
                  {loadingProfile
                    ? <span className="text-outline animate-pulse">Đang tải…</span>
                    : user.balance !== undefined && user.balance !== null
                    ? `${parseFloat(user.balance).toFixed(4)} ROSE`
                    : '—'}
                </span>
              </InfoRow>

              <div className="flex items-center justify-between pt-3">
                <span style={LABEL_STYLE}>Xác minh</span>
                <span
                  className="flex items-center gap-1.5 text-xs"
                  style={{ color: user.emailVerified ? '#4edea3' : '#ffb4ab' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                    {user.emailVerified ? 'verified' : 'cancel'}
                  </span>
                  {user.emailVerified ? 'Đã xác minh' : 'Chưa xác minh'}
                </span>
              </div>
            </div>
          </div>

          {/* Vote history */}
          <div style={{ ...CARD_STYLE, overflow: 'hidden' }}>
            <div
              className="px-6 py-3 flex justify-between items-center"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
            >
              <h3
                className="text-sm font-bold text-on-surface"
                style={{ fontFamily: 'Space Grotesk, sans-serif' }}
              >
                Lịch sử bỏ phiếu
              </h3>
              <span className="text-[10px] font-mono text-outline">{voteHistory.length} giao dịch</span>
            </div>

            {loadingVotes ? (
              <div>
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="px-6 py-4 flex items-center gap-3"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                  >
                    <div
                      className="w-8 h-8 rounded-lg animate-pulse shrink-0"
                      style={{ background: 'rgba(255,255,255,0.04)' }}
                    />
                    <div className="flex-1 space-y-2">
                      <div
                        className="h-3 rounded animate-pulse w-1/2"
                        style={{ background: 'rgba(255,255,255,0.04)' }}
                      />
                      <div
                        className="h-2 rounded animate-pulse w-1/3"
                        style={{ background: 'rgba(255,255,255,0.04)' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : voteHistory.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <span
                  className="material-symbols-outlined text-outline block mb-3"
                  style={{ fontSize: 40, opacity: 0.35 }}
                >
                  how_to_vote
                </span>
                <p className="text-xs text-on-surface-variant">Bạn chưa bỏ phiếu cho cuộc bình chọn nào.</p>
              </div>
            ) : (
              <div>
                {voteHistory.map((record, i) => (
                  <div
                    key={record.id}
                    className="px-6 py-4 flex items-center justify-between gap-3"
                    style={{
                      borderBottom: i < voteHistory.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    }}
                  >
                    {/* Left: icon + details */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-8 h-8 flex items-center justify-center shrink-0"
                        style={{
                          background: 'rgba(78,222,163,0.08)',
                          border: '1px solid rgba(78,222,163,0.15)',
                          borderRadius: 8,
                        }}
                      >
                        <span className="material-symbols-outlined text-tertiary" style={{ fontSize: 15 }}>
                          how_to_vote
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-mono text-[10px] text-outline">
                          {record.categoryTitle || `Danh mục #${record.categoryId}`}
                          {' · '}
                          {new Date(record.votedAt).toLocaleString('vi-VN', {
                            year: 'numeric', month: '2-digit', day: '2-digit',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>

                    {/* Right: status + link */}
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-xs font-bold text-tertiary" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                          Hợp lệ
                        </p>
                        <p className="text-[10px] font-mono text-outline">On-chain</p>
                      </div>
                      {record.txHash && (
                        <a
                          href={`https://explorer.oasis.io/testnet/sapphire/tx/${record.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-outline hover:text-on-surface transition-colors"
                          title="Xem trên Explorer"
                        >
                          <ExternalLink size={13} />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar (4 cols) */}
        <div className="col-span-12 lg:col-span-4 space-y-6">

          {/* Participation stats */}
          <div style={{ ...CARD_STYLE, padding: 24 }}>
            <p className="mb-4" style={LABEL_STYLE}>
              Tham gia
            </p>

            <div className="mb-4">
              <p
                className="font-bold text-on-surface"
                style={{
                  fontFamily: 'Space Grotesk, sans-serif',
                  fontSize: 48,
                  fontWeight: 800,
                  lineHeight: 1,
                  color: voteHistory.length > 0 ? '#f2ca50' : '#424754',
                }}
              >
                {voteHistory.length}
              </p>
              <p className="mt-1" style={LABEL_STYLE}>
                Lượt bỏ phiếu
              </p>
            </div>

            <div
              className="pt-3"
              style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
            >
              <p className="mb-2" style={LABEL_STYLE}>
                Quyền truy cập
              </p>
              <span
                className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-widest"
                style={{
                  fontFamily: 'Inter, sans-serif',
                  letterSpacing: '0.07em',
                  background: isAdmin ? 'rgba(242,202,80,0.12)' : 'rgba(242,202,80,0.10)',
                  border: `1px solid ${isAdmin ? 'rgba(242,202,80,0.25)' : 'rgba(242,202,80,0.2)'}`,
                  color: isAdmin ? '#f2ca50' : '#f2ca50',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 12 }}>
                  {isAdmin ? 'admin_panel_settings' : 'person'}
                </span>
                {isAdmin ? 'Admin' : 'User'}
              </span>
            </div>
          </div>

          {/* Network info */}
          <div style={{ ...CARD_STYLE, padding: 24 }}>
            <p className="mb-4" style={LABEL_STYLE}>
              Thông tin mạng
            </p>
            <div className="space-y-3">
              <NetRow label="MẠNG" value="Sapphire Testnet" />
              <NetRow label="CHAIN ID" value="0x5aff" />
              <NetRow label="TRẠNG THÁI" value="Active" accent="text-tertiary" live />
              <NetRow label="LOẠI" value="Smart Contract" accent="text-secondary" />
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
