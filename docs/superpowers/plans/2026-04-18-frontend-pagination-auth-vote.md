# Frontend Pagination, Auth, Wallet & Vote Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the monolithic App.tsx into maintainable components and pages with wallet connect flow, Gmail OTP auth, paginated admin/user views, and a complete vote + sign transaction flow.

**Architecture:** Extract App.tsx (1035 lines) into typed services, custom hooks, reusable components, and dedicated pages. Hash-based routing shell stays in App.tsx (~80 lines). Backend gains two paginated admin endpoints (users, logs).

**Tech Stack:** React 19, TypeScript (strict), ethers.js v6, axios, Tailwind CSS v4, lucide-react, Vite

---

## Scope Check

This plan covers two subsystems that touch each other:
1. **Frontend refactor + new pages** (Tasks 1–9)
2. **Backend admin endpoints** (Task 10 — prerequisite for admin pagination)

Both must be completed for the admin page to work fully. Other pages are independent.

---

## File Map

### New / Modified Files

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `frontend/src/types/index.ts` | All shared TypeScript types |
| Create | `frontend/src/constants/index.ts` | CONTRACT_ADDRESS, BACKEND_URL, ABI, ELECTION_ID, chain config |
| Create | `frontend/src/services/api.ts` | All axios calls (sendOtp, verifyOtp, sendPhoneOtp, verifyPhoneOtp, fetchHealth, fetchUsers, fetchLogs) |
| Create | `frontend/src/services/wallet.ts` | ethers.js wallet connection, network switching |
| Create | `frontend/src/hooks/useWallet.ts` | Wallet state (address, chainId, loading, connect, disconnect) |
| Create | `frontend/src/hooks/useAuth.ts` | OTP auth state (step, mode, verifyMode, sendOtp, verifyOtp) |
| Create | `frontend/src/hooks/useVote.ts` | Vote state (voted set, castVote function) |
| Create | `frontend/src/components/Toast.tsx` | Toast notification display |
| Create | `frontend/src/components/Pagination.tsx` | Reusable prev/next/page number component |
| Create | `frontend/src/components/StatusBar.tsx` | 4-card status strip (wallet, auth, backend, network) |
| Create | `frontend/src/components/WalletConnect.tsx` | Full wallet connection panel with MetaMask steps |
| Create | `frontend/src/components/AuthFlow.tsx` | Email/phone OTP multi-step auth panel |
| Create | `frontend/src/pages/HomePage.tsx` | Landing page with hero, status, wallet + auth panels |
| Create | `frontend/src/pages/VotePage.tsx` | Category tabs, candidate grid, vote + sign flow |
| Create | `frontend/src/pages/ResultsPage.tsx` | Paginated results rankings per category |
| Create | `frontend/src/pages/AdminPage.tsx` | Paginated users table + logs table |
| Modify | `frontend/src/App.tsx` | Strip to ~80-line routing shell |
| Modify | `backend/index.ts` | Add GET /api/admin/users and GET /api/admin/logs |

---

## Task 1: Shared Types and Constants

**Files:**
- Create: `frontend/src/types/index.ts`
- Create: `frontend/src/constants/index.ts`

- [ ] **Step 1: Create types/index.ts**

```typescript
// frontend/src/types/index.ts

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
```

- [ ] **Step 2: Create constants/index.ts**

```typescript
// frontend/src/constants/index.ts

export const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'

export const CONTRACT_ADDRESS =
  import.meta.env.VITE_CONTRACT_ADDRESS ||
  '0x5FbDB2315678afecb367f032d93F642f64180aa3'

export const ELECTION_ID = 1

export const HARDHAT_CHAIN_ID = 31337

export const HARDHAT_RPC = 'http://127.0.0.1:8545'

export const CONTRACT_ABI = [
  'function vote(uint256 electionId, uint256 candidateId) external',
  'function getElection(uint256 electionId) external view returns (string memory name, bool isActive, uint256 candidateCount)',
  'function getCandidate(uint256 electionId, uint256 candidateId) external view returns (string memory name, uint256 voteCount)',
]

export const CATEGORIES = [
  {
    id: 1,
    title: 'Nhân vật truyền cảm hứng',
    description: 'Cá nhân có đóng góp tích cực cho cộng đồng blockchain Việt Nam',
    icon: '✨',
    nominees: [
      { id: 1, name: 'Nguyễn Văn A', description: 'Founder & CEO BlockchainVN', image: 'https://i.pravatar.cc/150?img=1' },
      { id: 2, name: 'Trần Thị B', description: 'Lead Developer DeFi Protocol', image: 'https://i.pravatar.cc/150?img=2' },
      { id: 3, name: 'Lê Văn C', description: 'Web3 Educator & Content Creator', image: 'https://i.pravatar.cc/150?img=3' },
    ],
  },
  {
    id: 2,
    title: 'Dự án vì Việt Nam tôi',
    description: 'Dự án blockchain có tác động xã hội tích cực nhất',
    icon: '🇻🇳',
    nominees: [
      { id: 4, name: 'VietChain', description: 'Nền tảng định danh phi tập trung', image: 'https://i.pravatar.cc/150?img=4' },
      { id: 5, name: 'FarmToken', description: 'Tokenize nông sản Việt Nam', image: 'https://i.pravatar.cc/150?img=5' },
      { id: 6, name: 'MedBlock', description: 'Hồ sơ y tế trên blockchain', image: 'https://i.pravatar.cc/150?img=6' },
    ],
  },
  {
    id: 3,
    title: 'Thế hệ Gen Z đổi mới',
    description: 'Gương mặt trẻ xuất sắc dưới 25 tuổi trong lĩnh vực Web3',
    icon: '🚀',
    nominees: [
      { id: 7, name: 'Phạm Minh D', description: 'NFT Artist & Smart Contract Dev', image: 'https://i.pravatar.cc/150?img=7' },
      { id: 8, name: 'Hoàng Thị E', description: 'DeFi Researcher & Writer', image: 'https://i.pravatar.cc/150?img=8' },
      { id: 9, name: 'Đỗ Văn F', description: 'DAO Governance Specialist', image: 'https://i.pravatar.cc/150?img=9' },
    ],
  },
  {
    id: 4,
    title: 'Rising Creator Web3',
    description: 'Content creator xuất sắc trong không gian Web3',
    icon: '🎬',
    nominees: [
      { id: 10, name: 'Vũ Thị G', description: 'YouTube: 100k subs về DeFi', image: 'https://i.pravatar.cc/150?img=10' },
      { id: 11, name: 'Ngô Văn H', description: 'TikTok NFT educator', image: 'https://i.pravatar.cc/150?img=11' },
      { id: 12, name: 'Bùi Thị I', description: 'Podcast Host - Web3 Weekly', image: 'https://i.pravatar.cc/150?img=12' },
    ],
  },
]
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/constants/index.ts
git commit -m "feat: add shared types and constants"
```

