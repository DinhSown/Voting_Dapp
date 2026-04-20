import { useState, useEffect, useCallback } from 'react'
import {
  fetchAdminElections,
  createElection,
  deleteElection,
  startElection,
  endElection,
  addCandidate,
  removeCandidate,
  pushElectionToChain,
  getApiErrorMessage,
} from '../../services/api'
import type { Election, Candidate } from '../../types'

function ElectionStatus({ election }: { election: Election }) {
  if (election.isActive) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-tertiary">
        <span className="live-dot" />
        Đang diễn ra
      </span>
    )
  }
  if (election.onChainId !== null) {
    return <span className="text-xs text-primary">On-chain</span>
  }
  return <span className="text-xs text-outline">Nháp</span>
}

function ElectionCard({
  election,
  isExpanded,
  onToggleExpand,
  onPushToChain,
  onStart,
  onEnd,
  onDelete,
  onAddCandidate,
  onRemoveCandidate,
}: {
  election: Election
  isExpanded: boolean
  onToggleExpand: () => void
  onPushToChain: (id: number) => void
  onStart: (id: number) => void
  onEnd: (id: number) => void
  onDelete: (id: number) => void
  onAddCandidate: (electionId: number, name: string, desc: string) => Promise<void>
  onRemoveCandidate: (electionId: number, cand: Candidate) => void
}) {
  const [candName, setCandName] = useState('')
  const [candDesc, setCandDesc] = useState('')
  const [adding, setAdding] = useState(false)

  const activeCands = election.candidates.filter((c) => !c.isRemoved)

  const submitCandidate = async () => {
    if (!candName.trim()) return
    setAdding(true)
    await onAddCandidate(election.id, candName, candDesc)
    setCandName('')
    setCandDesc('')
    setAdding(false)
  }

  const accentColor = election.isActive
    ? 'border-t-tertiary'
    : election.onChainId !== null
    ? 'border-t-primary'
    : 'border-t-outline-variant'

  return (
    <div className={`glass-card rounded-xl overflow-hidden flex flex-col border-t-2 ${accentColor}`}>
      {/* Card body */}
      <div className="px-4 py-4 flex-1">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-on-surface leading-snug truncate"
              style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              {election.title}
            </p>
            <p className="text-xs text-outline mt-0.5">#{election.id}</p>
          </div>
          <ElectionStatus election={election} />
        </div>

        {election.description && (
          <p className="text-xs text-on-surface-variant leading-relaxed line-clamp-2 mb-3">
            {election.description}
          </p>
        )}

        <div className="flex items-center gap-1 text-xs text-outline">
          <span className="material-symbols-outlined text-[14px]">person</span>
          <span>{activeCands.length} ứng viên</span>
        </div>
      </div>

      {/* Actions footer */}
      <div className="px-4 py-3 border-t border-white/5 flex items-center gap-1.5 flex-wrap bg-surface-container/40">
        {election.onChainId === null && !election.isActive && activeCands.length >= 2 && (
          <button
            onClick={() => onPushToChain(election.id)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-secondary/10 hover:bg-secondary/20 text-xs text-secondary border border-secondary/20 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[13px]">upload</span>
            Đẩy lên chain
          </button>
        )}
        {election.onChainId !== null && !election.isActive && (
          <button
            onClick={() => onStart(election.id)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-tertiary/10 hover:bg-tertiary/20 text-xs text-tertiary border border-tertiary/20 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[13px]">play_arrow</span>
            Bắt đầu
          </button>
        )}
        {election.isActive && (
          <button
            onClick={() => onEnd(election.id)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-error/10 hover:bg-error/20 text-xs text-error border border-error/20 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[13px]">stop</span>
            Kết thúc
          </button>
        )}

        <button
          onClick={onToggleExpand}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-on-surface-variant border border-white/5 transition-all ml-auto cursor-pointer"
        >
          <span className="material-symbols-outlined text-[13px]">
            {isExpanded ? 'expand_less' : 'people'}
          </span>
          {isExpanded ? 'Thu gọn' : 'Ứng viên'}
        </button>

        {!election.isActive && (
          <button
            onClick={() => onDelete(election.id)}
            className="p-1.5 rounded-lg text-outline hover:text-error hover:bg-error/10 transition-all cursor-pointer"
            title="Xóa cuộc bầu cử"
          >
            <span className="material-symbols-outlined text-[15px]">delete</span>
          </button>
        )}
      </div>

      {/* Expanded candidates panel */}
      {isExpanded && (
        <div className="border-t border-white/5 bg-surface-container/30 px-4 py-4 space-y-3">
          <p className="text-[11px] font-semibold text-outline uppercase tracking-widest"
            style={{ fontFamily: 'Inter, sans-serif' }}>
            Ứng viên ({activeCands.length})
          </p>

          {activeCands.length === 0 ? (
            <p className="text-xs text-outline py-1">Chưa có ứng viên</p>
          ) : (
            <div className="space-y-1.5">
              {activeCands.map((c, i) => (
                <div key={c.id} className="flex items-center gap-2.5 py-1.5 px-2 rounded-lg hover:bg-white/5 group">
                  <span className="text-[11px] text-outline font-mono w-4 shrink-0 text-right">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-on-surface">{c.name}</span>
                    {c.description && (
                      <span className="text-xs text-outline ml-2">{c.description}</span>
                    )}
                  </div>
                  {!election.isActive && (
                    <button
                      onClick={() => onRemoveCandidate(election.id, c)}
                      className="opacity-0 group-hover:opacity-100 text-outline hover:text-error transition-all p-0.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {!election.isActive && (
            <div className="pt-2 border-t border-white/5 space-y-2">
              <p className="text-[11px] text-outline">Thêm ứng viên</p>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={candName}
                  onChange={(e) => setCandName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submitCandidate()}
                  placeholder="Tên *"
                  className="flex-1 px-3 py-1.5 rounded-lg bg-surface-container border border-white/10 text-xs text-on-surface placeholder:text-outline focus:outline-none focus:border-primary/40 min-w-0"
                />
                <input
                  type="text"
                  value={candDesc}
                  onChange={(e) => setCandDesc(e.target.value)}
                  placeholder="Mô tả"
                  className="flex-1 px-3 py-1.5 rounded-lg bg-surface-container border border-white/10 text-xs text-on-surface placeholder:text-outline focus:outline-none focus:border-primary/40 min-w-0"
                />
                <button
                  onClick={submitCandidate}
                  disabled={adding || !candName.trim()}
                  className="px-3 py-1.5 rounded-lg bg-primary/15 hover:bg-primary/25 disabled:opacity-40 text-xs font-medium text-primary border border-primary/20 transition-all whitespace-nowrap cursor-pointer"
                >
                  {adding ? '…' : 'Thêm'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function ElectionsTab() {
  const [elections, setElections] = useState<Election[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showCreate, setShowCreate] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [creating, setCreating] = useState(false)

  const [expandedId, setExpandedId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetchAdminElections()
      setElections(res.data)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Không thể tải danh sách cuộc bầu cử'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleCreate = async () => {
    if (!newTitle.trim()) return
    setCreating(true)
    try {
      await createElection({ title: newTitle, description: newDesc })
      setNewTitle('')
      setNewDesc('')
      setShowCreate(false)
      load()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Tạo cuộc bầu cử thất bại'))
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Xóa cuộc bầu cử này?')) return
    try { await deleteElection(id); load() }
    catch (err) { setError(getApiErrorMessage(err, 'Xóa thất bại')) }
  }

  const handlePushToChain = async (id: number) => {
    setError('')
    try { await pushElectionToChain(id); load() }
    catch (err) {
      const base = getApiErrorMessage(err, 'Đẩy lên blockchain thất bại')
      const details =
        err && typeof err === 'object' && 'response' in err &&
        (err as { response?: { data?: { details?: string } } }).response?.data?.details
      setError(details ? `${base}: ${details}` : base)
    }
  }

  const handleStart = async (id: number) => {
    try { await startElection(id); load() }
    catch (err) { setError(getApiErrorMessage(err, 'Không thể bắt đầu bầu cử')) }
  }

  const handleEnd = async (id: number) => {
    try { await endElection(id); load() }
    catch (err) { setError(getApiErrorMessage(err, 'Không thể kết thúc bầu cử')) }
  }

  const handleAddCandidate = async (electionId: number, name: string, desc: string) => {
    await addCandidate(electionId, { name, description: desc })
    load()
  }

  const handleRemoveCandidate = async (electionId: number, cand: Candidate) => {
    if (!confirm(`Xóa ứng viên "${cand.name}"?`)) return
    try { await removeCandidate(electionId, cand.id); load() }
    catch (err) { setError(getApiErrorMessage(err, 'Xóa ứng viên thất bại')) }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 gap-2">
        <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        <span className="text-sm text-on-surface-variant">Đang tải...</span>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-xl bg-error/10 border border-error/20 px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-error text-[18px]">error</span>
            <span className="text-sm text-error">{error}</span>
          </div>
          <button onClick={load} className="text-xs text-error/70 hover:text-error underline shrink-0 cursor-pointer">Thử lại</button>
        </div>
      )}

      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-on-surface" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Danh sách bầu cử
          </span>
          <span className="text-xs text-outline px-2 py-0.5 rounded-full bg-surface-container border border-white/5">
            {elections.length}
          </span>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium bg-primary/15 hover:bg-primary/25 text-primary border border-primary/20 transition-all cursor-pointer"
          style={{ fontFamily: 'Space Grotesk, sans-serif' }}
        >
          <span className="material-symbols-outlined text-[16px]">add</span>
          Tạo mới
        </button>
      </div>

      {/* ── Create form ── */}
      {showCreate && (
        <div className="glass-card rounded-xl p-5 space-y-3">
          <p className="text-sm font-semibold text-on-surface" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Tạo cuộc bầu cử mới
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Tên cuộc bầu cử *"
              className="px-3.5 py-2.5 rounded-xl bg-surface-container border border-white/10 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-primary/40 transition-colors"
            />
            <input
              type="text"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Mô tả (tùy chọn)"
              className="px-3.5 py-2.5 rounded-xl bg-surface-container border border-white/10 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-primary/40 transition-colors"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleCreate}
              disabled={creating || !newTitle.trim()}
              className="px-4 py-2 rounded-xl bg-primary/15 hover:bg-primary/25 disabled:opacity-40 text-sm font-medium text-primary border border-primary/20 transition-all cursor-pointer"
            >
              {creating ? 'Đang tạo...' : 'Tạo'}
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-sm text-on-surface-variant border border-white/5 transition-colors cursor-pointer"
            >
              Hủy
            </button>
          </div>
        </div>
      )}

      {/* ── Elections grid ── */}
      {elections.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 glass-card rounded-xl">
          <span className="material-symbols-outlined text-4xl text-outline">how_to_vote</span>
          <p className="text-sm text-on-surface-variant">Chưa có cuộc bầu cử nào</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {elections.map((election) => (
            <ElectionCard
              key={election.id}
              election={election}
              isExpanded={expandedId === election.id}
              onToggleExpand={() => setExpandedId(expandedId === election.id ? null : election.id)}
              onPushToChain={handlePushToChain}
              onStart={handleStart}
              onEnd={handleEnd}
              onDelete={handleDelete}
              onAddCandidate={handleAddCandidate}
              onRemoveCandidate={handleRemoveCandidate}
            />
          ))}
        </div>
      )}
    </div>
  )
}
