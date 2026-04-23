import { useState, useEffect, useCallback } from 'react'
import { castVoteOnChain } from '../services/wallet'
import { recordVote, fetchMyVotes } from '../services/api'

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

  const castVote = useCallback(
    async (
      election: { id: number; onChainId: number | null; title: string },
      candidate: { id: number; onChainId: number | null; name: string }
    ): Promise<string> => {
      if (election.onChainId === null) throw new Error('Cuộc bầu cử chưa được đẩy lên blockchain')
      if (candidate.onChainId === null) throw new Error('Ứng viên chưa được đăng ký trên blockchain')

      setVotingFor(candidate.id)
      try {
        const txHash = await castVoteOnChain(candidate.onChainId, election.onChainId)
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
