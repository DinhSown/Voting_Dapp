import { useState, useEffect, useCallback } from 'react'
import { castVoteOnChain } from '../services/wallet'
import { recordVote, fetchMyVotes, syncMyEligibility } from '../services/api'

const TOKEN_KEY = 'mechoice_token'

export interface VotedCandidate {
  candidateId: number
  candidateName: string
  categoryTitle: string
}

export interface VoteState {
  voted: Set<number>
  votedCandidates: Map<number, VotedCandidate>
  votingFor: number | null
  historyLoaded: boolean
  castVote: (
    election: { id: number; onChainId: number | null; title: string },
    candidate: { id: number; onChainId: number | null; name: string }
  ) => Promise<string>
}

export function useVote(): VoteState {
  const [voted, setVoted] = useState<Set<number>>(new Set())
  const [votedCandidates, setVotedCandidates] = useState<Map<number, VotedCandidate>>(new Map())
  const [votingFor, setVotingFor] = useState<number | null>(null)
  const [historyLoaded, setHistoryLoaded] = useState(false)

  // Restore vote state from backend on mount
  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) { setHistoryLoaded(true); return }
    fetchMyVotes()
      .then((votes) => {
        if (votes.length > 0) {
          setVoted(new Set(votes.map((v) => v.categoryId)))
          setVotedCandidates(new Map(votes.map((v) => [
            v.categoryId,
            { candidateId: v.candidateId, candidateName: v.candidateName, categoryTitle: v.categoryTitle },
          ])))
        }
      })
      .catch(() => undefined)
      .finally(() => setHistoryLoaded(true))
  }, [])

  const isUserNotEligibleError = (error: unknown): boolean => {
    const message = error instanceof Error ? error.message : String(error)
    const lower = message.toLowerCase()
    return lower.includes('user not eligible') || lower.includes('0x99f05a9c') || message.includes('mfBanA==')
  }

  const castVote = useCallback(
    async (
      election: { id: number; onChainId: number | null; title: string },
      candidate: { id: number; onChainId: number | null; name: string }
    ): Promise<string> => {
      if (election.onChainId === null) throw new Error('Cuoc bau cu chua duoc day len blockchain')
      if (candidate.onChainId === null) throw new Error('Ung vien chua duoc dang ky tren blockchain')

      setVotingFor(candidate.id)
      try {
        const syncResult = await syncMyEligibility()
        if (!syncResult.eligible || syncResult.isBanned) {
          throw new Error('Tai khoan hien chua du dieu kien de vote')
        }

        const txHash = await castVoteOnChain(candidate.onChainId, election.onChainId).catch((error) => {
          if (isUserNotEligibleError(error)) {
            throw new Error('Tai khoan chua duoc dong bo quyen vote len blockchain. Vui long thu lai sau.')
          }
          throw error
        })

        await recordVote(txHash)
        setVoted((prev) => new Set([...prev, election.id]))
        setVotedCandidates((prev) =>
          new Map(prev).set(election.id, {
            candidateId: candidate.id,
            candidateName: candidate.name,
            categoryTitle: election.title,
          })
        )
        return txHash
      } finally {
        setVotingFor(null)
      }
    },
    []
  )

  return { voted, votedCandidates, votingFor, historyLoaded, castVote }
}
