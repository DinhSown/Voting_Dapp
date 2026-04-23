import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { Block, ethers } from 'ethers';
import { wrapEthersSigner } from '@oasisprotocol/sapphire-ethers-v6';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const DATABASE_URL = process.env['DATABASE_URL'] || 'file:./dev.db';
const RPC_URL = process.env['RPC_URL'] || 'https://testnet.sapphire.oasis.io';
const PRIVATE_KEY = process.env['PRIVATE_KEY'] || '';
const CONTRACT_ADDR = process.env['CONTRACT_ADDRESS'] || '';

type DemoElection = {
  title: string;
  description: string;
  startOnChain: boolean;
  candidates: Array<{
    name: string;
    description: string;
    image: string;
  }>;
};

const DEMO_ELECTIONS: DemoElection[] = [
  {
    title: 'Nhân vật truyền cảm hứng 2026',
    description: 'Cá nhân có đóng góp tích cực nhất cho cộng đồng Blockchain Việt Nam.',

    startOnChain: true,
    candidates: [
      {
        name: 'Nguyễn Văn An',
        description: 'Founder BlockchainVN, 10 năm kinh nghiệm xây dựng cộng đồng.',
        image: 'https://i.pravatar.cc/150?img=11',
      },
      {
        name: 'Trần Thị Bình',
        description: 'Lead Developer DeFi Protocol, đóng góp nhiều dự án open-source.',
        image: 'https://i.pravatar.cc/150?img=12',
      },
      {
        name: 'Phạm Minh Đức',
        description: 'Web3 educator, mentor cho nhiều nhóm sinh viên blockchain.',
        image: 'https://i.pravatar.cc/150?img=13',
      },
    ],
  },
  {
    title: 'Du an blockchain xuat sac 2026',
    description: 'Du an co tinh ung dung cao va tao tac dong tich cuc toi nguoi dung.',
    startOnChain: true,
    candidates: [
      {
        name: 'VietChain ID',
        description: 'Nen tang dinh danh phi tap trung cho dich vu cong va doanh nghiep.',
        image: 'https://i.pravatar.cc/150?img=21',
      },
      {
        name: 'FarmToken',
        description: 'Token hoa nong san va ho tro truy xuat nguon goc cho hop tac xa.',
        image: 'https://i.pravatar.cc/150?img=22',
      },
      {
        name: 'MedBlock',
        description: 'He thong ho so y te bao mat va chia se co kiem soat.',
        image: 'https://i.pravatar.cc/150?img=23',
      },
    ],
  },
  {
    title: 'Guong mat Gen Z Web3 2026',
    description: 'Tai nang tre dang tao dau an trong linh vuc Web3 tai Viet Nam.',
    startOnChain: false,
    candidates: [
      {
        name: 'Hoang Thi Ha',
        description: 'Nghien cuu DeFi va viet whitepaper cho cac du an khoi nghiep.',
        image: 'https://i.pravatar.cc/150?img=31',
      },
      {
        name: 'Do Quang Huy',
        description: 'Chuyen gia DAO governance, van hanh cong dong va treasury.',
        image: 'https://i.pravatar.cc/150?img=32',
      },
      {
        name: 'Le Gia Khanh',
        description: 'Builder san pham NFT va cong cu creator economy cho gioi tre.',
        image: 'https://i.pravatar.cc/150?img=33',
      },
    ],
  },
];

function loadArtifactAbi(): ethers.InterfaceAbi {
  const artifactPath = path.resolve(__dirname, '../../artifacts/contracts/VotingSystem.sol/VotingSystem.json');
  if (!fs.existsSync(artifactPath)) {
    throw new Error('ABI not found. Run `npx hardhat compile` first.');
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8')) as { abi: ethers.InterfaceAbi };
  return artifact.abi;
}

async function getContract(): Promise<ethers.Contract> {
  if (!PRIVATE_KEY || !CONTRACT_ADDR) {
    throw new Error('PRIVATE_KEY or CONTRACT_ADDRESS is missing in backend/.env');
  }

  const abi = loadArtifactAbi();
  const baseProvider = new ethers.JsonRpcProvider(RPC_URL);
  
  // Only wrap with Sapphire if not on localhost
  const isSapphire = !RPC_URL.includes('localhost') && !RPC_URL.includes('127.0.0.1');
  const baseWallet = new ethers.Wallet(PRIVATE_KEY).connect(baseProvider);
  const signer = isSapphire ? wrapEthersSigner(baseWallet) : (baseWallet as any);

  return new ethers.Contract(CONTRACT_ADDR, abi, signer);
}

function getEventId(
  contract: ethers.Contract,
  receipt: ethers.TransactionReceipt | null,
  eventName: 'ElectionCreated' | 'CandidateAdded'
): number | null {
  if (!receipt?.logs) return null;

  const iface = contract.interface;
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log as any);
      if (parsed?.name === eventName) {
        return Number(parsed.args[eventName === 'ElectionCreated' ? 0 : 1]);
      }
    } catch {
      // Manual fallback for standard nodes and indexed parameters
      const eventHash = iface.getEvent(eventName)?.topicHash;
      if (log.topics[0] === eventHash) {
        if (eventName === 'ElectionCreated' && log.topics.length > 1) {
          return Number(ethers.toBigInt(log.topics[1]));
        } else if (eventName === 'CandidateAdded' && log.topics.length > 2) {
          // CandidateAdded(uint256 indexed electionId, uint256 indexed candidateId)
          return Number(ethers.toBigInt(log.topics[2]));
        }
      }
    }
  }

  return null;
}

