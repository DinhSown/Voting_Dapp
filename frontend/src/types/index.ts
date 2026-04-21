export type Route = 'home' | 'vote' | 'results' | 'admin' | 'profile'

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
  adminWallet?: string
}

export interface AuthUser {
  id: number
  name: string
  walletAddress: string | null
  role: 'user' | 'admin'
  emailVerified: boolean
  email?: string | null
  balance?: string | null
  isBanned?: boolean
}

export interface AdminUser {
  id: number
  name: string
  email: string | null
  phone: string | null
  walletAddress: string | null
  role: string
  isVerified: boolean
  emailVerified: boolean
  isBanned: boolean
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

export interface VoteResult {
  categoryId: number
  candidateId: number
  candidateName: string
  categoryTitle: string
  voteCount: number
}

export interface VoteRecord {
  id: number
  categoryId: number
  candidateId: number
  candidateName: string
  categoryTitle: string
  txHash: string | null
  votedAt: string
}

export interface Candidate {
  id: number
  name: string
  description: string | null
  image: string | null
  electionId: number
  onChainId: number | null
  isRemoved: boolean
}

export interface Election {
  id: number
  title: string
  description: string
  startTime: string | null
  endTime: string | null
  onChainId: number | null
  isActive: boolean
  createdAt: string
  candidates: Candidate[]
  pushedToChain?: boolean
}
