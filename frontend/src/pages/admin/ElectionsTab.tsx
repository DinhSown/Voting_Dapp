import { useState, useEffect, useCallback } from 'react'
import {
  fetchAdminElections,
  createElection,
  updateElection,
  deleteElection,
  startElection,
  endElection,
  addCandidate,
  removeCandidate,
  updateCandidate,
  pushElectionToChain,
  syncCandidates,
  getApiErrorMessage,
} from '../../services/api'
import type { Election, Candidate } from '../../types'

function formatTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

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
  onUpdateCandidate,
  onUpdateElection,
  onSyncCandidates,
  processing,
}: {
  election: Election
  isExpanded: boolean
  onToggleExpand: () => void
  onPushToChain: (id: number) => void
  onStart: (id: number) => void
  onEnd: (id: number) => void
  onDelete: (id: number) => void
  onAddCandidate: (electionId: number, name: string, desc: string, image: string) => Promise<void>
  onRemoveCandidate: (electionId: number, cand: Candidate) => void
  onUpdateCandidate: (electionId: number, candidateId: number, data: { name: string; description: string; image: string }) => Promise<void>
  onUpdateElection: (id: number, data: { title: string; description: string }) => Promise<void>
  onSyncCandidates: (id: number) => void
  processing: Record<string, boolean>
}) {
  const [candName, setCandName] = useState('')
  const [candDesc, setCandDesc] = useState('')
  const [candImage, setCandImage] = useState('')
  const [adding, setAdding] = useState(false)

  // Election title/desc editing state
  const [editingElection, setEditingElection] = useState(false)
  const [editElectionTitle, setEditElectionTitle] = useState(election.title)
  const [editElectionDesc, setEditElectionDesc] = useState(election.description ?? '')
  const [savingElection, setSavingElection] = useState(false)

  const startEditElection = () => {
    setEditElectionTitle(election.title)
    setEditElectionDesc(election.description ?? '')
    setEditingElection(true)
  }

  const cancelEditElection = () => setEditingElection(false)

  const saveEditElection = async () => {
    if (!editElectionTitle.trim()) return
    setSavingElection(true)
    try {
      await onUpdateElection(election.id, { title: editElectionTitle.trim(), description: editElectionDesc.trim() })
      setEditingElection(false)
    } finally {
      setSavingElection(false)
    }
  }

  // Editing state
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editImage, setEditImage] = useState('')
  const [updating, setUpdating] = useState(false)

  const activeCands = (election.candidates || []).filter((c) => !c.isRemoved)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { alert('Ảnh quá lớn (vui lòng chọn ảnh < 2MB)'); return; }

    const reader = new FileReader()
    reader.onloadend = () => {
      const base64 = reader.result as string
      if (isEdit) setEditImage(base64)
      else setCandImage(base64)
    }
    reader.readAsDataURL(file)
  }

  const startEdit = (cand: Candidate) => {
    setEditingId(cand.id)
    setEditName(cand.name || '')
    setEditDesc(cand.description || '')
    setEditImage(cand.image || '')
  }

  const cancelEdit = () => {
    setEditingId(null)
  }

  const saveEdit = async () => {
    if (!editingId || !editName.trim()) return
    setUpdating(true)
    try {
      await onUpdateCandidate(election.id, editingId, { 
        name: editName.trim(), 
        description: editDesc.trim(), 
        image: editImage 
      })
      setEditingId(null)
    } finally {
      setUpdating(false)
    }
  }

  const submitCandidate = async () => {
    if (!candName.trim()) return
    setAdding(true)
    try {
      await onAddCandidate(election.id, candName, candDesc, candImage)
      setCandName('')
      setCandDesc('')
      setCandImage('')
    } finally {
      setAdding(false)
    }
  }

  const accentColor = election.isActive
    ? 'border-t-tertiary'
    : election.onChainId !== null
    ? 'border-t-primary'
    : 'border-t-outline-variant'

  return (
    <div className={`glass-card rounded-xl overflow-hidden flex flex-col border-t-2 ${accentColor}`}>
      <div className="px-4 py-4 flex-1">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            {editingElection ? (
              <div className="space-y-1.5">
                <input
                  type="text"
                  value={editElectionTitle}
                  onChange={(e) => setEditElectionTitle(e.target.value)}
                  className="w-full px-2 py-1 bg-surface-container border border-primary/30 rounded text-sm font-semibold text-on-surface focus:outline-none"
                  placeholder="Tiêu đề *"
                  autoFocus
                />
                <input
                  type="text"
                  value={editElectionDesc}
                  onChange={(e) => setEditElectionDesc(e.target.value)}
                  className="w-full px-2 py-1 bg-surface-container border border-white/10 rounded text-xs text-outline focus:outline-none"
                  placeholder="Mô tả"
                />
                <div className="flex gap-1.5">
                  <button
                    onClick={saveEditElection}
                    disabled={savingElection || !editElectionTitle.trim()}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-primary/15 hover:bg-primary/25 disabled:opacity-40 text-xs text-primary border border-primary/20 transition-all"
                  >
                    <span className="material-symbols-outlined text-[13px]">check</span>
                    {savingElection ? '...' : 'Lưu'}
                  </button>
                  <button
                    onClick={cancelEditElection}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-xs text-outline border border-white/10 transition-all"
                  >
                    <span className="material-symbols-outlined text-[13px]">close</span>
                    Hủy
                  </button>
                </div>
              </div>
            ) : (
              <div className="group/title flex items-start gap-1">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-on-surface leading-snug truncate"
                    style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                    {election.title}
                  </p>
                  <p className="text-xs text-outline mt-0.5">#{election.id}</p>
                </div>
                {!election.isActive && (
                  <button
                    onClick={startEditElection}
                    className="opacity-0 group-hover/title:opacity-100 shrink-0 text-outline hover:text-primary transition-all p-0.5"
                    title="Đổi tên"
                  >
                    <span className="material-symbols-outlined text-[14px]">edit</span>
                  </button>
                )}
              </div>
            )}
          </div>
          {!editingElection && <ElectionStatus election={election} />}
        </div>

        {!editingElection && election.description && (
          <p className="text-xs text-on-surface-variant leading-relaxed line-clamp-2 mb-3">
            {election.description}
          </p>
        )}

        <div className="flex items-center gap-1 text-xs text-outline">
          <span className="material-symbols-outlined text-[14px]">person</span>
          <span>{activeCands.length} ứng viên</span>
        </div>

        {(election.startTime || election.endTime) && (
          <div className="flex flex-col gap-0.5 mt-2">
            {election.startTime && (
              <div className="flex items-center gap-1 text-[11px] text-outline">
                <span className="material-symbols-outlined text-[12px]">play_circle</span>
                <span>Bắt đầu: {formatTime(election.startTime)}</span>
              </div>
            )}
            {election.endTime && (
              <div className="flex items-center gap-1 text-[11px] text-outline">
                <span className="material-symbols-outlined text-[12px]">stop_circle</span>
                <span>Kết thúc: {formatTime(election.endTime)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="px-4 py-3 border-t border-white/5 flex items-center gap-1.5 flex-wrap bg-surface-container/40">
        {election.onChainId === null && !election.isActive && activeCands.length >= 2 && (
          <button
            onClick={() => onPushToChain(election.id)}
            disabled={processing[`push-${election.id}`]}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-secondary/10 hover:bg-secondary/20 disabled:opacity-50 text-xs text-secondary border border-secondary/20 transition-all"
          >
            <span className={`material-symbols-outlined text-[13px] ${processing[`push-${election.id}`] ? 'animate-spin' : ''}`}>
              {processing[`push-${election.id}`] ? 'autorenew' : 'upload'}
            </span>
            {processing[`push-${election.id}`] ? 'Đang đẩy...' : 'Đẩy lên chain'}
          </button>
        )}
        {election.onChainId !== null && !election.isActive && (
          <button
            onClick={() => onStart(election.id)}
            disabled={processing[`start-${election.id}`]}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-tertiary/10 hover:bg-tertiary/20 disabled:opacity-50 text-xs text-tertiary border border-tertiary/20 transition-all"
          >
            <span className={`material-symbols-outlined text-[13px] ${processing[`start-${election.id}`] ? 'animate-spin' : ''}`}>
              {processing[`start-${election.id}`] ? 'autorenew' : 'play_arrow'}
            </span>
            {processing[`start-${election.id}`] ? 'Đang chạy...' : 'Bắt đầu'}
          </button>
        )}
        {election.onChainId !== null && activeCands.some(c => c.onChainId === null) && (
          <button
            onClick={() => onSyncCandidates(election.id)}
            disabled={processing[`sync-${election.id}`]}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 disabled:opacity-50 text-xs text-primary border border-primary/20 transition-all"
          >
            <span className={`material-symbols-outlined text-[13px] ${processing[`sync-${election.id}`] ? 'animate-spin' : ''}`}>
              {processing[`sync-${election.id}`] ? 'autorenew' : 'sync'}
            </span>
            {processing[`sync-${election.id}`] ? 'Đang đồng bộ...' : 'Đồng bộ ứng viên'}
          </button>
        )}
        {election.isActive && (
          <button
            onClick={() => onEnd(election.id)}
            disabled={processing[`end-${election.id}`]}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-error/10 hover:bg-error/20 disabled:opacity-50 text-xs text-error border border-error/20 transition-all"
          >
            <span className={`material-symbols-outlined text-[13px] ${processing[`end-${election.id}`] ? 'animate-spin' : ''}`}>
              {processing[`end-${election.id}`] ? 'autorenew' : 'stop'}
            </span>
            {processing[`end-${election.id}`] ? 'Đang dừng...' : 'Kết thúc'}
          </button>
        )}

        <button
          onClick={onToggleExpand}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-on-surface-variant border border-white/5 transition-all ml-auto"
        >
          <span className="material-symbols-outlined text-[13px]">
            {isExpanded ? 'expand_less' : 'people'}
          </span>
          {isExpanded ? 'Thu gọn' : 'Ứng viên'}
        </button>

        {!election.isActive && (
          <button
            onClick={() => onDelete(election.id)}
            className="p-1.5 rounded-lg text-outline hover:text-error hover:bg-error/10 transition-all"
            title="Xóa cuộc bầu cử"
          >
            <span className="material-symbols-outlined text-[15px]">delete</span>
          </button>
        )}
      </div>

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
              {activeCands.map((c, i) => {
                const isEditing = editingId === c.id
                return (
                  <div key={c.id} className={`flex flex-col gap-2 p-2 rounded-lg transition-all ${isEditing ? 'bg-primary/5 ring-1 ring-primary/20' : 'hover:bg-white/5 group'}`}>
                    <div className="flex items-center gap-2.5">
                      <span className="text-[11px] text-outline font-mono w-4 shrink-0 text-right">{i + 1}</span>
                      
                      <div className="w-8 h-8 rounded-md bg-white/5 border border-white/10 flex-shrink-0 overflow-hidden flex items-center justify-center relative group/edit-img">
                        {(isEditing ? editImage : c.image) ? (
                          <img src={isEditing ? editImage : c.image || ''} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="material-symbols-outlined text-[14px] text-outline">image</span>
                        )}
                        
                        {isEditing && (
                          <label className="absolute inset-0 bg-black/40 flex items-center justify-center cursor-pointer opacity-0 group-hover/edit-img:opacity-100 transition-opacity">
                            <span className="material-symbols-outlined text-[14px] text-white">upload</span>
                            <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, true)} />
                          </label>
                        )}
                      </div>

                      {isEditing ? (
                        <div className="flex-1 flex flex-col gap-1.5">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full px-2 py-1 bg-surface-container border border-white/10 rounded text-xs text-on-surface"
                            placeholder="Tên ứng viên"
                          />
                          <input
                            type="text"
                            value={editDesc}
                            onChange={(e) => setEditDesc(e.target.value)}
                            className="w-full px-2 py-1 bg-surface-container border border-white/10 rounded text-[10px] text-outline"
                            placeholder="Mô tả"
                          />
                        </div>
                      ) : (
                        <div className="flex-1 min-w-0">
                          <span className="text-xs text-on-surface font-medium">{c.name}</span>
                          {c.description && (
                            <p className="text-[10px] text-outline truncate">{c.description}</p>
                          )}
                        </div>
                      )}

                      <div className="flex items-center gap-1">
                        {isEditing ? (
                          <>
                            <button onClick={saveEdit} disabled={updating} className="text-primary hover:bg-primary/10 p-1 rounded">
                              <span className="material-symbols-outlined text-[16px]">check</span>
                            </button>
                            <button onClick={cancelEdit} className="text-outline hover:bg-white/10 p-1 rounded">
                              <span className="material-symbols-outlined text-[16px]">close</span>
                            </button>
                          </>
                        ) : (
                          <>
                            {!election.isActive && (
                              <button
                                onClick={() => startEdit(c)}
                                className="opacity-0 group-hover:opacity-100 text-outline hover:text-primary transition-all p-1"
                              >
                                <span className="material-symbols-outlined text-[16px]">edit</span>
                              </button>
                            )}
                            {!election.isActive && (
                              <button
                                onClick={() => onRemoveCandidate(election.id, c)}
                                className="opacity-0 group-hover:opacity-100 text-outline hover:text-error transition-all p-1"
                              >
                                <span className="material-symbols-outlined text-[16px]">delete</span>
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
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
                <div className="flex-1 flex gap-1.5 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-surface-container border border-white/10 shrink-0 overflow-hidden flex items-center justify-center relative group/new-img">
                    {candImage ? (
                      <img src={candImage} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="material-symbols-outlined text-outline text-[18px]">image</span>
                    )}
                    <label className="absolute inset-0 bg-black/40 flex items-center justify-center cursor-pointer opacity-0 group-hover/new-img:opacity-100 transition-opacity">
                      <span className="material-symbols-outlined text-[16px] text-white">upload</span>
                      <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, false)} />
                    </label>
                  </div>
                  <input
                    type="text"
                    value={candImage}
                    onChange={(e) => setCandImage(e.target.value)}
                    placeholder="Link hoặc tải ảnh"
                    className="flex-1 px-3 py-1.5 rounded-lg bg-surface-container border border-white/10 text-xs text-on-surface placeholder:text-outline focus:outline-none focus:border-primary/40 min-w-0"
                  />
                </div>
                <button
                  onClick={submitCandidate}
                  disabled={adding || !candName.trim()}
                  className="px-3 py-1.5 rounded-lg bg-primary/15 hover:bg-primary/25 disabled:opacity-40 text-xs font-medium text-primary border border-primary/20 transition-all whitespace-nowrap"
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
  const [processing, setProcessing] = useState<Record<string, boolean>>({})

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
      setElections(res.data || [])
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
    setProcessing(prev => ({ ...prev, [`push-${id}`]: true }))
    try { await pushElectionToChain(id); load() }
    catch (err) {
      const base = getApiErrorMessage(err, 'Đẩy lên blockchain thất bại')
      const details =
        err && typeof err === 'object' && 'response' in err &&
        (err as { response?: { data?: { details?: string } } }).response?.data?.details
      setError(details ? `${base}: ${details}` : base)
    } finally {
      setProcessing(prev => ({ ...prev, [`push-${id}`]: false }))
    }
  }

  const handleStart = async (id: number) => {
    setProcessing(prev => ({ ...prev, [`start-${id}`]: true }))
    try { await startElection(id); load() }
    catch (err) { setError(getApiErrorMessage(err, 'Không thể bắt đầu bầu cử')) }
    finally { setProcessing(prev => ({ ...prev, [`start-${id}`]: false })) }
  }

  const handleEnd = async (id: number) => {
    setProcessing(prev => ({ ...prev, [`end-${id}`]: true }))
    try { await endElection(id); load() }
    catch (err) { setError(getApiErrorMessage(err, 'Không thể kết thúc bầu cử')) }
    finally { setProcessing(prev => ({ ...prev, [`end-${id}`]: false })) }
  }

  const handleSyncCandidates = async (id: number) => {
    setProcessing(prev => ({ ...prev, [`sync-${id}`]: true }))
    try { 
      const res = await syncCandidates(id)
      load() 
      alert(`Đã đồng bộ thành công ${res.synced} ứng viên!`)
    }
    catch (err) { setError(getApiErrorMessage(err, 'Đồng bộ thất bại')) }
    finally { setProcessing(prev => ({ ...prev, [`sync-${id}`]: false })) }
  }

  const handleAddCandidate = async (electionId: number, name: string, desc: string, image: string) => {
    await addCandidate(electionId, { name, description: desc, image })
    load()
  }

  const handleUpdateCandidate = async (electionId: number, candidateId: number, data: { name: string; description: string; image: string }) => {
    try {
      await updateCandidate(electionId, candidateId, data)
      load()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Cập nhật ứng viên thất bại'))
    }
  }

  const handleRemoveCandidate = async (electionId: number, cand: Candidate) => {
    if (!confirm(`Xóa ứng viên "${cand.name}"?`)) return
    try { await removeCandidate(electionId, cand.id); load() }
    catch (err) { setError(getApiErrorMessage(err, 'Xóa ứng viên thất bại')) }
  }

  const handleUpdateElection = async (id: number, data: { title: string; description: string }) => {
    try {
      await updateElection(id, data)
      load()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Cập nhật cuộc bầu cử thất bại'))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-on-surface" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Quản lý bầu cử
          </h2>
          <p className="text-xs text-outline mt-1">Tạo và cấu hình các cuộc bầu cử on-chain</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-on-primary text-sm font-semibold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          Tạo mới
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-error/10 border border-error/20 flex items-start gap-3">
          <span className="material-symbols-outlined text-error text-[20px]">error</span>
          <p className="text-xs text-error font-medium leading-relaxed flex-1">{error}</p>
          <button onClick={() => setError('')} className="text-error/60 hover:text-error">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-md rounded-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-lg font-bold text-on-surface">Tạo cuộc bầu cử mới</h3>
              <button onClick={() => setShowCreate(false)} className="text-outline hover:text-on-surface">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-outline ml-1">Tiêu đề *</label>
                <input
                  type="text"
                  autoFocus
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ví dụ: Bầu cử lớp trưởng..."
                  className="w-full px-4 py-2.5 rounded-xl bg-surface-container border border-white/10 text-sm text-on-surface focus:outline-none focus:border-primary/40"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-outline ml-1">Mô tả</label>
                <textarea
                  rows={3}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Mô tả ngắn gọn về mục đích..."
                  className="w-full px-4 py-2.5 rounded-xl bg-surface-container border border-white/10 text-sm text-on-surface focus:outline-none focus:border-primary/40"
                />
              </div>
              <div className="pt-2 flex gap-3">
                <button
                  onClick={() => setShowCreate(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-sm font-semibold text-outline hover:bg-white/5 transition-all"
                >
                  Hủy
                </button>
                <button
                  onClick={handleCreate}
                  disabled={creating || !newTitle.trim()}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-semibold disabled:opacity-50 transition-all"
                >
                  {creating ? 'Đang tạo...' : 'Xác nhận tạo'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-outline font-medium">Đang tải dữ liệu...</p>
        </div>
      ) : (elections || []).length === 0 ? (
        <div className="glass-card rounded-2xl p-12 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-outline text-[32px]">folder_open</span>
          </div>
          <h3 className="text-lg font-bold text-on-surface">Chưa có dữ liệu</h3>
          <p className="text-sm text-outline max-w-xs mt-2">Hãy bắt đầu bằng cách tạo cuộc bầu cử đầu tiên của bạn.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(elections || []).map((el) => (
            <ElectionCard
              key={el.id}
              election={el}
              isExpanded={expandedId === el.id}
              onToggleExpand={() => setExpandedId(expandedId === el.id ? null : el.id)}
              onPushToChain={handlePushToChain}
              onStart={handleStart}
              onEnd={handleEnd}
              onDelete={handleDelete}
              onAddCandidate={handleAddCandidate}
              onRemoveCandidate={handleRemoveCandidate}
              onUpdateCandidate={handleUpdateCandidate}
              onUpdateElection={handleUpdateElection}
              onSyncCandidates={handleSyncCandidates}
              processing={processing}
            />
          ))}
        </div>
      )}
    </div>
  )
}
