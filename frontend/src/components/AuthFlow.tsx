import { Mail, Phone, CheckCircle, Loader, AlertCircle } from 'lucide-react'
import type { AuthState } from '../hooks/useAuth'

interface Props {
  auth: AuthState
  walletAddress: string
}

export function AuthFlow({ auth, walletAddress: _walletAddress }: Props) {
  const {
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
  } = auth

  if (step === 'VERIFIED') {
    return (
      <div className="panel p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
            <CheckCircle size={20} className="text-green-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">Đã xác minh danh tính</p>
            <p className="text-xs text-white/50">
              {verifyMode === 'email' ? email : phone}
            </p>
          </div>
          <button
            onClick={reset}
            className="ml-auto text-xs text-white/30 hover:text-white/60 transition-colors"
          >
            Đổi
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="panel p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Mail size={18} className="text-[#a2e7ff]" />
        <h3 className="text-sm font-semibold text-white">Xác minh danh tính</h3>
      </div>

      {step === 'IDLE' && (
        <div className="flex gap-2">
          <button
            onClick={() => setVerifyMode('email')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-medium border transition-all flex items-center justify-center gap-1.5 ${
              verifyMode === 'email'
                ? 'bg-[#a2e7ff]/20 border-[#a2e7ff]/40 text-[#a2e7ff]'
                : 'bg-white/5 border-white/10 text-white/50 hover:text-white/80'
            }`}
          >
            <Mail size={12} /> Email
          </button>
          <button
            onClick={() => setVerifyMode('phone')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-medium border transition-all flex items-center justify-center gap-1.5 ${
              verifyMode === 'phone'
                ? 'bg-[#a2e7ff]/20 border-[#a2e7ff]/40 text-[#a2e7ff]'
                : 'bg-white/5 border-white/10 text-white/50 hover:text-white/80'
            }`}
          >
            <Phone size={12} /> Số điện thoại
          </button>
        </div>
      )}

      {step === 'IDLE' && (
        <>
          <input
            type={verifyMode === 'email' ? 'email' : 'tel'}
            placeholder={verifyMode === 'email' ? 'email@example.com' : '+84 xxx xxx xxx'}
            value={verifyMode === 'email' ? email : phone}
            onChange={(e) =>
              verifyMode === 'email' ? setEmail(e.target.value) : setPhone(e.target.value)
            }
            className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#a2e7ff]/50 transition-colors"
          />
          <button
            onClick={sendOtp}
            disabled={loading || (verifyMode === 'email' ? !email : !phone)}
            className="w-full py-2.5 px-4 rounded-xl bg-[#a2e7ff]/20 text-[#a2e7ff] border border-[#a2e7ff]/30 font-semibold text-sm hover:bg-[#a2e7ff]/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {loading ? <Loader size={16} className="animate-spin" /> : null}
            {loading ? 'Đang gửi...' : 'Gửi mã OTP'}
          </button>
        </>
      )}

      {step === 'OTP_SENT' && (
        <>
          <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <p className="text-xs text-blue-300">
              Mã OTP đã gửi đến{' '}
              <span className="font-semibold">{verifyMode === 'email' ? email : phone}</span>
            </p>
          </div>
          <input
            type="text"
            placeholder="Nhập mã 6 chữ số"
            value={otp}
            onChange={(e) => setOtp(e.target.value.slice(0, 6))}
            maxLength={6}
            className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white text-center tracking-[0.5em] placeholder-white/30 focus:outline-none focus:border-[#a2e7ff]/50 transition-colors"
          />
          <div className="flex gap-2">
            <button
              onClick={reset}
              className="flex-1 py-2.5 px-4 rounded-xl border border-white/10 text-white/60 text-sm hover:bg-white/5 transition-all"
            >
              Quay lại
            </button>
            <button
              onClick={() => verifyOtp(walletAddress)}
              disabled={loading || otp.length !== 6}
              className="flex-1 py-2.5 px-4 rounded-xl bg-green-500/20 text-green-300 border border-green-500/30 font-semibold text-sm hover:bg-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {loading ? <Loader size={16} className="animate-spin" /> : null}
              {loading ? 'Đang xác minh...' : 'Xác minh'}
            </button>
          </div>
        </>
      )}

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
          <AlertCircle size={14} className="text-red-400 mt-0.5 shrink-0" />
          <p className="text-xs text-red-300">{error}</p>
        </div>
      )}
    </div>
  )
}
