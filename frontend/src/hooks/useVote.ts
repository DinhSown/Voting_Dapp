import { useState, useCallback } from 'react'
import { castVoteOnChain } from '../services/wallet'
import { ELECTION_ID } from '../constants'

export interface VoteState {
  voted: Set<number>
  votingFor: number | null
  castVote: (candidateId: number, categoryId: number) => Promise<string>
}

export function useVote(): VoteState {
  const [voted, setVoted] = useState<Set<number>>(new Set())
  const [votingFor, setVotingFor] = useState<number | null>(null)

  const castVote = useCallback(
    async (candidateId: number, categoryId: number): Promise<string> => {
      setVotingFor(candidateId)
      try {
        const txHash = await castVoteOnChain(candidateId, ELECTION_ID)
        // categoryId tracks which voting category is completed (not individual candidate)
        setVoted((prev) => new Set([...prev, categoryId]))
        return txHash
        // No catch — errors propagate to caller's try-catch for UI feedback
      } finally {
        setVotingFor(null)
      }
    },
    []
  )

  return { voted, votingFor, castVote }
}
