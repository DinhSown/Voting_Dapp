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
