import { useCallback, useEffect, useState } from 'react'
import {
  fetchOnChainStatus,
  getApiErrorMessage,
  syncEligibleUsers,
  syncVoteEvents,
} from '../../services/api'
import type { OnChainStatus, SyncEligibleResult } from '../../types'

function shortAddress(value: string | null) {
  if (!value) return 'N/A'
  return `${value.slice(0, 10)}...${value.slice(-8)}`
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
      ok
        ? 'border-tertiary/20 bg-tertiary/10 text-tertiary'
        : 'border-error/20 bg-error/10 text-error'
    }`}>
      <span className="material-symbols-outlined text-[14px]">{ok ? 'check_circle' : 'error'}</span>
      {label}
    </span>
  )
}

function MetricCard({ label, value, icon }: { label: string; value: string | number; icon: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-surface-container px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-outline">{label}</span>
        <span className="material-symbols-outlined text-[18px] text-on-surface-variant">{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold text-on-surface" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
        {value}
      </p>
    </div>
  )
}

export function ChainTab() {
  const [status, setStatus] = useState<OnChainStatus | null>(null)
  const [syncResult, setSyncResult] = useState<SyncEligibleResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncingEligible, setSyncingEligible] = useState(false)
  const [syncingVotes, setSyncingVotes] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const loadStatus = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setStatus(await fetchOnChainStatus())
    } catch (err) {
      setError(getApiErrorMessage(err, 'Không thể tải trạng thái on-chain'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadStatus() }, [loadStatus])

  const handleSyncEligible = async () => {
    setSyncingEligible(true)
    setError('')
    setMessage('')
    try {
      const result = await syncEligibleUsers()
      setSyncResult(result)
      setMessage(`Đã sync ${result.eligibleSynced}/${result.total} ví đủ điều kiện, lỗi ${result.failed}.`)
      await loadStatus()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Không thể sync danh sách eligible'))
    } finally {
      setSyncingEligible(false)
    }
  }

  const handleSyncVotes = async () => {
    setSyncingVotes(true)
    setError('')
    setMessage('')
    try {
      const result = await syncVoteEvents()
      setMessage(`Đã đồng bộ ${result.synced} vote từ on-chain.`)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Không thể sync vote từ on-chain'))
    } finally {
      setSyncingVotes(false)
    }
  }

  return (
    <div className="space-y-4">
      {(error || message) && (
        <div className={`rounded-xl border px-4 py-3 flex items-center gap-2 ${
          error ? 'bg-error/10 border-error/20' : 'bg-tertiary/10 border-tertiary/20'
        }`}>
          <span className={`material-symbols-outlined text-[18px] ${error ? 'text-error' : 'text-tertiary'}`}>
            {error ? 'error' : 'check_circle'}
          </span>
          <span className={`text-sm ${error ? 'text-error' : 'text-tertiary'}`}>{error || message}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={loadStatus}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-surface-container-high px-4 py-2 text-sm text-on-surface-variant transition-colors hover:bg-surface-container-highest disabled:opacity-50"
        >
          <span className={`material-symbols-outlined text-[17px] ${loading ? 'animate-spin' : ''}`}>refresh</span>
          Làm mới
        </button>
        <button
          onClick={handleSyncEligible}
          disabled={syncingEligible}
          className="inline-flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/15 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
        >
          <span className={`material-symbols-outlined text-[17px] ${syncingEligible ? 'animate-spin' : ''}`}>verified_user</span>
          Sync eligible users
        </button>
        <button
          onClick={handleSyncVotes}
          disabled={syncingVotes}
          className="inline-flex items-center gap-2 rounded-xl border border-secondary/20 bg-secondary/15 px-4 py-2 text-sm font-medium text-secondary transition-colors hover:bg-secondary/20 disabled:opacity-50"
        >
          <span className={`material-symbols-outlined text-[17px] ${syncingVotes ? 'animate-spin' : ''}`}>sync</span>
          Sync votes
        </button>
      </div>

      <div className="glass-card rounded-xl p-5">
        {loading && !status ? (
          <div className="flex items-center justify-center py-16 gap-2">
            <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            <span className="text-sm text-on-surface-variant">Đang tải...</span>
          </div>
        ) : status ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge ok={status.codeExists} label={status.codeExists ? 'Contract tồn tại' : 'Không thấy bytecode'} />
              <StatusBadge ok={status.signerIsOwner} label={status.signerIsOwner ? 'Signer là owner' : 'Signer không phải owner'} />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-surface-container px-4 py-3">
                <span className="text-xs text-outline">Contract</span>
                <p className="mt-2 break-all font-mono text-xs text-on-surface">{status.address}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-surface-container px-4 py-3">
                <span className="text-xs text-outline">Owner</span>
                <p className="mt-2 font-mono text-xs text-on-surface">{shortAddress(status.owner)}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-surface-container px-4 py-3 md:col-span-2">
                <span className="text-xs text-outline">Backend signer</span>
                <p className="mt-2 font-mono text-xs text-on-surface">{shortAddress(status.signerAddress)}</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard label="Election on-chain" value={status.electionCount} icon="how_to_vote" />
              <MetricCard label="Election trong DB" value={status.dbElections} icon="database" />
              <MetricCard label="Ví đã xác minh" value={status.dbVerifiedUsers} icon="person_check" />
              <MetricCard label="Ví eligible" value={status.dbEligibleUsers} icon="verified" />
            </div>
          </div>
        ) : null}
      </div>

      {syncResult && syncResult.errors.length > 0 && (
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="border-b border-white/10 px-4 py-3">
            <h2 className="text-sm font-semibold text-on-surface" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Ví sync lỗi
            </h2>
          </div>
          <div className="divide-y divide-white/5">
            {syncResult.errors.slice(0, 10).map((item) => (
              <div key={`${item.userId}-${item.walletAddress}`} className="px-4 py-3">
                <p className="font-mono text-xs text-on-surface">{shortAddress(item.walletAddress)}</p>
                <p className="mt-1 text-xs text-error">{item.error}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
