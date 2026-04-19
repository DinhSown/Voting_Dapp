import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { ethers } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const DATABASE_URL = process.env['DATABASE_URL'] || 'file:./dev.db';
const RPC_URL      = process.env['RPC_URL']      || 'https://testnet.sapphire.oasis.io';
const PRIVATE_KEY  = process.env['PRIVATE_KEY']  || '';
const CONTRACT_ADDR = process.env['CONTRACT_ADDRESS'] || '';

const ELECTIONS = [
  {
    title: 'Nhân vật truyền cảm hứng 2024',
    description: 'Cá nhân có đóng góp tích cực nhất cho cộng đồng blockchain Việt Nam',
    candidates: [
      { name: 'Nguyễn Văn An',  description: 'Founder & CEO BlockchainVN, 10 năm kinh nghiệm',            image: 'https://i.pravatar.cc/150?img=1' },
      { name: 'Trần Thị Bình',  description: 'Lead Developer DeFi Protocol, 5+ open source projects',     image: 'https://i.pravatar.cc/150?img=2' },
      { name: 'Lê Hoàng Cường', description: 'Web3 Educator, đào tạo hơn 2000 lập trình viên',            image: 'https://i.pravatar.cc/150?img=3' },
    ],
  },
  {
    title: 'Dự án Blockchain xuất sắc 2024',
    description: 'Dự án blockchain có tác động xã hội tích cực và tiềm năng phát triển cao nhất',
    candidates: [
      { name: 'VietChain ID', description: 'Nền tảng định danh phi tập trung cho 10M người dùng',  image: 'https://i.pravatar.cc/150?img=4' },
      { name: 'FarmToken',    description: 'Tokenize nông sản Việt Nam, hỗ trợ 50,000 nông dân',  image: 'https://i.pravatar.cc/150?img=5' },
      { name: 'MedBlock',     description: 'Hồ sơ y tế trên blockchain, bảo mật dữ liệu bệnh nhân', image: 'https://i.pravatar.cc/150?img=6' },
    ],
  },
  {
    title: 'Gương mặt Gen Z Web3 2024',
    description: 'Tài năng trẻ xuất sắc dưới 25 tuổi đang định hình tương lai Web3 Việt Nam',
    candidates: [
      { name: 'Phạm Minh Đức', description: 'NFT Artist & Smart Contract Developer, 22 tuổi',          image: 'https://i.pravatar.cc/150?img=7' },
      { name: 'Hoàng Thị Hà',  description: 'DeFi Researcher, tác giả 3 whitepaper được trích dẫn QT', image: 'https://i.pravatar.cc/150?img=8' },
      { name: 'Đỗ Quang Huy',  description: 'DAO Governance Specialist, quản lý treasury $5M',         image: 'https://i.pravatar.cc/150?img=9' },
    ],
  },
];

async function loadContract(): Promise<ethers.Contract> {
  const artifactPath = path.resolve(__dirname, '../../artifacts/contracts/VotingSystem.sol/VotingSystem.json');
  if (!fs.existsSync(artifactPath)) throw new Error('ABI not found — run: npx hardhat compile');
  const { abi } = JSON.parse(fs.readFileSync(artifactPath, 'utf8')) as { abi: unknown[] };
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet   = new ethers.Wallet(PRIVATE_KEY, provider);
  return new ethers.Contract(CONTRACT_ADDR, abi as ethers.InterfaceAbi, wallet);
}

function parseEvent(contract: ethers.Contract, receipt: ethers.TransactionReceipt | null, eventName: string): bigint | null {
  if (!receipt?.logs) return null;
  for (const log of receipt.logs) {
    try {
      const parsed = contract.interface.parseLog({ topics: [...log.topics], data: log.data });
      if (parsed?.name === eventName) return parsed.args[eventName === 'ElectionCreated' ? 0 : 1] as bigint;
    } catch { /* skip */ }
  }
  return null;
}

