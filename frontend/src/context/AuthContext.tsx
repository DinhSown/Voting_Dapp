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

interface AuthContextValue {
  user: AuthUser | null
  isAuthenticated: boolean
  isAdmin: boolean
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

  const restoreSession = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) { setLoading(false); return }
    try {
      const profile = await getProfile(token)
      setUser(profile)
    } catch {
      localStorage.removeItem(TOKEN_KEY)
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
    }
    window.ethereum.on('accountsChanged', handler)
    return () => { window.ethereum?.removeListener('accountsChanged', handler) }
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
    const result = await walletAuth(walletAddress, signature, nonce)

    if (!result.requiresOtp && result.token) {
      localStorage.setItem(TOKEN_KEY, result.token)
      setUser(result.user)
      return { requiresOtp: false }
    }

    // First-time: store tempToken for OTP step
    setTempToken(result.tempToken ?? null)
    return { requiresOtp: true }
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

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isAdmin: user?.role === 'admin',
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