---

## Task 2: API Service Layer

**Files:**
- Create: `frontend/src/services/api.ts`

- [ ] **Step 1: Create services/api.ts**

```typescript
// frontend/src/services/api.ts

import axios from 'axios'
import { BACKEND_URL } from '../constants'
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
  })
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
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/services/api.ts
git commit -m "feat: add API service layer"
```

---

## Task 3: Wallet Service and useWallet Hook

**Files:**
- Create: `frontend/src/services/wallet.ts`
- Create: `frontend/src/hooks/useWallet.ts`

- [ ] **Step 1: Create services/wallet.ts**

```typescript
// frontend/src/services/wallet.ts

import { ethers } from 'ethers'
import { HARDHAT_CHAIN_ID, HARDHAT_RPC, CONTRACT_ADDRESS, CONTRACT_ABI } from '../constants'

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
      on: (event: string, handler: (...args: unknown[]) => void) => void
      removeListener: (event: string, handler: (...args: unknown[]) => void) => void
    }
  }
}

export async function requestAccounts(): Promise<string[]> {
  if (!window.ethereum) throw new Error('MetaMask not installed')
  const accounts = (await window.ethereum.request({ method: 'eth_requestAccounts' })) as string[]
  return accounts
}

export async function getChainId(): Promise<number> {
  if (!window.ethereum) throw new Error('MetaMask not installed')
  const chainId = (await window.ethereum.request({ method: 'eth_chainId' })) as string
  return parseInt(chainId, 16)
}

export async function switchToHardhat(): Promise<void> {
  if (!window.ethereum) throw new Error('MetaMask not installed')
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: `0x${HARDHAT_CHAIN_ID.toString(16)}` }],
    })
  } catch (err) {
    // Error code 4902: chain not added yet
    if (err && typeof err === 'object' && 'code' in err && err.code === 4902) {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: `0x${HARDHAT_CHAIN_ID.toString(16)}`,
            chainName: 'Hardhat Local',
            rpcUrls: [HARDHAT_RPC],
            nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
          },
        ],
      })
    } else {
      throw err
    }
  }
}

export async function castVoteOnChain(candidateId: number, electionId: number): Promise<string> {
  if (!window.ethereum) throw new Error('MetaMask not installed')
  const provider = new ethers.BrowserProvider(window.ethereum)
  const signer = await provider.getSigner()
  const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer)
  const tx = await contract.vote(electionId, candidateId)
  await tx.wait()
  return tx.hash as string
}

export function onAccountsChanged(handler: (accounts: string[]) => void): () => void {
  if (!window.ethereum) return () => {}
  const listener = (...args: unknown[]) => handler(args[0] as string[])
  window.ethereum.on('accountsChanged', listener)
  return () => window.ethereum?.removeListener('accountsChanged', listener)
}

export function onChainChanged(handler: (chainId: number) => void): () => void {
  if (!window.ethereum) return () => {}
  const listener = (...args: unknown[]) => handler(parseInt(args[0] as string, 16))
  window.ethereum.on('chainChanged', listener)
  return () => window.ethereum?.removeListener('chainChanged', listener)
}
```

- [ ] **Step 2: Create hooks/useWallet.ts**

```typescript
// frontend/src/hooks/useWallet.ts

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
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/services/wallet.ts frontend/src/hooks/useWallet.ts
git commit -m "feat: add wallet service and useWallet hook"
```

---

## Task 4: useAuth and useVote Hooks

**Files:**
- Create: `frontend/src/hooks/useAuth.ts`
- Create: `frontend/src/hooks/useVote.ts`

- [ ] **Step 1: Create hooks/useAuth.ts**

```typescript
// frontend/src/hooks/useAuth.ts

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
  sendOtp: (walletAddress: string) => Promise<void>
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
    async (_walletAddress: string) => {
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
```

- [ ] **Step 2: Create hooks/useVote.ts**

```typescript
// frontend/src/hooks/useVote.ts

import { useState, useCallback } from 'react'
import { castVoteOnChain } from '../services/wallet'
import { ELECTION_ID } from '../constants'

export interface VoteState {
  voted: Set<number>        // category IDs already voted
  votingFor: number | null  // candidateId currently being voted
  castVote: (candidateId: number, categoryId: number) => Promise<string>
}

export function useVote(): VoteState {
  const [voted, setVoted] = useState<Set<number>>(new Set())
  const [votingFor, setVotingFor] = useState<number | null>(null)

  const castVote = useCallback(
    async (candidateId: number, categoryId: number): Promise<string> => {
      setVotingFor(candidateId)
      try {
        const txHash = await castVoteOnChain(candidateId, ELECTION_ID)
        setVoted((prev) => new Set([...prev, categoryId]))
        return txHash
      } finally {
        setVotingFor(null)
      }
    },
    []
  )

  return { voted, votingFor, castVote }
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/useAuth.ts frontend/src/hooks/useVote.ts
git commit -m "feat: add useAuth and useVote hooks"
```

---

## Task 5: Reusable UI Components

**Files:**
- Create: `frontend/src/components/Toast.tsx`
- Create: `frontend/src/components/Pagination.tsx`
- Create: `frontend/src/components/StatusBar.tsx`

