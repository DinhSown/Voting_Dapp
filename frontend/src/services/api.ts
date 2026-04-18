import axios from 'axios'
import { BACKEND_URL, ADMIN_API_KEY } from '../constants'
import type { HealthStatus, PaginatedResponse, AdminUser, AdminLog } from '../types'

const api = axios.create({ baseURL: BACKEND_URL })

export async function fetchHealth(): Promise<HealthStatus> {
  const res = await api.get<HealthStatus>('/health')
  return res.data
}

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

export async function fetchAdminUsers(
  page: number,
  limit: number
): Promise<PaginatedResponse<AdminUser>> {
  const res = await api.get<PaginatedResponse<AdminUser>>('/api/admin/users', {
    params: { page, limit },
    headers: { 'x-admin-key': ADMIN_API_KEY },
  })
  return res.data
}

export async function fetchAdminLogs(
  page: number,
  limit: number
): Promise<PaginatedResponse<AdminLog>> {
  const res = await api.get<PaginatedResponse<AdminLog>>('/api/admin/logs', {
    params: { page, limit },
    headers: { 'x-admin-key': ADMIN_API_KEY },
  })
  return res.data
}

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
