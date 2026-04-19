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

export function ElectionsTab() {
  const [elections, setElections] = useState<Election[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Create form
  const [showCreate, setShowCreate] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [creating, setCreating] = useState(false)

  // Candidate form per election
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [newCandName, setNewCandName] = useState('')
  const [newCandDesc, setNewCandDesc] = useState('')
  const [addingCand, setAddingCand] = useState(false)

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
    try {
      await deleteElection(id)
      load()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Xóa thất bại'))
    }
  }

  const handlePushToChain = async (id: number) => {
    setError('')
    try {
      await pushElectionToChain(id)
      load()
    } catch (err) {
      const base = getApiErrorMessage(err, 'Đẩy lên blockchain thất bại')
      const details =
        err &&
        typeof err === 'object' &&
        'response' in err &&
        (err as { response?: { data?: { details?: string } } }).response?.data?.details
      setError(details ? `${base}: ${details}` : base)
    }
  }

  const handleStart = async (id: number) => {
    try {
      await startElection(id)
      load()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Không thể bắt đầu bầu cử'))
    }
  }

  const handleEnd = async (id: number) => {
    try {
      await endElection(id)
      load()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Không thể kết thúc bầu cử'))
    }
  }

  const handleAddCandidate = async (electionId: number) => {
    if (!newCandName.trim()) return
    setAddingCand(true)
    try {
      await addCandidate(electionId, { name: newCandName, description: newCandDesc })
      setNewCandName('')
      setNewCandDesc('')
      load()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Thêm ứng viên thất bại'))
    } finally {
      setAddingCand(false)
    }
  }

  const handleRemoveCandidate = async (electionId: number, cand: Candidate) => {
    if (!confirm(`Xóa ứng viên "${cand.name}"?`)) return
    try {
      await removeCandidate(electionId, cand.id)
      load()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Xóa ứng viên thất bại'))
    }
  }

  if (loading) return <div className="text-white/40 py-8 text-center text-sm animate-pulse">Đang tải...</div>

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-red-400 text-sm flex items-center justify-between gap-3">
          <span>{error}</span>
          <button onClick={load} className="text-xs text-red-300 hover:text-red-200 underline shrink-0">
            Thử lại
          </button>
        </div>
      )}

      {/* Create button */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-white">Cuộc bầu cử ({elections.length})</h2>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-sm font-medium transition-colors"
        >
          + Tạo mới
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-3">
          <h3 className="text-sm font-medium text-white">Tạo cuộc bầu cử mới</h3>
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Tên cuộc bầu cử *"
            className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-purple-500"
          />
          <textarea
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Mô tả (tùy chọn)"
            rows={2}
            className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-purple-500 resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={creating || !newTitle.trim()}
              className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-sm font-medium transition-colors"
            >
              {creating ? 'Đang tạo...' : 'Tạo'}
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm transition-colors"
            >
              Hủy
            </button>
          </div>
        </div>
      )}

      {/* Elections list */}
      {elections.length === 0 ? (
        <div className="text-center py-12 text-white/30 text-sm">
          Chưa có cuộc bầu cử nào
        </div>
      ) : (
        <div className="space-y-3">
          {elections.map((election) => {
            const isExpanded = expandedId === election.id
            const activeCands = election.candidates.filter((c) => !c.isRemoved)

            return (
              <div
                key={election.id}
                className="rounded-xl bg-white/5 border border-white/10 overflow-hidden"
              >
                {/* Header */}
                <div className="px-4 py-3 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-white text-sm">{election.title}</span>
                      {election.isActive && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-green-500/20 text-green-400 border border-green-500/30">
                          Đang diễn ra
                        </span>
                      )}
                      {election.onChainId === null && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                          Nháp
                        </span>
                      )}
                    </div>
                    {election.description && (
                      <p className="text-xs text-white/40 mt-0.5 truncate">{election.description}</p>
                    )}
                    <p className="text-xs text-white/30 mt-0.5">
                      {activeCands.length} ứng viên · #{election.id}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {election.onChainId === null && !election.isActive && activeCands.length >= 2 && (
                      <button
                        onClick={() => handlePushToChain(election.id)}
                        className="px-2.5 py-1 rounded-lg bg-blue-600/80 hover:bg-blue-500 text-xs font-medium transition-colors"
                      >
                        Đẩy lên chain
                      </button>
                    )}
                    {election.onChainId !== null && !election.isActive && (
                      <button
                        onClick={() => handleStart(election.id)}
                        className="px-2.5 py-1 rounded-lg bg-green-600/80 hover:bg-green-500 text-xs font-medium transition-colors"
                      >
                        Bắt đầu
                      </button>
                    )}
                    {election.isActive && (
                      <button
                        onClick={() => handleEnd(election.id)}
                        className="px-2.5 py-1 rounded-lg bg-red-600/80 hover:bg-red-500 text-xs font-medium transition-colors"
                      >
                        Kết thúc
                      </button>
                    )}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : election.id)}
                      className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs transition-colors"
                    >
                      {isExpanded ? 'Thu gọn' : 'Ứng viên'}
                    </button>
                    {!election.isActive && (
                      <button
                        onClick={() => handleDelete(election.id)}
                        className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-red-500/20 hover:text-red-400 text-xs transition-colors text-white/40"
                      >
                        Xóa
                      </button>
                    )}
                  </div>
                </div>

                {/* Candidates section */}
                {isExpanded && (
                  <div className="border-t border-white/5 px-4 py-3 space-y-3">
                    <h4 className="text-xs font-medium text-white/60 uppercase tracking-wider">
                      Ứng viên
                    </h4>

                    {activeCands.length === 0 ? (
                      <p className="text-xs text-white/30">Chưa có ứng viên</p>
                    ) : (
                      <div className="space-y-1.5">
                        {activeCands.map((c) => (
                          <div
                            key={c.id}
                            className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2"
                          >
                            <div>
                              <span className="text-sm text-white">{c.name}</span>
                              {c.description && (
                                <span className="text-xs text-white/40 ml-2">{c.description}</span>
                              )}
                            </div>
                            {!election.isActive && (
                              <button
                                onClick={() => handleRemoveCandidate(election.id, c)}
                                className="text-xs text-white/30 hover:text-red-400 transition-colors ml-2"
                              >
                                Xóa
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add candidate */}
                    {!election.isActive && (
                      <div className="space-y-2 pt-2 border-t border-white/5">
                        <p className="text-xs text-white/50">Thêm ứng viên</p>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newCandName}
                            onChange={(e) => setNewCandName(e.target.value)}
                            placeholder="Tên ứng viên *"
                            className="flex-1 px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-purple-500"
                          />
                          <input
                            type="text"
                            value={newCandDesc}
                            onChange={(e) => setNewCandDesc(e.target.value)}
                            placeholder="Mô tả"
                            className="flex-1 px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-purple-500"
                          />
                          <button
                            onClick={() => handleAddCandidate(election.id)}
                            disabled={addingCand || !newCandName.trim()}
                            className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-xs font-medium transition-colors whitespace-nowrap"
                          >
                            {addingCand ? '...' : 'Thêm'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
