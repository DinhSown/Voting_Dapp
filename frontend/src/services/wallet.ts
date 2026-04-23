import { ethers } from 'ethers'
import { wrapEthereumProvider } from '@oasisprotocol/sapphire-paratime'
import { SAPPHIRE_CHAIN_ID, SAPPHIRE_RPC, CONTRACT_ADDRESS, CONTRACT_ABI, VOTE_FEE_NATIVE } from '../constants'

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>
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

export async function switchToSapphire(): Promise<void> {
  if (!window.ethereum) throw new Error('MetaMask not installed')
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: `0x${SAPPHIRE_CHAIN_ID.toString(16)}` }],
    })
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 4902) {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: `0x${SAPPHIRE_CHAIN_ID.toString(16)}`,
            chainName: 'Oasis Sapphire Testnet',
            rpcUrls: [SAPPHIRE_RPC],
            nativeCurrency: { name: 'TEST', symbol: 'TEST', decimals: 18 },
            blockExplorerUrls: ['https://explorer.oasis.io/testnet/sapphire'],
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
  const provider = new ethers.BrowserProvider(wrapEthereumProvider(window.ethereum))
  const signer = await provider.getSigner()
  const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer)
  const voteFee = await contract.VOTE_FEE().catch(() => ethers.parseEther(VOTE_FEE_NATIVE))
  await contract.vote.staticCall(electionId, candidateId, {
    value: voteFee,
  })
  const tx = await contract.vote(electionId, candidateId, {
    value: voteFee,
  })
  const receipt = await tx.wait()
  if (!receipt || receipt.status !== 1) {
    throw new Error('Giao dịch vote thất bại trên blockchain')
  }
  return tx.hash as string
}

export function onAccountsChanged(handler: (accounts: string[]) => void): () => void {
  if (!window.ethereum) return () => {}
  const listener = (...args: unknown[]) => {
    if (Array.isArray(args[0])) {
      handler(args[0] as string[])
    }
  }
  window.ethereum.on('accountsChanged', listener)
  return () => window.ethereum?.removeListener('accountsChanged', listener)
}

export function onChainChanged(handler: (chainId: number) => void): () => void {
  if (!window.ethereum) return () => {}
  const listener = (...args: unknown[]) => {
    if (typeof args[0] === 'string') {
      handler(parseInt(args[0], 16))
    }
  }
  window.ethereum.on('chainChanged', listener)
  return () => window.ethereum?.removeListener('chainChanged', listener)
}
