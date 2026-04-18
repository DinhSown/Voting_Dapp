import { useState, useCallback } from 'react'
import {
  sendEmailOtp,
  verifyEmailOtp,
  sendPhoneOtp,
  verifyPhoneOtp,
  getApiErrorMessage,
} from '../services/api'
import { ELECTION_ID } from '../constants'
import type { AuthStep, VerifyMode } from '../types'

export interface AuthState {
  step: AuthStep
  verifyMode: VerifyMode
  email: string
  phone: string
  otp: string
  loading: boolean
  error: string
  setVerifyMode: (mode: VerifyMode) => void
  setEmail: (v: string) => void
  setPhone: (v: string) => void
  setOtp: (v: string) => void
  sendOtp: () => Promise<void>
  verifyOtp: (walletAddress: string) => Promise<void>
  reset: () => void
}

export function useAuth(): AuthState {
  const [step, setStep] = useState<AuthStep>('IDLE')
  const [verifyMode, setVerifyMode] = useState<VerifyMode>('email')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const sendOtp = useCallback(
    async () => {
      setLoading(true)
      setError('')
      try {
        if (verifyMode === 'email') {
          await sendEmailOtp(email)
        } else {
          await sendPhoneOtp(phone)
        }
        setStep('OTP_SENT')
      } catch (err) {
        setError(getApiErrorMessage(err, 'Gửi OTP thất bại'))
      } finally {
        setLoading(false)
      }
    },
    [verifyMode, email, phone]
  )

  const verifyOtp = useCallback(
    async (walletAddress: string) => {
      setLoading(true)
      setError('')
      try {
        if (verifyMode === 'email') {
          await verifyEmailOtp(email, otp, walletAddress, ELECTION_ID)
        } else {
          await verifyPhoneOtp(phone, otp, walletAddress, ELECTION_ID)
        }
        setStep('VERIFIED')
      } catch (err) {
        setError(getApiErrorMessage(err, 'Xác minh OTP thất bại'))
      } finally {
        setLoading(false)
      }
    },
    [verifyMode, email, phone, otp]
  )

  const reset = useCallback(() => {
    setStep('IDLE')
    setEmail('')
    setPhone('')
    setOtp('')
    setError('')
  }, [])

  return {
    step,
    verifyMode,
    email,
    phone,
    otp,
    loading,
    error,
    setVerifyMode,
    setEmail,
    setPhone,
    setOtp,
    sendOtp,
    verifyOtp,
    reset,
  }
}