async function resetElectionData(prisma: PrismaClient) {
  await prisma.vote.deleteMany();
  await prisma.candidate.deleteMany();
  await prisma.election.deleteMany();
  await prisma.log.deleteMany({
    where: {
      OR: [
        { action: { startsWith: 'SEED_' } },
        { action: 'SEED_RESET' },
      ],
    },
  });
}

async function main() {
  const adapter = new PrismaLibSql({ url: DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  let contract: ethers.Contract | null = null;
  try {
    contract = await getContract();
    await contract.owner();
    console.log(`Connected to contract ${CONTRACT_ADDR}`);
  } catch (error) {
    console.warn('Blockchain unavailable, seeding demo data in draft mode only.');
    console.warn(error instanceof Error ? error.message : String(error));
  }

  console.log('Resetting election-related demo data...');
  await resetElectionData(prisma);
  await prisma.log.create({
    data: {
      action: 'SEED_RESET',
      description: 'Reset elections, candidates, votes and seed logs before creating demo data.',
    },
  });

  for (const demoElection of DEMO_ELECTIONS) {
    console.log(`Creating demo election: ${demoElection.title}`);

    const election = await prisma.election.create({
      data: {
        title: demoElection.title,
        description: demoElection.description,
      },
    });

    let onChainId: number | null = null;

    if (contract) {
      try {
        const tx = await (contract.createElection() as Promise<ethers.TransactionResponse>);
        const receipt = await tx.wait();
        onChainId = getEventId(contract, receipt, 'ElectionCreated');

        await prisma.election.update({
          where: { id: election.id },
          data: { onChainId },
        });
      } catch (error) {
        console.warn(`Failed to create "${demoElection.title}" on-chain:`, error instanceof Error ? error.message : String(error));
      }
    }

    for (const candidateData of demoElection.candidates) {
      const candidate = await prisma.candidate.create({
        data: {
          name: candidateData.name,
          description: candidateData.description,
          image: candidateData.image,
          electionId: election.id,
        },
      });

      if (contract && onChainId !== null) {
        try {
          const tx = await (contract.addCandidate(onChainId) as Promise<ethers.TransactionResponse>);
          const receipt = await tx.wait();
          const candidateOnChainId = getEventId(contract, receipt, 'CandidateAdded');

          await prisma.candidate.update({
            where: { id: candidate.id },
            data: { onChainId: candidateOnChainId },
          });
        } catch (error) {
          console.warn(`Failed to add candidate "${candidateData.name}" on-chain:`, error instanceof Error ? error.message : String(error));
        }
      }
    }

    if (contract && onChainId !== null && demoElection.startOnChain) {
      try {
        const tx = await (contract.startElection(onChainId) as Promise<ethers.TransactionResponse>);
        await tx.wait();

        await prisma.election.update({
          where: { id: election.id },
          data: { isActive: true },
        });
      } catch (error) {
        console.warn(`Failed to start "${demoElection.title}" on-chain:`, error instanceof Error ? error.message : String(error));
      }
    }

    await prisma.log.create({
      data: {
        action: 'SEED_ELECTION_CREATED',
        description: `Created demo election "${demoElection.title}" with ${demoElection.candidates.length} candidates.`,
      },
    });
  }

  await prisma.$disconnect();

  console.log('\nSeed completed.');
  console.log(`Created ${DEMO_ELECTIONS.length} demo elections.`);
  console.log('- 2 elections are active on-chain (if blockchain is available).');
  console.log('- 1 election remains draft/inactive for admin flow testing.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
