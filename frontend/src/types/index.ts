export type Route = 'home' | 'vote' | 'results' | 'admin'

export type ToastType = 'success' | 'error' | 'info'

export interface Toast {
  message: string
  type: ToastType
}

export type AuthStep = 'IDLE' | 'OTP_SENT' | 'VERIFIED'

export type VerifyMode = 'email' | 'phone'

export interface Nominee {
  id: number
  name: string
  description: string
  image: string
}

export interface Category {
  id: number
  title: string
  description: string
  icon: string
  nominees: Nominee[]
}

export interface HealthStatus {
  status: string
  database: string
  contract: string
  mailer: string
  sms: string
}

export interface AdminUser {
  id: number
  email: string | null
  phone: string | null
  walletAddress: string | null
  isVerified: boolean
  createdAt: string
}

export interface AdminLog {
  id: number
  action: string
  description: string
  timestamp: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
}
