import { useState, useEffect, useCallback, useMemo } from 'react'
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
  pauseElection,
  getApiErrorMessage,
} from '../../services/api'
import type { Election, Candidate } from '../../types'

type ElectionTab = 'upcoming' | 'active' | 'ended'

function classifyElection(e: Election): ElectionTab {
  const now = new Date()
  // Use explicit checks and handle potential string/number values from DB
  const dbEnded = e.isEnded === true || (e as any).isEnded === 1 || (e as any).isEnded === 'true' || (e as any).isEnded === '1'
  const timeEnded = e.endTime && new Date(e.endTime) <= now
  
  if (dbEnded || timeEnded) return 'ended'
  
  const isActive = e.isActive === true || (e as any).isActive === 1 || (e as any).isActive === 'true' || (e as any).isActive === '1'
  if (isActive) return 'active'
  return 'upcoming'
}

function ElectionStatus({ election }: { election: Election }) {
  const now = new Date()
  const dbEnded = election.isEnded === true || (election as any).isEnded === 1 || (election as any).isEnded === 'true' || (election as any).isEnded === '1'
  const timeEnded = election.endTime && new Date(election.endTime) <= now
  const isEnded = dbEnded || timeEnded
  
  const isActive = election.isActive === true || (election as any).isActive === 1 || (election as any).isActive === 'true' || (election as any).isActive === '1'

  if (isEnded) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-[#ff4d4d] font-bold">
        <span className="material-symbols-outlined text-[14px]">check_circle</span>
        {timeEnded && !dbEnded ? 'Hết hạn (Chưa đóng chain)' : 'Đã kết thúc'}
      </span>
    )
  }
  if (isActive) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-tertiary font-bold">
        <span className="live-dot" />
        Đang diễn ra
      </span>
    )
  }
  // If pushed to chain but not active and not ended, it's paused or draft-started
  if (election.onChainId !== null && !isActive && !isEnded) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-[#f2ca50] font-bold">
        <span className="material-symbols-outlined text-[14px]">pause_circle</span>
        Đang tạm dừng
      </span>
    )
  }
  if (election.onChainId !== null) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-primary font-medium">
        <span className="material-symbols-outlined text-[14px]">link</span>
        On-chain
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-outline italic">
      <span className="material-symbols-outlined text-[14px]">drafts</span>
      Nháp
    </span>
  )
}

