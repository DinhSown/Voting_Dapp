import { useState, useEffect, useCallback } from 'react'
import {
  requestAccounts,
  getChainId,
  switchToHardhat,
  onAccountsChanged,
  onChainChanged,
} from '../services/wallet'
import { HARDHAT_CHAIN_ID } from '../constants'

export interface WalletState {
  address: string
  chainId: number
  loading: boolean
  isCorrectNetwork: boolean
  connect: () => Promise<void>
  switchNetwork: () => Promise<void>
  error: string
}

export function useWallet(): WalletState {
  const [address, setAddress] = useState('')
  const [chainId, setChainId] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const unsubAccounts = onAccountsChanged((accounts) => {
      setAddress(accounts[0] ?? '')
    })
    const unsubChain = onChainChanged((id) => {
      setChainId(id)
    })
    return () => {
      unsubAccounts()
      unsubChain()
    }
  }, [])

  const connect = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const accounts = await requestAccounts()
      setAddress(accounts[0] ?? '')
      const id = await getChainId()
      setChainId(id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed')
    } finally {
      setLoading(false)
    }
  }, [])

  const switchNetwork = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      await switchToHardhat()
      const id = await getChainId()
      setChainId(id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network switch failed')
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    address,
    chainId,
    loading,
    isCorrectNetwork: chainId === HARDHAT_CHAIN_ID,
    connect,
    switchNetwork,
    error,
  }
}
