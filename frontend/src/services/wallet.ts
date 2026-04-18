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
