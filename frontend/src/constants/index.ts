import type { Category } from '../types'

export const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'

export const CONTRACT_ADDRESS =
  import.meta.env.VITE_CONTRACT_ADDRESS ||
  '0x5FbDB2315678afecb367f032d93F642f64180aa3'

export const ELECTION_ID = 1

export const SAPPHIRE_CHAIN_ID = 23295

export const SAPPHIRE_RPC = 'https://testnet.sapphire.oasis.io'
export const VOTE_FEE_NATIVE = '1'
export const VOTE_FEE_SYMBOL = 'TEST'

export const CONTRACT_ABI = [
  'function vote(uint256 electionId, uint256 candidateId) external payable',
  'function VOTE_FEE() external view returns (uint256)',
  'function isBanned(address voter) external view returns (bool)',
  'function isEligible(address voter) external view returns (bool)',
  'function getElection(uint256 electionId) external view returns (uint256 id, bool isActive, uint256 candidateCount, uint256 totalVotes)',
  'function getCandidate(uint256 electionId, uint256 candidateId) external view returns (uint256 id, uint256 voteCount)',
]

export const ADMIN_API_KEY = import.meta.env.VITE_ADMIN_API_KEY || 'dev-admin-key-change-in-production'

export const CATEGORIES: Category[] = [
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