function ElectionCard({
  election,
  isExpanded,
  onToggleExpand,
  onPushToChain,
  onStart,
  onEnd,
  onPause,
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
  onPause: (id: number) => void
  onDelete: (id: number) => void
  onAddCandidate: (electionId: number, name: string, desc: string, image: string) => Promise<void>
  onRemoveCandidate: (electionId: number, cand: Candidate) => void
  onUpdateCandidate: (electionId: number, candidateId: number, data: { name: string; description: string; image: string }) => Promise<void>
  onUpdateElection: (election: Election) => void
  onSyncCandidates: (id: number) => void
  processing: Record<string, boolean>
}) {
  const [candName, setCandName] = useState('')
  const [candDesc, setCandDesc] = useState('')
  const now = new Date()
  const dbEnded = election.isEnded === true || (election as any).isEnded === 1 || (election as any).isEnded === 'true' || (election as any).isEnded === '1'
  const timeEnded = election.endTime && new Date(election.endTime) <= now
  const isEnded = dbEnded || timeEnded

  const isActive = election.isActive === true || (election as any).isActive === 1 || (election as any).isActive === 'true' || (election as any).isActive === '1'

  // Editing state
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editImage, setEditImage] = useState('')
  const [updating, setUpdating] = useState(false)



  const activeCands = (election.candidates || []).filter((c) => !c.isRemoved)

  const processImage = (file: File, isEdit: boolean) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const TARGET_W = 400
        const TARGET_H = 500
        
        const sourceRatio = img.width / img.height
        const targetRatio = TARGET_W / TARGET_H
        
        let sx = 0, sy = 0, sw = img.width, sh = img.height
        
        if (sourceRatio > targetRatio) {
          sw = img.height * targetRatio
          sx = (img.width - sw) / 2
        } else {
          sh = img.width / targetRatio
          sy = (img.height - sh) / 2
        }
        
        canvas.width = TARGET_W
        canvas.height = TARGET_H
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.imageSmoothingEnabled = true
          ctx.imageSmoothingQuality = 'high'
          ctx.drawImage(img, sx, sy, sw, sh, 0, 0, TARGET_W, TARGET_H)
          const processedBase64 = canvas.toDataURL('image/jpeg', 0.85)
          if (isEdit) setEditImage(processedBase64)
          else setCandImage(processedBase64)
        }
      }
      img.src = e.target?.result as string
    }
    reader.readAsDataURL(file)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean) => {
    const file = e.target.files?.[0]
    if (!file) return
    processImage(file, isEdit)
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

  const accentColor = election.isEnded
    ? 'border-t-outline-variant/30'
    : election.isActive
    ? 'border-t-tertiary'
    : election.onChainId !== null
    ? 'border-t-primary'
    : 'border-t-outline-variant'

  const formatDate = (d: string | null | undefined) => {
    if (!d) return 'N/A'
    return new Date(d).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className={`glass-card rounded-xl overflow-hidden flex flex-col border-t-2 ${accentColor} transition-all duration-300 hover:shadow-xl hover:shadow-black/20`}>

      <div className="px-4 py-4 flex-1">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-on-surface leading-snug truncate"
                style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                {election.title}
              </p>
              {!election.isEnded && !election.isActive && (
                <button
                  onClick={() => onUpdateElection(election)}
                  className="text-outline hover:text-on-surface-variant transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">edit</span>
                </button>
              )}
            </div>
            <p className="text-xs text-outline mt-0.5">#{election.id}</p>
          </div>
          <ElectionStatus election={election} />
        </div>

        {election.description && (
          <p className="text-xs text-on-surface-variant leading-relaxed line-clamp-2 mb-3">
            {election.description}
          </p>
        )}

        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="flex items-center gap-1.5 text-[10px] text-outline">
            <span className="material-symbols-outlined text-[14px]">schedule</span>
            <span className="truncate">{formatDate(election.startTime)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-outline">
            <span className="material-symbols-outlined text-[14px]">event_busy</span>
            <span className="truncate">{formatDate(election.endTime)}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 text-xs text-outline">
          <span className="material-symbols-outlined text-[14px]">person</span>
          <span>{activeCands.length} ứng viên</span>
        </div>
      </div>

      <div className="px-4 py-3 border-t border-white/5 flex items-center gap-1.5 flex-wrap bg-surface-container/40">
        {election.onChainId === null && !isActive && !isEnded && activeCands.length >= 2 && (
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
        {election.onChainId !== null && !isActive && !isEnded && (
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
        {election.onChainId !== null && activeCands.some(c => c.onChainId === null) && !isEnded && (
          <button
            onClick={() => onSyncCandidates(election.id)}
            disabled={processing[`sync-${election.id}`]}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 disabled:opacity-50 text-xs text-primary border border-primary/20 transition-all"
          >
            <span className={`material-symbols-outlined text-[13px] ${processing[`sync-${election.id}`] ? 'animate-spin' : ''}`}>
              {processing[`sync-${election.id}`] ? 'autorenew' : 'sync'}
            </span>
            {processing[`sync-${election.id}`] ? 'Đồng bộ' : 'Đồng bộ'}
          </button>
        )}
        {isActive && (
          <div className="flex gap-1.5">
            <button
              onClick={() => onPause(election.id)}
              disabled={processing[`pause-${election.id}`]}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#f2ca50]/10 hover:bg-[#f2ca50]/20 disabled:opacity-50 text-xs text-[#f2ca50] border border-[#f2ca50]/20 transition-all"
            >
              <span className={`material-symbols-outlined text-[13px] ${processing[`pause-${election.id}`] ? 'animate-spin' : ''}`}>
                {processing[`pause-${election.id}`] ? 'autorenew' : 'pause'}
              </span>
              {processing[`pause-${election.id}`] ? 'Đang dừng...' : 'Tạm dừng'}
            </button>
            <button
              onClick={() => onEnd(election.id)}
              disabled={processing[`end-${election.id}`]}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#ff4d4d]/10 hover:bg-[#ff4d4d]/20 disabled:opacity-50 text-xs text-[#ff4d4d] border border-[#ff4d4d]/20 transition-all"
            >
              <span className={`material-symbols-outlined text-[13px] ${processing[`end-${election.id}`] ? 'animate-spin' : ''}`}>
                {processing[`end-${election.id}`] ? 'autorenew' : 'stop'}
              </span>
              {processing[`end-${election.id}`] ? 'Đang kết thúc...' : 'Kết thúc'}
            </button>
          </div>
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

        {!election.isActive && !election.isEnded && (
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
        <div className="border-t border-white/5 bg-surface-container/30 px-4 py-4 space-y-3 animate-in slide-in-from-top-2 duration-300">
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
                            {!election.isActive && !election.isEnded && (
                              <button
                                onClick={() => startEdit(c)}
                                className="opacity-0 group-hover:opacity-100 text-outline hover:text-primary transition-all p-1"
                              >
                                <span className="material-symbols-outlined text-[16px]">edit</span>
                              </button>
                            )}
                            {!election.isActive && !election.isEnded && (
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

          {!election.isActive && !election.isEnded && (
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
  const [newStartTime, setNewStartTime] = useState('')
  const [newEndTime, setNewEndTime] = useState('')
  const [creating, setCreating] = useState(false)

  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<ElectionTab>('upcoming')

  // Global Election Edit State
  const [editingElection, setEditingElection] = useState<Election | null>(null)
  const [editElTitle, setEditElTitle] = useState('')
  const [editElDesc, setEditElDesc] = useState('')
  const [editElStart, setEditElStart] = useState('')
  const [editElEnd, setEditElEnd] = useState('')
  const [savingElection, setSavingElection] = useState(false)
  const [adminSearchQuery, setAdminSearchQuery] = useState('')
  const [showElectionBrowser, setShowElectionBrowser] = useState(false)

  const openEditModal = (e: Election) => {
    setEditingElection(e)
    setEditElTitle(e.title)
    setEditElDesc(e.description || '')
    setEditElStart(e.startTime ? new Date(e.startTime).toISOString().slice(0, 16) : '')
    setEditElEnd(e.endTime ? new Date(e.endTime).toISOString().slice(0, 16) : '')
  }

  const tabElections = useMemo<Record<ElectionTab, Election[]>>(() => {
    const filterBySearch = (list: Election[]) => 
      list.filter(e => e.title.toLowerCase().includes(adminSearchQuery.toLowerCase()))
      
    return {
      upcoming: filterBySearch((elections || []).filter((e) => classifyElection(e) === 'upcoming')),
      active: filterBySearch((elections || []).filter((e) => classifyElection(e) === 'active')),
      ended: filterBySearch((elections || []).filter((e) => classifyElection(e) === 'ended')),
    }
  }, [elections, adminSearchQuery])

  const visibleElections = tabElections[activeTab]
  const allFilteredElections = useMemo(() => {
    return (elections || []).filter(e => e.title.toLowerCase().includes(adminSearchQuery.toLowerCase()))
  }, [elections, adminSearchQuery])

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
      await createElection({ 
        title: newTitle, 
        description: newDesc,
        startTime: newStartTime || undefined,
        endTime: newEndTime || undefined,
      })
      setNewTitle('')
      setNewDesc('')
      setNewStartTime('')
      setNewEndTime('')
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

  const handlePause = async (id: number) => {
    setProcessing(prev => ({ ...prev, [`pause-${id}`]: true }))
    try {
      await pauseElection(id)
      load()
    }
    catch (err) { setError(getApiErrorMessage(err, 'Không thể tạm dừng bầu cử')) }
    finally { setProcessing(prev => ({ ...prev, [`pause-${id}`]: false })) }
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

  const handleUpdateElection = async () => {
    if (!editingElection || !editElTitle.trim()) return
    setSavingElection(true)
    try {
      await updateElection(editingElection.id, {
        title: editElTitle.trim(),
        description: editElDesc.trim(),
        startTime: editElStart || undefined,
        endTime: editElEnd || undefined,
      })
      setEditingElection(null)
      load()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Cập nhật cuộc bầu cử thất bại'))
    } finally {
      setSavingElection(false)
    }
  }

  const handleRemoveCandidate = async (electionId: number, cand: Candidate) => {
    if (!confirm(`Xóa ứng viên "${cand.name}"?`)) return
    try { await removeCandidate(electionId, cand.id); load() }
    catch (err) { setError(getApiErrorMessage(err, 'Xóa ứng viên thất bại')) }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-on-surface" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Quản lý bầu cử
          </h2>
          <p className="text-xs text-outline mt-1">Tạo và cấu hình các cuộc bầu cử on-chain</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">search</span>
            <input 
              type="text"
              placeholder="Tìm tên cuộc bầu cử..."
              value={adminSearchQuery}
              onChange={(e) => setAdminSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-on-surface focus:outline-none focus:border-primary/40 transition-all"
            />
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-on-primary text-sm font-semibold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all whitespace-nowrap"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
            Tạo mới
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-0 -mb-2">
        <div className="flex items-center gap-1">
          {(
            [
              { key: 'upcoming', label: 'Sắp diễn ra', icon: 'schedule' },
              { key: 'active',   label: 'Đang diễn ra', icon: 'radio_button_checked' },
              { key: 'ended',    label: 'Đã kết thúc',  icon: 'check_circle' },
            ] as { key: ElectionTab; label: string; icon: string }[]
          ).map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-all ${
                activeTab === key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-outline hover:text-on-surface-variant'
              }`}
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              <span className="material-symbols-outlined text-[14px]">{icon}</span>
              {label}
              <span
                className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold ml-1 ${
                  activeTab === key
                    ? 'bg-primary/15 text-primary'
                    : 'bg-white/5 text-outline'
                }`}
              >
                {tabElections[key].length}
              </span>
            </button>
          ))}
        </div>
        
        <button
          onClick={() => setShowElectionBrowser(true)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-primary text-[10px] font-bold uppercase tracking-widest hover:bg-primary/5 transition-all"
        >
          <span className="material-symbols-outlined text-[16px]">grid_view</span>
          Duyệt nhanh
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-error/10 border border-error/20 flex items-start gap-3 animate-in fade-in slide-in-from-top-1">
          <span className="material-symbols-outlined text-error text-[20px]">error</span>
          <p className="text-xs text-error font-medium leading-relaxed flex-1">{error}</p>
          <button onClick={() => setError('')} className="text-error/60 hover:text-error">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-md rounded-2xl overflow-hidden animate-in fade-in zoom-in duration-200 shadow-2xl shadow-black/50">
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
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-outline ml-1">Bắt đầu</label>
                  <input
                    type="datetime-local"
                    value={newStartTime}
                    onChange={(e) => setNewStartTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-surface-container border border-white/10 text-xs text-on-surface focus:outline-none focus:border-primary/40"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-outline ml-1">Kết thúc</label>
                  <input
                    type="datetime-local"
                    value={newEndTime}
                    onChange={(e) => setNewEndTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-surface-container border border-white/10 text-xs text-on-surface focus:outline-none focus:border-primary/40"
                  />
                </div>
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
                  className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-sm font-bold text-primary hover:bg-white/5 transition-all active:scale-[0.98] disabled:opacity-50"
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
      ) : visibleElections.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 flex flex-col items-center justify-center text-center mt-6 animate-in fade-in slide-in-from-bottom-2">
          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-outline text-[32px]">
              {activeTab === 'upcoming' ? 'schedule' : activeTab === 'active' ? 'radio_button_checked' : 'check_circle'}
            </span>
          </div>
          <h3 className="text-lg font-bold text-on-surface">Không có cuộc bầu cử</h3>
          <p className="text-sm text-outline max-w-xs mb-4 mt-2">
            {activeTab === 'upcoming' && 'Chưa có cuộc bầu cử nào sắp diễn ra.'}
            {activeTab === 'active' && 'Chưa có cuộc bầu cử nào đang diễn ra.'}
            {activeTab === 'ended' && 'Chưa có cuộc bầu cử nào đã kết thúc.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6 animate-in fade-in duration-500">
          {visibleElections.map((el) => (
            <ElectionCard
              key={el.id}
              election={el}
              isExpanded={expandedId === el.id}
              onToggleExpand={() => setExpandedId(expandedId === el.id ? null : el.id)}
              onPushToChain={handlePushToChain}
              onStart={handleStart}
              onEnd={handleEnd}
              onPause={handlePause}
              onDelete={handleDelete}
              onAddCandidate={handleAddCandidate}
              onRemoveCandidate={handleRemoveCandidate}
              onUpdateCandidate={handleUpdateCandidate}
              onUpdateElection={openEditModal}
              onSyncCandidates={handleSyncCandidates}
              processing={processing}
            />
          ))}
        </div>
      )}

      {/* ── GLOBAL EDIT ELECTION MODAL ── */}
      {editingElection && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="glass-card w-full max-w-md rounded-2xl overflow-hidden animate-in fade-in zoom-in duration-200 shadow-2xl">
            <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-lg font-bold text-on-surface">Sửa cuộc bầu cử</h3>
              <button onClick={() => setEditingElection(null)} className="text-outline hover:text-on-surface">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-outline ml-1">Tiêu đề *</label>
                <input
                  type="text"
                  value={editElTitle}
                  onChange={(e) => setEditElTitle(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-surface-container border border-white/10 text-sm text-on-surface focus:outline-none focus:border-primary/40"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-outline ml-1">Mô tả</label>
                <textarea
                  rows={3}
                  value={editElDesc}
                  onChange={(e) => setEditElDesc(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-surface-container border border-white/10 text-sm text-on-surface focus:outline-none focus:border-primary/40"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-outline ml-1">Bắt đầu</label>
                  <input
                    type="datetime-local"
                    value={editElStart}
                    onChange={(e) => setEditElStart(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-surface-container border border-white/10 text-xs text-on-surface focus:outline-none focus:border-primary/40"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-outline ml-1">Kết thúc</label>
                  <input
                    type="datetime-local"
                    value={editElEnd}
                    onChange={(e) => setEditElEnd(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-surface-container border border-white/10 text-xs text-on-surface focus:outline-none focus:border-primary/40"
                  />
                </div>
              </div>
              <div className="pt-2 flex gap-3">
                <button
                  onClick={() => setEditingElection(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-sm font-semibold text-outline hover:bg-white/5 transition-all"
                >
                  Hủy
                </button>
                <button
                  onClick={handleUpdateElection}
                  disabled={savingElection || !editElTitle.trim()}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-sm font-bold text-primary hover:bg-white/5 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {savingElection ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ── ELECTION BROWSER MODAL (Large Scale) ── */}
      {showElectionBrowser && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="glass-card w-full max-w-3xl max-h-[85vh] rounded-3xl overflow-hidden flex flex-col shadow-2xl border-white/10 animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-white/10 flex items-center justify-between gap-4">
              <div className="flex-1 relative group">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px] group-focus-within:text-primary transition-colors">
                  search
                </span>
                <input
                  type="text"
                  autoFocus
                  placeholder="Tìm kiếm cuộc bầu cử để quản lý..."
                  value={adminSearchQuery}
                  onChange={(e) => setAdminSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-10 py-3 rounded-2xl bg-white/[0.05] border border-white/10 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-primary/40 focus:bg-white/[0.08] transition-all"
                />
              </div>
              <button 
                onClick={() => setShowElectionBrowser(false)}
                className="w-10 h-10 rounded-full flex items-center justify-center text-outline hover:text-on-surface hover:bg-white/10 transition-all"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {allFilteredElections.map((el) => {
                  const status = classifyElection(el)
                  return (
                    <button
                      key={el.id}
                      onClick={() => { 
                        setActiveTab(status); 
                        setExpandedId(el.id); 
                        setShowElectionBrowser(false);
                      }}
                      className="flex flex-col gap-2 p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.08] hover:border-white/20 transition-all text-left group"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider ${
                          status === 'active' ? 'bg-tertiary/10 text-tertiary' :
                          status === 'ended' ? 'bg-white/5 text-outline' :
                          'bg-primary/10 text-primary'
                        }`}>
                          {status === 'active' ? 'Live' : status === 'ended' ? 'Hết hạn' : 'Nháp'}
                        </span>
                        <span className="text-[9px] text-outline font-mono">#{el.id}</span>
                      </div>
                      <p className="text-sm font-bold text-on-surface line-clamp-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                        {el.title}
                      </p>
                      <div className="mt-auto pt-2 flex items-center justify-between text-outline">
                        <span className="text-[10px]">{el.candidates.length} ứng viên</span>
                        <span className="material-symbols-outlined text-[16px] opacity-0 group-hover:opacity-100 transition-opacity">edit_note</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="p-4 bg-white/[0.02] border-t border-white/5 text-center flex justify-between items-center px-6">
              <p className="text-[10px] text-outline uppercase tracking-widest font-semibold">
                Tổng cộng {elections.length} cuộc bầu cử
              </p>
              <button 
                onClick={() => { setAdminSearchQuery(''); setShowElectionBrowser(false) }}
                className="text-[10px] text-primary hover:underline font-bold uppercase tracking-widest"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

