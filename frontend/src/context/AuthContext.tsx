import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import {
  getNonce,
  walletAuth,
  logoutApi,
  getProfile,
  sendEmailOtpNew,
  verifyEmailOtpNew,
} from '../services/api'
import type { AuthUser } from '../types'

const TOKEN_KEY = 'mechoice_token'

function isAccountBannedError(error: unknown): boolean {
  return (
    !!error &&
    typeof error === 'object' &&
    'response' in error &&
    !!error.response &&
    typeof error.response === 'object' &&
    'status' in error.response &&
    error.response.status === 403 &&
    'data' in error.response &&
    !!error.response.data &&
    typeof error.response.data === 'object' &&
    'code' in error.response.data &&
    error.response.data.code === 'ACCOUNT_BANNED'
  )
}

interface AuthContextValue {
  user: AuthUser | null
  isAuthenticated: boolean
  isAdmin: boolean
  bannedWallet: string | null
  loading: boolean
  tempToken: string | null
  login: (walletAddress: string) => Promise<{ requiresOtp: boolean }>
  sendOtp: (email: string) => Promise<{ deliveryMode: 'smtp' | 'mock' }>
  verifyOtp: (email: string, otpCode: string) => Promise<void>
  logout: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [tempToken, setTempToken] = useState<string | null>(null)
  const [bannedWallet, setBannedWallet] = useState<string | null>(null)

  const restoreSession = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) { setLoading(false); return }
    try {
      const profile = await getProfile(token)
      setUser(profile)
    } catch (err) {
      if (isAccountBannedError(err) && window.ethereum) {
        const accounts = (await window.ethereum.request({ method: 'eth_accounts' }).catch(() => [])) as string[]
        if (accounts[0]) setBannedWallet(accounts[0].toLowerCase())
      }
      localStorage.removeItem(TOKEN_KEY)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    restoreSession()
  }, [restoreSession])

  // Auto-logout when MetaMask account changes to a different address
  useEffect(() => {
    if (!window.ethereum) return
    const handler = (accounts: unknown) => {
      const accs = accounts as string[]
      if (!accs.length || (user && accs[0].toLowerCase() !== user.walletAddress?.toLowerCase())) {
        logout()
      }
      if (accs.length && bannedWallet && accs[0].toLowerCase() !== bannedWallet) {
        setBannedWallet(null)
      }
    }
    window.ethereum.on('accountsChanged', handler)
    return () => { window.ethereum?.removeListener('accountsChanged', handler) }
  }, [user, bannedWallet])

  useEffect(() => {
    const handler = async () => {
      let walletAddress = user?.walletAddress?.toLowerCase() ?? null
      if (!walletAddress && window.ethereum) {
        const accounts = (await window.ethereum.request({ method: 'eth_accounts' }).catch(() => [])) as string[]
        walletAddress = accounts[0]?.toLowerCase() ?? null
      }
      setBannedWallet(walletAddress)
      setUser(null)
      setTempToken(null)
    }
    window.addEventListener('mechoice:account-banned', handler)
    return () => window.removeEventListener('mechoice:account-banned', handler)
  }, [user])

  const login = useCallback(async (walletAddress: string): Promise<{ requiresOtp: boolean }> => {
    // 1. Get nonce
    const { nonce } = await getNonce(walletAddress)

    // 2. Sign with MetaMask
    const message = `Sign this message to authenticate with meChoice.\n\nNonce: ${nonce}`
    const signature = await (window.ethereum as { request: (args: { method: string; params: string[] }) => Promise<string> }).request({
      method: 'personal_sign',
      params: [message, walletAddress],
    })

    // 3. Send to backend
    try {
      const result = await walletAuth(walletAddress, signature, nonce)

      if (!result.requiresOtp && result.token) {
        localStorage.setItem(TOKEN_KEY, result.token)
        setUser(result.user)
        setBannedWallet(null)
        return { requiresOtp: false }
      }

      // First-time: store tempToken for OTP step
      setTempToken(result.tempToken ?? null)
      return { requiresOtp: true }
    } catch (err) {
      if (isAccountBannedError(err)) {
        setBannedWallet(walletAddress.toLowerCase())
        setUser(null)
        setTempToken(null)
      }
      throw err
    }
  }, [])

  const sendOtp = useCallback(async (email: string): Promise<{ deliveryMode: 'smtp' | 'mock' }> => {
    if (!tempToken) throw new Error('No active session')
    return sendEmailOtpNew(email, tempToken)
  }, [tempToken])

  const verifyOtp = useCallback(async (email: string, otpCode: string) => {
    if (!tempToken) throw new Error('No active session')
    const result = await verifyEmailOtpNew(email, otpCode, tempToken)
    localStorage.setItem(TOKEN_KEY, result.token)
    setUser(result.user)
    setTempToken(null)
  }, [tempToken])

  const logout = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (token) {
      await logoutApi(token).catch(() => undefined)
    }
    localStorage.removeItem(TOKEN_KEY)
    setUser(null)
    setTempToken(null)
  }, [])

  const refreshProfile = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) return
    try {
      const profile = await getProfile(token)
      setUser(profile)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    if (!user) return
    const timer = window.setInterval(() => {
      void refreshProfile()
    }, 10_000)
    return () => window.clearInterval(timer)
  }, [user, refreshProfile])

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isAdmin: user?.role === 'admin',
        bannedWallet,
        loading,
        tempToken,
        login,
        sendOtp,
        verifyOtp,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuthContext must be used inside AuthProvider')
  return ctx
}
