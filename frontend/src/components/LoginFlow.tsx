import { useState } from 'react'
import { useAuthContext } from '../context/AuthContext'
import { getApiErrorMessage } from '../services/api'

interface LoginFlowProps {
  walletAddress: string
  onSuccess: () => void
}

export function LoginFlow({ walletAddress, onSuccess }: LoginFlowProps) {
  const { login, sendOtp, verifyOtp } = useAuthContext()
  const [step, setStep] = useState<'sign' | 'email' | 'otp'>('sign')
  const [email, setEmail] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mockOtp, setMockOtp] = useState(false)

  const handleSign = async () => {
    setLoading(true)
    setError('')
    try {
      const { requiresOtp } = await login(walletAddress)
      if (requiresOtp) {
        setStep('email')
      } else {
        onSuccess()
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Xác thực thất bại'))
    } finally {
      setLoading(false)
    }
  }

  const handleSendOtp = async () => {
    if (!email.trim()) { setError('Vui lòng nhập email'); return }
    setLoading(true)
    setError('')
    try {
      const { deliveryMode } = await sendOtp(email)
      setMockOtp(deliveryMode === 'mock')
      setStep('otp')
    } catch (err) {
      setError(getApiErrorMessage(err, 'Gửi OTP thất bại'))
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async () => {
    if (!otpCode.trim()) { setError('Vui lòng nhập mã OTP'); return }
    setLoading(true)
    setError('')
    try {
      await verifyOtp(email, otpCode)
      onSuccess()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Mã OTP không hợp lệ'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {step === 'sign' && (
        <>
          <p className="text-sm text-white/60">
            Ký thông điệp để xác thực ví của bạn. Thao tác này không tốn phí gas.
          </p>
          <p className="text-xs text-white/40 font-mono break-all">
            {walletAddress.slice(0, 10)}...{walletAddress.slice(-8)}
          </p>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            onClick={handleSign}
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-sm font-medium transition-colors"
          >
            {loading ? 'Đang ký...' : 'Ký xác thực'}
          </button>
        </>
      )}

      {step === 'email' && (
        <>
          <p className="text-sm text-white/60">
            Đây là lần đầu bạn đăng nhập. Vui lòng xác minh email để hoàn tất.
          </p>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Nhập địa chỉ email"
            className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-sm placeholder:text-white/40 focus:outline-none focus:border-purple-500"
            onKeyDown={(e) => e.key === 'Enter' && handleSendOtp()}
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            onClick={handleSendOtp}
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-sm font-medium transition-colors"
          >
            {loading ? 'Đang gửi...' : 'Gửi mã OTP'}
          </button>
        </>
      )}

      {step === 'otp' && (
        <>
          <p className="text-sm text-white/60">
            Nhập mã OTP đã gửi đến <span className="text-white">{email}</span>
          </p>
          {mockOtp && (
            <p className="text-xs text-yellow-400/80 bg-yellow-400/10 border border-yellow-400/20 rounded-lg px-3 py-2">
              Email chưa được cấu hình — mã OTP đã được in ra console của server backend.
            </p>
          )}
          <input
            type="text"
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="6 chữ số"
            maxLength={6}
            className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-sm text-center tracking-widest placeholder:text-white/40 focus:outline-none focus:border-purple-500"
            onKeyDown={(e) => e.key === 'Enter' && handleVerifyOtp()}
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            onClick={handleVerifyOtp}
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-sm font-medium transition-colors"
          >
            {loading ? 'Đang xác minh...' : 'Xác minh'}
          </button>
          <button
            onClick={() => { setStep('email'); setMockOtp(false) }}
            className="w-full text-sm text-white/40 hover:text-white/70 transition-colors"
          >
            Đổi email
          </button>
        </>
      )}
    </div>
  )
}
