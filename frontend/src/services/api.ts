import axios from 'axios'
import { BACKEND_URL } from '../constants'
import type {
  HealthStatus,
  PaginatedResponse,
  AdminUser,
  AdminLog,
  AuthUser,
  Election,
  VoteRecord,
  VoteResult,
} from '../types'

const TOKEN_KEY = 'mechoice_token'

const api = axios.create({ baseURL: BACKEND_URL })

// Attach JWT to every request if present
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`
  }
  return config
})

// On 401, clear token (session expired)
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY)
    }
    return Promise.reject(err)
  }
)

// ─── Health ──────────────────────────────────────────────────────
export async function fetchHealth(): Promise<HealthStatus> {
  const res = await api.get<HealthStatus>('/health')
  return res.data
}

// ─── Auth — Wallet ───────────────────────────────────────────────
export async function getNonce(walletAddress: string): Promise<{ nonce: string }> {
  const res = await api.get<{ nonce: string }>('/api/auth/nonce', {
    params: { walletAddress },
  })
  return res.data
}

export async function walletAuth(
  walletAddress: string,
  signature: string,
  nonce: string
): Promise<{ requiresOtp: boolean; token?: string; tempToken?: string; user: AuthUser }> {
  const res = await api.post('/api/auth/wallet', { walletAddress, signature, nonce })
  return res.data
}

export async function logoutApi(token: string): Promise<void> {
  await api.post('/api/auth/logout', {}, { headers: { Authorization: `Bearer ${token}` } })
}

// ─── Auth — OTP (new wallet-based flow) ──────────────────────────
export async function sendEmailOtpNew(
  email: string,
  tempToken: string
): Promise<{ deliveryMode: 'smtp' | 'mock' }> {
  const res = await api.post<{ deliveryMode: 'smtp' | 'mock' }>('/api/auth/send-otp', { email, tempToken })
  return res.data
}

export async function verifyEmailOtpNew(
  email: string,
  otpCode: string,
  tempToken: string
): Promise<{ token: string; user: AuthUser }> {
  const res = await api.post('/api/auth/verify-otp', { email, otpCode, tempToken })
  return res.data
}

// ─── Auth — Legacy (phone OTP for backward compat) ───────────────
export async function sendEmailOtp(email: string): Promise<void> {
  await api.post('/api/auth/send-otp', { email })
}

export async function verifyEmailOtp(
  email: string,
  otpCode: string,
  walletAddress: string,
  electionId: number
): Promise<void> {
  await api.post('/api/auth/verify-otp', { email, otpCode, walletAddress, electionId })
}

export async function sendPhoneOtp(phone: string): Promise<void> {
  await api.post('/api/auth/send-phone-otp', { phone })
}

export async function verifyPhoneOtp(
  phone: string,
  otpCode: string,
  walletAddress: string,
  electionId: number
): Promise<void> {
  await api.post('/api/auth/verify-phone-otp', { phone, otpCode, walletAddress, electionId })
}

// ─── User Profile ────────────────────────────────────────────────
export async function getProfile(token: string): Promise<AuthUser> {
  const res = await api.get<AuthUser>('/api/user/profile', {
    headers: { Authorization: `Bearer ${token}` },
  })
  return res.data
}

export async function updateProfile(name: string): Promise<AuthUser> {
  const res = await api.patch<AuthUser>('/api/user/profile', { name })
  return res.data
}

// ─── User Votes ──────────────────────────────────────────────────
export async function recordVote(data: {
  categoryId: number
  candidateId: number
  candidateName: string
  categoryTitle: string
  txHash: string
}): Promise<void> {
  await api.post('/api/user/vote', data)
}

export async function fetchMyVotes(): Promise<VoteRecord[]> {
  const res = await api.get<VoteRecord[]>('/api/user/votes')
  return res.data
}

export async function fetchResults(): Promise<VoteResult[]> {
  const res = await api.get<VoteResult[]>('/api/results')
  return res.data
}

export async function fetchPublicElections(activeOnly = false): Promise<Election[]> {
  const res = await api.get<Election[]>('/api/elections', {
    params: activeOnly ? { active: 'true' } : undefined,
  })
  return res.data
}

// ─── Admin — Elections ───────────────────────────────────────────
export async function fetchAdminElections(): Promise<{ data: Election[]; total: number }> {
  const res = await api.get<{ data: Election[]; total: number }>('/api/admin/elections')
  return res.data
}

export async function createElection(data: {
  title: string
  description?: string
  startTime?: string
  endTime?: string
}): Promise<Election> {
  const res = await api.post<Election>('/api/admin/elections', data)
  return res.data
}

export async function updateElection(
  id: number,
  data: { description?: string; startTime?: string; endTime?: string }
): Promise<Election> {
  const res = await api.patch<Election>(`/api/admin/elections/${id}`, data)
  return res.data
}

export async function deleteElection(id: number): Promise<void> {
  await api.delete(`/api/admin/elections/${id}`)
}

export async function startElection(id: number): Promise<Election> {
  const res = await api.post<Election>(`/api/admin/elections/${id}/start`)
  return res.data
}

export async function pushElectionToChain(id: number): Promise<Election> {
  const res = await api.post<Election>(`/api/admin/elections/${id}/push-to-chain`)
  return res.data
}

export async function endElection(id: number): Promise<Election> {
  const res = await api.post<Election>(`/api/admin/elections/${id}/end`)
  return res.data
}

// ─── Admin — Candidates ──────────────────────────────────────────
export async function addCandidate(
  electionId: number,
  data: { name: string; description?: string; image?: string }
) {
  const res = await api.post(`/api/admin/elections/${electionId}/candidates`, data)
  return res.data
}

export async function removeCandidate(electionId: number, candidateId: number): Promise<void> {
  await api.delete(`/api/admin/elections/${electionId}/candidates/${candidateId}`)
}

// ─── Admin — Users ───────────────────────────────────────────────
export async function fetchAdminUsers(
  page: number,
  limit: number,
  search?: string
): Promise<PaginatedResponse<AdminUser>> {
  const res = await api.get<PaginatedResponse<AdminUser>>('/api/admin/users', {
    params: { page, limit, search },
  })
  return res.data
}

export async function banUser(id: number, isBanned: boolean): Promise<AdminUser> {
  const res = await api.patch<AdminUser>(`/api/admin/users/${id}`, { isBanned })
  return res.data
}

export async function fetchAdminLogs(
  page: number,
  limit: number
): Promise<PaginatedResponse<AdminLog>> {
  const res = await api.get<PaginatedResponse<AdminLog>>('/api/admin/logs', {
    params: { page, limit },
  })
  return res.data
}

// ─── Error helper ────────────────────────────────────────────────
export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (
    error &&
    typeof error === 'object' &&
    'response' in error &&
    error.response &&
    typeof error.response === 'object' &&
    'data' in error.response &&
    error.response.data &&
    typeof error.response.data === 'object' &&
    'error' in error.response.data
  ) {
    return String((error.response.data as { error: string }).error)
  }
  return fallback
}