- [ ] **Step 1: Create components/Toast.tsx**

```tsx
// frontend/src/components/Toast.tsx

import type { Toast as ToastType } from '../types'

interface Props {
  toast: ToastType | null
}

const colorMap = {
  success: 'bg-green-500/20 border-green-500/40 text-green-300',
  error: 'bg-red-500/20 border-red-500/40 text-red-300',
  info: 'bg-blue-500/20 border-blue-500/40 text-blue-300',
}

export function Toast({ toast }: Props) {
  if (!toast) return null
  return (
    <div
      className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl border backdrop-blur-md text-sm font-medium shadow-lg transition-all ${colorMap[toast.type]}`}
    >
      {toast.message}
    </div>
  )
}
```

- [ ] **Step 2: Create components/Pagination.tsx**

```tsx
// frontend/src/components/Pagination.tsx

import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  page: number
  total: number
  limit: number
  onPageChange: (page: number) => void
}

export function Pagination({ page, total, limit, onPageChange }: Props) {
  const totalPages = Math.ceil(total / limit)
  if (totalPages <= 1) return null

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)

  return (
    <div className="flex items-center gap-2 justify-center mt-4">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        className="p-1.5 rounded-lg border border-white/10 text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        aria-label="Previous page"
      >
        <ChevronLeft size={16} />
      </button>

      {pages.map((p) => (
        <button
          key={p}
          onClick={() => onPageChange(p)}
          className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${
            p === page
              ? 'bg-[#f2ca50] text-black'
              : 'border border-white/10 text-white/60 hover:text-white hover:bg-white/10'
          }`}
        >
          {p}
        </button>
      ))}

      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page === totalPages}
        className="p-1.5 rounded-lg border border-white/10 text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        aria-label="Next page"
      >
        <ChevronRight size={16} />
      </button>

      <span className="text-xs text-white/40 ml-2">
        {page} / {totalPages} ({total} mục)
      </span>
    </div>
  )
}
```

- [ ] **Step 3: Create components/StatusBar.tsx**

```tsx
// frontend/src/components/StatusBar.tsx

import { Wallet, Mail, Cpu, Blocks } from 'lucide-react'
import type { HealthStatus } from '../types'
import { HARDHAT_CHAIN_ID } from '../constants'

interface Props {
  walletAddress: string
  chainId: number
  authVerified: boolean
  health: HealthStatus | null
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${ok ? 'bg-green-400' : 'bg-red-400'}`}
    />
  )
}

export function StatusBar({ walletAddress, chainId, authVerified, health }: Props) {
  const isCorrectNetwork = chainId === HARDHAT_CHAIN_ID

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {/* Wallet */}
      <div className="panel p-3 flex items-center gap-2">
        <Wallet size={16} className="text-[#f2ca50]" />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-white/40">Ví</p>
          <p className="text-xs font-mono text-white truncate">
            {walletAddress
              ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
              : 'Chưa kết nối'}
          </p>
        </div>
        <StatusDot ok={!!walletAddress} />
      </div>

      {/* Auth */}
      <div className="panel p-3 flex items-center gap-2">
        <Mail size={16} className="text-[#a2e7ff]" />
        <div className="flex-1">
          <p className="text-xs text-white/40">Xác minh</p>
          <p className="text-xs text-white">{authVerified ? 'Đã xác minh' : 'Chưa xác minh'}</p>
        </div>
        <StatusDot ok={authVerified} />
      </div>

      {/* Backend */}
      <div className="panel p-3 flex items-center gap-2">
        <Cpu size={16} className="text-purple-400" />
        <div className="flex-1">
          <p className="text-xs text-white/40">Backend</p>
          <p className="text-xs text-white">
            {health?.status === 'ok' ? 'Online' : 'Offline'}
          </p>
        </div>
        <StatusDot ok={health?.status === 'ok'} />
      </div>

      {/* Network */}
      <div className="panel p-3 flex items-center gap-2">
        <Blocks size={16} className="text-orange-400" />
        <div className="flex-1">
          <p className="text-xs text-white/40">Mạng</p>
          <p className="text-xs text-white">
            {isCorrectNetwork ? 'Hardhat Local' : chainId ? `Chain ${chainId}` : 'Chưa kết nối'}
          </p>
        </div>
        <StatusDot ok={isCorrectNetwork} />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/Toast.tsx frontend/src/components/Pagination.tsx frontend/src/components/StatusBar.tsx
git commit -m "feat: add Toast, Pagination, StatusBar components"
```

---

## Task 6: WalletConnect Component

**Files:**
- Create: `frontend/src/components/WalletConnect.tsx`

- [ ] **Step 1: Create components/WalletConnect.tsx**

```tsx
// frontend/src/components/WalletConnect.tsx

import { Wallet, AlertCircle, CheckCircle, Loader, RefreshCw } from 'lucide-react'
import { HARDHAT_CHAIN_ID } from '../constants'

interface Props {
  address: string
  chainId: number
  loading: boolean
  error: string
  onConnect: () => void
  onSwitchNetwork: () => void
}

function Step({
  num,
  done,
  active,
  title,
  desc,
}: {
  num: number
  done: boolean
  active: boolean
  title: string
  desc: string
}) {
  return (
    <div className={`flex items-start gap-3 p-3 rounded-xl transition-all ${active ? 'bg-white/5' : ''}`}>
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
          done
            ? 'bg-green-500/20 text-green-400 border border-green-500/40'
            : active
            ? 'bg-[#f2ca50]/20 text-[#f2ca50] border border-[#f2ca50]/40'
            : 'bg-white/5 text-white/30 border border-white/10'
        }`}
      >
        {done ? <CheckCircle size={14} /> : num}
      </div>
      <div>
        <p className={`text-sm font-medium ${done ? 'text-white/50 line-through' : active ? 'text-white' : 'text-white/30'}`}>
          {title}
        </p>
        <p className="text-xs text-white/30 mt-0.5">{desc}</p>
      </div>
    </div>
  )
}

export function WalletConnect({ address, chainId, loading, error, onConnect, onSwitchNetwork }: Props) {
  const isConnected = !!address
  const isCorrectNetwork = chainId === HARDHAT_CHAIN_ID

  if (isConnected && isCorrectNetwork) {
    return (
      <div className="panel p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
            <CheckCircle size={20} className="text-green-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">Ví đã kết nối</p>
            <p className="text-xs font-mono text-white/50">
              {address.slice(0, 10)}...{address.slice(-8)}
            </p>
          </div>
          <div className="ml-auto">
            <span className="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
              Hardhat Local
            </span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="panel p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Wallet size={18} className="text-[#f2ca50]" />
        <h3 className="text-sm font-semibold text-white">Kết nối ví</h3>
      </div>

      <div className="space-y-1">
        <Step
          num={1}
          done={isConnected}
          active={!isConnected}
          title="Cài MetaMask"
          desc="Tiện ích mở rộng trình duyệt ví Web3"
        />
        <Step
          num={2}
          done={isConnected}
          active={!isConnected}
          title="Kết nối ví"
          desc="Cho phép trang web truy cập địa chỉ ví"
        />
        <Step
          num={3}
          done={isConnected && isCorrectNetwork}
          active={isConnected && !isCorrectNetwork}
          title="Chuyển sang Hardhat Local"
          desc="Mạng blockchain cục bộ cho bầu cử"
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
          <AlertCircle size={14} className="text-red-400 mt-0.5 shrink-0" />
          <p className="text-xs text-red-300">{error}</p>
        </div>
      )}

      {!isConnected ? (
        <button
          onClick={onConnect}
          disabled={loading}
          className="w-full py-2.5 px-4 rounded-xl bg-[#f2ca50] text-black font-semibold text-sm hover:bg-[#f2ca50]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
        >
          {loading ? <Loader size={16} className="animate-spin" /> : <Wallet size={16} />}
          {loading ? 'Đang kết nối...' : 'Kết nối MetaMask'}
        </button>
      ) : (
        <button
          onClick={onSwitchNetwork}
          disabled={loading}
          className="w-full py-2.5 px-4 rounded-xl bg-orange-500/20 text-orange-300 border border-orange-500/30 font-semibold text-sm hover:bg-orange-500/30 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
        >
          {loading ? <Loader size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          {loading ? 'Đang chuyển mạng...' : 'Chuyển sang Hardhat Local'}
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/WalletConnect.tsx
git commit -m "feat: add WalletConnect component with step-by-step flow"
```

---

## Task 7: AuthFlow Component

**Files:**
- Create: `frontend/src/components/AuthFlow.tsx`

- [ ] **Step 1: Create components/AuthFlow.tsx**

```tsx
// frontend/src/components/AuthFlow.tsx

import { Mail, Phone, CheckCircle, Loader, AlertCircle } from 'lucide-react'
import type { AuthState } from '../hooks/useAuth'

interface Props {
  auth: AuthState
  walletAddress: string
}

export function AuthFlow({ auth, walletAddress }: Props) {
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

      {/* Mode toggle */}
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

      {/* Step: IDLE — input field */}
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
            onClick={() => sendOtp(walletAddress)}
            disabled={loading || (verifyMode === 'email' ? !email : !phone)}
            className="w-full py-2.5 px-4 rounded-xl bg-[#a2e7ff]/20 text-[#a2e7ff] border border-[#a2e7ff]/30 font-semibold text-sm hover:bg-[#a2e7ff]/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {loading ? <Loader size={16} className="animate-spin" /> : null}
            {loading ? 'Đang gửi...' : 'Gửi mã OTP'}
          </button>
        </>
      )}

      {/* Step: OTP_SENT — otp input */}
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
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/AuthFlow.tsx
git commit -m "feat: add AuthFlow component with email/phone OTP steps"
```

---

## Task 8: Vote Page

**Files:**
- Create: `frontend/src/pages/VotePage.tsx`

- [ ] **Step 1: Create pages/VotePage.tsx**

```tsx
// frontend/src/pages/VotePage.tsx

import { useState } from 'react'
import { CheckCircle, Loader, Lock, AlertTriangle } from 'lucide-react'
import { CATEGORIES } from '../constants'
import type { WalletState } from '../hooks/useWallet'
import type { VoteState } from '../hooks/useVote'
import type { AuthStep } from '../types'

interface Props {
  wallet: WalletState
  vote: VoteState
  authStep: AuthStep
  onToast: (msg: string, type: 'success' | 'error' | 'info') => void
}

export function VotePage({ wallet, vote, authStep, onToast }: Props) {
  const [selectedCategory, setSelectedCategory] = useState(0)
  const [selectedCandidate, setSelectedCandidate] = useState<number | null>(null)
  const isEligible = !!wallet.address && wallet.isCorrectNetwork && authStep === 'VERIFIED'
  const category = CATEGORIES[selectedCategory]
  const hasVotedThisCategory = vote.voted.has(category.id)

  async function handleVote() {
    if (!selectedCandidate) return
    try {
      const txHash = await vote.castVote(selectedCandidate, category.id)
      onToast(`Bỏ phiếu thành công! TX: ${txHash.slice(0, 10)}...`, 'success')
      setSelectedCandidate(null)
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Bỏ phiếu thất bại', 'error')
    }
  }

  return (
    <div className="space-y-6">
      {!isEligible && (
        <div className="panel p-4 flex items-start gap-3 border-amber-500/30 bg-amber-500/10">
          <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-300">Yêu cầu để bỏ phiếu</p>
            <ul className="text-xs text-amber-300/70 mt-1 space-y-0.5 list-disc list-inside">
              {!wallet.address && <li>Kết nối ví MetaMask</li>}
              {wallet.address && !wallet.isCorrectNetwork && <li>Chuyển sang mạng Hardhat Local</li>}
              {authStep !== 'VERIFIED' && <li>Xác minh email hoặc số điện thoại</li>}
            </ul>
          </div>
        </div>
      )}

      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {CATEGORIES.map((cat, idx) => (
          <button
            key={cat.id}
            onClick={() => { setSelectedCategory(idx); setSelectedCandidate(null) }}
            className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium border transition-all flex items-center gap-2 ${
              idx === selectedCategory
                ? 'bg-[#f2ca50]/20 border-[#f2ca50]/40 text-[#f2ca50]'
                : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'
            }`}
          >
            <span>{cat.icon}</span>
            <span className="hidden sm:inline">{cat.title}</span>
            {vote.voted.has(cat.id) && <CheckCircle size={12} className="text-green-400" />}
          </button>
        ))}
      </div>

      {/* Category header */}
      <div className="panel p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white">
              {category.icon} {category.title}
            </h2>
            <p className="text-sm text-white/50 mt-1">{category.description}</p>
          </div>
          {hasVotedThisCategory && (
            <span className="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-400 border border-green-500/30 shrink-0">
              Đã bỏ phiếu
            </span>
          )}
        </div>
      </div>

      {/* Candidates grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {category.nominees.map((nominee) => {
          const isSelected = selectedCandidate === nominee.id
          const isVoting = vote.votingFor === nominee.id
          return (
            <button
              key={nominee.id}
              onClick={() => !hasVotedThisCategory && isEligible && setSelectedCandidate(isSelected ? null : nominee.id)}
              disabled={hasVotedThisCategory || !isEligible}
              className={`panel p-4 text-left transition-all group ${
                isSelected
                  ? 'border-[#f2ca50]/50 bg-[#f2ca50]/5'
                  : hasVotedThisCategory || !isEligible
                  ? 'opacity-60 cursor-not-allowed'
                  : 'hover:border-white/20 hover:bg-white/5 cursor-pointer'
              }`}
            >
              <div className="flex items-start gap-3">
                <img
                  src={nominee.image}
                  alt={nominee.name}
                  className="w-12 h-12 rounded-full object-cover shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{nominee.name}</p>
                  <p className="text-xs text-white/50 mt-0.5 line-clamp-2">{nominee.description}</p>
                </div>
                {isSelected && (
                  <CheckCircle size={18} className="text-[#f2ca50] shrink-0" />
                )}
                {isVoting && (
                  <Loader size={18} className="text-[#f2ca50] shrink-0 animate-spin" />
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Vote button */}
      {isEligible && !hasVotedThisCategory && (
        <div className="flex items-center gap-3">
          <button
            onClick={handleVote}
            disabled={!selectedCandidate || vote.votingFor !== null}
            className="flex-1 py-3 px-6 rounded-xl bg-[#f2ca50] text-black font-bold text-sm hover:bg-[#f2ca50]/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {vote.votingFor !== null ? (
              <>
                <Loader size={16} className="animate-spin" />
                Đang ký giao dịch...
              </>
            ) : (
              <>
                <CheckCircle size={16} />
                Bỏ phiếu {selectedCandidate ? `cho ${category.nominees.find(n => n.id === selectedCandidate)?.name}` : '(chọn ứng viên)'}
              </>
            )}
          </button>
          {!isEligible && (
            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
              <Lock size={16} className="text-white/30" />
            </div>
          )}
        </div>
      )}

      {vote.votingFor !== null && (
        <div className="panel p-4 border-blue-500/30 bg-blue-500/10">
          <p className="text-sm text-blue-300 flex items-center gap-2">
            <Loader size={14} className="animate-spin" />
            MetaMask đang yêu cầu xác nhận giao dịch. Vui lòng kiểm tra ví của bạn...
          </p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/VotePage.tsx
git commit -m "feat: add VotePage with category tabs, candidate grid, and sign flow"
```

---

## Task 9: Results Page with Pagination

**Files:**
- Create: `frontend/src/pages/ResultsPage.tsx`

- [ ] **Step 1: Create pages/ResultsPage.tsx**

```tsx
// frontend/src/pages/ResultsPage.tsx

import { useState } from 'react'
import { Trophy, ChevronRight } from 'lucide-react'
import { Pagination } from '../components/Pagination'
import { CATEGORIES } from '../constants'

interface CandidateResult {
  id: number
  name: string
  image: string
  votes: number
  rank: number
}

interface Props {
  onNavigate: (route: string) => void
}

const ITEMS_PER_PAGE = 3

// Mock results — replace with contract reads
function getMockResults(categoryId: number): CandidateResult[] {
  const category = CATEGORIES.find((c) => c.id === categoryId)
  if (!category) return []
  return category.nominees
    .map((n, i) => ({
      id: n.id,
      name: n.name,
      image: n.image,
      votes: Math.floor(Math.random() * 100) + (3 - i) * 50,
      rank: 0,
    }))
    .sort((a, b) => b.votes - a.votes)
    .map((r, i) => ({ ...r, rank: i + 1 }))
}

const RANK_COLORS = ['text-yellow-400', 'text-gray-300', 'text-amber-600']
const RANK_BG = ['bg-yellow-400/10 border-yellow-400/30', 'bg-gray-400/10 border-gray-400/30', 'bg-amber-600/10 border-amber-600/30']

export function ResultsPage({ onNavigate }: Props) {
  const [selectedCategory, setSelectedCategory] = useState(0)
  const [page, setPage] = useState(1)

  const category = CATEGORIES[selectedCategory]
  const allResults = getMockResults(category.id)
  const totalItems = allResults.length
  const paginatedResults = allResults.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)

  function handleCategoryChange(idx: number) {
    setSelectedCategory(idx)
    setPage(1)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy size={20} className="text-[#f2ca50]" />
          <h2 className="text-lg font-bold text-white">Kết quả bầu cử</h2>
        </div>
        <button
          onClick={() => onNavigate('vote')}
          className="text-xs text-white/50 hover:text-white transition-colors flex items-center gap-1"
        >
          Bỏ phiếu <ChevronRight size={12} />
        </button>
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {CATEGORIES.map((cat, idx) => (
          <button
            key={cat.id}
            onClick={() => handleCategoryChange(idx)}
            className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
              idx === selectedCategory
                ? 'bg-[#f2ca50]/20 border-[#f2ca50]/40 text-[#f2ca50]'
                : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
            }`}
          >
            {cat.icon} <span className="hidden sm:inline ml-1">{cat.title}</span>
          </button>
        ))}
      </div>

      {/* Results list */}
      <div className="space-y-3">
        {paginatedResults.map((result) => {
          const rankIdx = result.rank - 1
          const isTopThree = result.rank <= 3
          return (
            <div
              key={result.id}
              className={`panel p-4 flex items-center gap-4 ${isTopThree ? RANK_BG[rankIdx] : ''}`}
            >
              {/* Rank */}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                  isTopThree ? RANK_COLORS[rankIdx] : 'text-white/30'
                }`}
              >
                {result.rank <= 3 ? (
                  <Trophy size={16} />
                ) : (
                  result.rank
                )}
              </div>

              {/* Avatar */}
              <img
                src={result.image}
                alt={result.name}
                className="w-10 h-10 rounded-full object-cover shrink-0"
              />

              {/* Name */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${isTopThree ? RANK_COLORS[rankIdx] : 'text-white'}`}>
                  {result.name}
                </p>
                <p className="text-xs text-white/40 mt-0.5">Hạng #{result.rank}</p>
              </div>

              {/* Vote bar */}
              <div className="text-right shrink-0">
                <p className={`text-sm font-bold ${isTopThree ? RANK_COLORS[rankIdx] : 'text-white'}`}>
                  {result.votes}
                </p>
                <p className="text-xs text-white/40">phiếu</p>
              </div>
            </div>
          )
        })}
      </div>

      <Pagination
        page={page}
        total={totalItems}
        limit={ITEMS_PER_PAGE}
        onPageChange={setPage}
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/ResultsPage.tsx
git commit -m "feat: add ResultsPage with paginated rankings per category"
```

---

## Task 10: Backend Admin Endpoints

**Files:**
- Modify: `backend/index.ts`

- [ ] **Step 1: Add paginated users and logs endpoints**

Open `backend/index.ts`. After the existing `/health` route, add:

```typescript
// GET /api/admin/users?page=1&limit=10
app.get('/api/admin/users', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10))
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? '10'), 10)))
    const skip = (page - 1) * limit

    const [data, total] = await Promise.all([
      prisma.user.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count(),
    ])

    res.json({ data, total, page, limit })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch users' })
  }
})

// GET /api/admin/logs?page=1&limit=10
app.get('/api/admin/logs', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10))
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? '10'), 10)))
    const skip = (page - 1) * limit

    const [data, total] = await Promise.all([
      prisma.log.findMany({
        skip,
        take: limit,
        orderBy: { timestamp: 'desc' },
      }),
      prisma.log.count(),
    ])

    res.json({ data, total, page, limit })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch logs' })
  }
})
```

- [ ] **Step 2: Restart backend and verify endpoints**

```bash
# Test users endpoint
curl "http://localhost:3001/api/admin/users?page=1&limit=5"
# Expected: { "data": [...], "total": N, "page": 1, "limit": 5 }

# Test logs endpoint
curl "http://localhost:3001/api/admin/logs?page=1&limit=5"
# Expected: { "data": [...], "total": N, "page": 1, "limit": 5 }
```

- [ ] **Step 3: Commit**

```bash
git add backend/index.ts
git commit -m "feat: add paginated GET /api/admin/users and /api/admin/logs endpoints"
```

---

## Task 11: Admin Page with Pagination

**Files:**
- Create: `frontend/src/pages/AdminPage.tsx`

- [ ] **Step 1: Create pages/AdminPage.tsx**

```tsx
// frontend/src/pages/AdminPage.tsx

import { useState, useEffect } from 'react'
import { Users, ScrollText, RefreshCw, Loader } from 'lucide-react'
import { Pagination } from '../components/Pagination'
import { fetchAdminUsers, fetchAdminLogs } from '../services/api'
import type { AdminUser, AdminLog, PaginatedResponse } from '../types'

const PAGE_SIZE = 8

type AdminTab = 'users' | 'logs'

export function AdminPage() {
  const [tab, setTab] = useState<AdminTab>('users')

  // Users state
  const [users, setUsers] = useState<PaginatedResponse<AdminUser> | null>(null)
  const [usersPage, setUsersPage] = useState(1)
  const [usersLoading, setUsersLoading] = useState(false)
  const [usersError, setUsersError] = useState('')

  // Logs state
  const [logs, setLogs] = useState<PaginatedResponse<AdminLog> | null>(null)
  const [logsPage, setLogsPage] = useState(1)
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsError, setLogsError] = useState('')

  useEffect(() => {
    if (tab !== 'users') return
    setUsersLoading(true)
    setUsersError('')
    fetchAdminUsers(usersPage, PAGE_SIZE)
      .then(setUsers)
      .catch(() => setUsersError('Không thể tải danh sách người dùng'))
      .finally(() => setUsersLoading(false))
  }, [tab, usersPage])

  useEffect(() => {
    if (tab !== 'logs') return
    setLogsLoading(true)
    setLogsError('')
    fetchAdminLogs(logsPage, PAGE_SIZE)
      .then(setLogs)
      .catch(() => setLogsError('Không thể tải nhật ký'))
      .finally(() => setLogsLoading(false))
  }, [tab, logsPage])

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Quản trị viên</h2>
        <button
          onClick={() => { if (tab === 'users') setUsersPage(1); else setLogsPage(1) }}
          className="p-2 rounded-xl border border-white/10 text-white/50 hover:text-white hover:bg-white/5 transition-all"
          aria-label="Làm mới"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab('users')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
            tab === 'users'
              ? 'bg-[#f2ca50]/20 border-[#f2ca50]/40 text-[#f2ca50]'
              : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
          }`}
        >
          <Users size={14} /> Người dùng
          {users && (
            <span className="ml-1 text-xs bg-white/10 px-1.5 py-0.5 rounded-full">
              {users.total}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('logs')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
            tab === 'logs'
              ? 'bg-[#f2ca50]/20 border-[#f2ca50]/40 text-[#f2ca50]'
              : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
          }`}
        >
          <ScrollText size={14} /> Nhật ký
          {logs && (
            <span className="ml-1 text-xs bg-white/10 px-1.5 py-0.5 rounded-full">
              {logs.total}
            </span>
          )}
        </button>
      </div>

      {/* Users Table */}
      {tab === 'users' && (
        <div className="panel overflow-hidden">
          {usersLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader size={20} className="animate-spin text-white/40" />
            </div>
          ) : usersError ? (
            <p className="text-sm text-red-400 p-4">{usersError}</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left px-4 py-3 text-xs text-white/40 font-medium">ID</th>
                      <th className="text-left px-4 py-3 text-xs text-white/40 font-medium">Email</th>
                      <th className="text-left px-4 py-3 text-xs text-white/40 font-medium">Số điện thoại</th>
                      <th className="text-left px-4 py-3 text-xs text-white/40 font-medium">Ví</th>
                      <th className="text-left px-4 py-3 text-xs text-white/40 font-medium">Trạng thái</th>
                      <th className="text-left px-4 py-3 text-xs text-white/40 font-medium">Ngày tạo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users?.data.map((user) => (
                      <tr key={user.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                        <td className="px-4 py-3 text-white/40">{user.id}</td>
                        <td className="px-4 py-3 text-white/80">{user.email ?? '—'}</td>
                        <td className="px-4 py-3 text-white/80">{user.phone ?? '—'}</td>
                        <td className="px-4 py-3 font-mono text-xs text-white/60">
                          {user.walletAddress
                            ? `${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-4)}`
                            : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              user.isVerified
                                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                : 'bg-white/10 text-white/40 border border-white/10'
                            }`}
                          >
                            {user.isVerified ? 'Đã xác minh' : 'Chưa xác minh'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-white/40">{formatDate(user.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-4 border-t border-white/10">
                <Pagination
                  page={usersPage}
                  total={users?.total ?? 0}
                  limit={PAGE_SIZE}
                  onPageChange={setUsersPage}
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* Logs Table */}
      {tab === 'logs' && (
        <div className="panel overflow-hidden">
          {logsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader size={20} className="animate-spin text-white/40" />
            </div>
          ) : logsError ? (
            <p className="text-sm text-red-400 p-4">{logsError}</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left px-4 py-3 text-xs text-white/40 font-medium">Thời gian</th>
                      <th className="text-left px-4 py-3 text-xs text-white/40 font-medium">Hành động</th>
                      <th className="text-left px-4 py-3 text-xs text-white/40 font-medium">Mô tả</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs?.data.map((log) => (
                      <tr key={log.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                        <td className="px-4 py-3 text-xs text-white/40 whitespace-nowrap">
                          {formatDate(log.timestamp)}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-mono">
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-white/60">{log.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-4 border-t border-white/10">
                <Pagination
                  page={logsPage}
                  total={logs?.total ?? 0}
                  limit={PAGE_SIZE}
                  onPageChange={setLogsPage}
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/AdminPage.tsx
git commit -m "feat: add AdminPage with paginated users and logs tables"
```

---

## Task 12: HomePage

**Files:**
- Create: `frontend/src/pages/HomePage.tsx`

- [ ] **Step 1: Create pages/HomePage.tsx**

```tsx
// frontend/src/pages/HomePage.tsx

import { WalletConnect } from '../components/WalletConnect'
import { AuthFlow } from '../components/AuthFlow'
import { StatusBar } from '../components/StatusBar'
import type { WalletState } from '../hooks/useWallet'
import type { AuthState } from '../hooks/useAuth'
import type { HealthStatus } from '../types'

interface Props {
  wallet: WalletState
  auth: AuthState
  health: HealthStatus | null
  onNavigate: (route: string) => void
}

export function HomePage({ wallet, auth, health, onNavigate }: Props) {
  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="panel-glow p-8 text-center space-y-3">
        <p className="text-xs text-[#f2ca50] uppercase tracking-widest font-label">
          Vietnam Blockchain Week 2025
        </p>
        <h1 className="text-4xl md:text-5xl font-headline font-bold text-white leading-tight">
          Bình chọn <br />
          <span className="text-[#f2ca50]">Web3 Awards</span>
        </h1>
        <p className="text-white/50 text-sm max-w-md mx-auto">
          Bình chọn cho các cá nhân và dự án xuất sắc nhất trong hệ sinh thái blockchain Việt Nam
        </p>
        <div className="flex flex-wrap gap-3 justify-center pt-2">
          <button
            onClick={() => onNavigate('vote')}
            className="px-6 py-2.5 rounded-xl bg-[#f2ca50] text-black font-semibold text-sm hover:bg-[#f2ca50]/90 transition-all"
          >
            Bỏ phiếu ngay
          </button>
          <button
            onClick={() => onNavigate('results')}
            className="px-6 py-2.5 rounded-xl border border-white/20 text-white/80 font-semibold text-sm hover:bg-white/5 transition-all"
          >
            Xem kết quả
          </button>
        </div>
      </div>

      {/* Status */}
      <StatusBar
        walletAddress={wallet.address}
        chainId={wallet.chainId}
        authVerified={auth.step === 'VERIFIED'}
        health={health}
      />

      {/* Wallet + Auth panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <WalletConnect
          address={wallet.address}
          chainId={wallet.chainId}
          loading={wallet.loading}
          error={wallet.error}
          onConnect={wallet.connect}
          onSwitchNetwork={wallet.switchNetwork}
        />
        <AuthFlow auth={auth} walletAddress={wallet.address} />
      </div>

      {/* Quick nav */}
      {wallet.address && auth.step === 'VERIFIED' && (
        <div className="panel p-4 flex items-center justify-between">
          <p className="text-sm text-white/70">
            Sẵn sàng bỏ phiếu! 4 hạng mục đang chờ bạn.
          </p>
          <button
            onClick={() => onNavigate('vote')}
            className="px-4 py-2 rounded-xl bg-[#f2ca50] text-black font-semibold text-xs hover:bg-[#f2ca50]/90 transition-all"
          >
            Bắt đầu →
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/HomePage.tsx
git commit -m "feat: add HomePage with hero, status bar, wallet and auth panels"
```

---

## Task 13: Refactor App.tsx to Routing Shell

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Replace App.tsx with slim routing shell**

The new App.tsx owns shared state (wallet, auth, vote, toast, health) and renders the correct page. This replaces the current 1035-line file.

```tsx
// frontend/src/App.tsx

import { useState, useEffect, useCallback } from 'react'
import { useWallet } from './hooks/useWallet'
import { useAuth } from './hooks/useAuth'
import { useVote } from './hooks/useVote'
import { fetchHealth } from './services/api'
import { Toast } from './components/Toast'
import { HomePage } from './pages/HomePage'
import { VotePage } from './pages/VotePage'
import { ResultsPage } from './pages/ResultsPage'
import { AdminPage } from './pages/AdminPage'
import type { Route, Toast as ToastType, HealthStatus } from './types'

function getRouteFromHash(): Route {
  const hash = window.location.hash.replace('#', '')
  if (hash === 'vote') return 'vote'
  if (hash === 'results') return 'results'
  if (hash === 'admin') return 'admin'
  return 'home'
}

export default function App() {
  const [route, setRoute] = useState<Route>(getRouteFromHash)
  const [toast, setToast] = useState<ToastType | null>(null)
  const [health, setHealth] = useState<HealthStatus | null>(null)

  const wallet = useWallet()
  const auth = useAuth()
  const vote = useVote()

  // Hash-based routing
  useEffect(() => {
    const handler = () => setRoute(getRouteFromHash())
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])

  // Health check on mount
  useEffect(() => {
    fetchHealth()
      .then(setHealth)
      .catch(() => setHealth(null))
  }, [])

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(timer)
  }, [toast])

  const navigate = useCallback((r: string) => {
    window.location.hash = r === 'home' ? '' : r
  }, [])

  const showToast = useCallback((message: string, type: ToastType['type']) => {
    setToast({ message, type })
  }, [])

  const navItems: { route: Route; label: string }[] = [
    { route: 'home', label: 'Trang chủ' },
    { route: 'vote', label: 'Bỏ phiếu' },
    { route: 'results', label: 'Kết quả' },
    { route: 'admin', label: 'Quản trị' },
  ]

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Background orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="orb absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] bg-purple-900/20 rounded-full blur-[120px]" />
        <div className="orb absolute bottom-[-20%] right-[-10%] w-[50vw] h-[50vw] bg-blue-900/20 rounded-full blur-[100px]" />
      </div>

      {/* Nav */}
      <nav className="sticky top-0 z-40 backdrop-blur-md bg-black/40 border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 flex items-center gap-1 h-14">
          <span className="font-headline font-bold text-[#f2ca50] mr-4 text-sm">Web3 Awards</span>
          {navItems.map((item) => (
            <button
              key={item.route}
              onClick={() => navigate(item.route)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                route === item.route
                  ? 'bg-white/10 text-white font-medium'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Page content */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        {route === 'home' && (
          <HomePage wallet={wallet} auth={auth} health={health} onNavigate={navigate} />
        )}
        {route === 'vote' && (
          <VotePage wallet={wallet} vote={vote} authStep={auth.step} onToast={showToast} />
        )}
        {route === 'results' && <ResultsPage onNavigate={navigate} />}
        {route === 'admin' && <AdminPage />}
      </main>

      <Toast toast={toast} />
    </div>
  )
}
```

- [ ] **Step 2: Delete the old service/wallet.js (now replaced by services/wallet.ts)**

```bash
rm frontend/src/service/wallet.js
```

- [ ] **Step 3: Run the dev server and verify all 4 routes render without errors**

```bash
cd frontend && npm run dev
# Open http://localhost:5173
# Navigate: home → vote → results → admin
# Check browser console for TypeScript errors
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.tsx
git rm frontend/src/service/wallet.js
git commit -m "refactor: replace monolithic App.tsx with 80-line routing shell"
```

---

## Self-Review

### Spec Coverage Check

| Requirement | Covered By |
|-------------|-----------|
| Admin pagination | Task 10 (backend) + Task 11 (AdminPage) |
| User/results pagination | Task 9 (ResultsPage with Pagination) |
| Connect wallet flow | Task 3, 6 (useWallet + WalletConnect component with steps) |
| Gmail/email auth | Task 4, 7 (useAuth + AuthFlow with email mode) |
| Vote flow | Task 4, 8 (useVote + VotePage with category/candidate selection) |
| Sign transaction | Task 2, 8 (castVoteOnChain in wallet.ts + VotePage sign feedback) |

### Placeholder Scan

- No "TBD", "TODO", or "implement later" strings found
- All code blocks are complete and self-contained
- Mock results in ResultsPage are clearly labeled for future contract-read replacement

### Type Consistency

| Name | Defined in | Used in |
|------|-----------|---------|
| `Route` | types/index.ts | App.tsx |
| `AuthStep` | types/index.ts | useAuth.ts, VotePage.tsx, App.tsx |
| `VerifyMode` | types/index.ts | useAuth.ts, AuthFlow.tsx |
| `WalletState` | useWallet.ts | HomePage.tsx, VotePage.tsx, App.tsx |
| `AuthState` | useAuth.ts | AuthFlow.tsx, HomePage.tsx, App.tsx |
| `VoteState` | useVote.ts | VotePage.tsx, App.tsx |
| `PaginatedResponse<T>` | types/index.ts | api.ts, AdminPage.tsx |
| `AdminUser`, `AdminLog` | types/index.ts | api.ts, AdminPage.tsx |
| `HealthStatus` | types/index.ts | api.ts, StatusBar.tsx, App.tsx |

All consistent. ✓

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-18-frontend-pagination-auth-vote.md`.

**Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