async function main() {
  const adapter = new PrismaLibSql({ url: DATABASE_URL });
  const prisma  = new PrismaClient({ adapter });

  const existingCount = await prisma.election.count();
  if (existingCount > 0) {
    console.log(`ℹ  Đã có ${existingCount} election trong DB — bỏ qua seed.`);
    console.log('   Xóa DB (npx prisma migrate reset) nếu muốn seed lại.');
    await prisma.$disconnect();
    return;
  }

  let contract: ethers.Contract | null = null;
  try {
    contract = await loadContract();
    await (contract.runner as ethers.Wallet).provider!.getNetwork();
    console.log('✓ Kết nối blockchain:', RPC_URL);
  } catch (e) {
    console.warn('⚠ Không kết nối được blockchain:', e instanceof Error ? e.message : String(e));
    console.warn('  Elections sẽ được tạo ở chế độ draft (onChainId = null, isActive = false).');
    console.warn('  Sau đó dùng Admin panel để tạo lại và start election.\n');
    contract = null;
  }

  for (const elData of ELECTIONS) {
    console.log(`\n── Tạo: "${elData.title}"`);

    const election = await prisma.election.create({
      data: { title: elData.title, description: elData.description },
    });

    let onChainId: number | null = null;

    if (contract) {
      try {
        const tx      = await (contract.createElection(elData.title) as Promise<ethers.TransactionResponse>);
        const receipt = await tx.wait();
        const rawId   = parseEvent(contract, receipt, 'ElectionCreated');
        if (rawId !== null) {
          onChainId = Number(rawId);
          await prisma.election.update({ where: { id: election.id }, data: { onChainId } });
          console.log(`   onChainId = ${onChainId}`);
        }
      } catch (e) {
        console.warn('   ⚠ Tạo election on-chain thất bại:', e instanceof Error ? e.message : String(e));
      }
    }

    for (const cand of elData.candidates) {
      const dbCand = await prisma.candidate.create({
        data: { name: cand.name, description: cand.description, image: cand.image, electionId: election.id },
      });

      if (contract && onChainId !== null) {
        try {
          const tx2      = await (contract.addCandidate(onChainId, cand.name) as Promise<ethers.TransactionResponse>);
          const receipt2 = await tx2.wait();
          const rawCId   = parseEvent(contract, receipt2, 'CandidateAdded');
          if (rawCId !== null) {
            await prisma.candidate.update({ where: { id: dbCand.id }, data: { onChainId: Number(rawCId) } });
            console.log(`   + ${cand.name} (onChainId: ${Number(rawCId)})`);
          }
        } catch (e) {
          console.warn(`   ⚠ Thêm candidate "${cand.name}" on-chain thất bại:`, e instanceof Error ? e.message : String(e));
        }
      } else {
        console.log(`   + ${cand.name} (draft)`);
      }
    }

    if (contract && onChainId !== null) {
      try {
        const tx3 = await (contract.startElection(onChainId) as Promise<ethers.TransactionResponse>);
        await tx3.wait();
        await prisma.election.update({ where: { id: election.id }, data: { isActive: true } });
        console.log('   ✓ Election started');

      } catch (e) {
        console.warn('   ⚠ Start election thất bại:', e instanceof Error ? e.message : String(e));
      }
    }
  }

  await prisma.$disconnect();
  console.log('\n✅ Seed hoàn thành!');
  if (!contract) {
    console.log('\n📝 Bước tiếp theo (vì không có blockchain):');
    console.log('   1. Vào Admin panel → tab Bầu cử → tạo từng election');
    console.log('   2. Thêm candidates rồi bấm Bắt đầu');
    console.log('   3. Whitelist ví của voter trước khi bỏ phiếu');
  } else {
    console.log('\n📝 Voter chỉ cần có token Sapphire Testnet + xác thực email là có thể bỏ phiếu.');
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
