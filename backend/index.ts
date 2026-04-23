import express, { Request, Response } from 'express';
import cors from 'cors';
import { ethers } from 'ethers';
import { wrapEthersProvider, wrapEthersSigner } from '@oasisprotocol/sapphire-ethers-v6';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';

import { createAuthRouter } from './src/routes/auth';
import { createAdminRouter } from './src/routes/admin';
import { createUserRouter } from './src/routes/user';
import { createAuthMiddleware } from './src/middleware/auth';
import { requireAdmin } from './src/middleware/requireAdmin';

dotenv.config();

// ─── Startup validation ────────────────────────────────────────────
const JWT_SECRET = process.env['JWT_SECRET'];
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET is not set in .env');
  process.exit(1);
}
const ADMIN_WALLET = process.env['ADMIN_WALLET'];
if (!ADMIN_WALLET) {
  console.warn('WARNING: ADMIN_WALLET is not set — no wallet will have admin privileges');
}

// ─── Config ────────────────────────────────────────────────────────
const DATABASE_URL = process.env['DATABASE_URL'] || 'file:./dev.db';
const RPC_URL = process.env['RPC_URL'] || 'https://testnet.sapphire.oasis.io';
const PRIVATE_KEY = process.env['PRIVATE_KEY'] || '';
const CONTRACT_ADDR = process.env['CONTRACT_ADDRESS'] || '';
const SMTP_HOST = process.env['SMTP_HOST'];
const SMTP_PORT = parseInt(process.env['SMTP_PORT'] || '587', 10);
const SMTP_SECURE = process.env['SMTP_SECURE'] === 'true';
const SMTP_USER = process.env['SMTP_USER'];
const SMTP_PASS = process.env['SMTP_PASS'];
const MAIL_FROM = process.env['MAIL_FROM'] || SMTP_USER || 'no-reply@meChoice.local';
const FRONTEND_URL = process.env['FRONTEND_URL'] || 'http://localhost:5173';
const LOG_SYNC_BLOCK_RANGE = Math.min(
  100,
  Math.max(1, parseInt(process.env['LOG_SYNC_BLOCK_RANGE'] || '100', 10))
);

// ─── Prisma ────────────────────────────────────────────────────────
const adapter = new PrismaLibSql({ url: DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// ─── Ethers ────────────────────────────────────────────────────────
const baseProvider = new ethers.JsonRpcProvider(RPC_URL);

// Only wrap with Sapphire if not on localhost to avoid "fetchRuntimePublicKey" error on standard nodes
const isSapphire = !RPC_URL.includes('localhost') && !RPC_URL.includes('127.0.0.1');
const provider = isSapphire ? wrapEthersProvider(baseProvider) : baseProvider;

const baseWallet = new ethers.Wallet(PRIVATE_KEY).connect(baseProvider);
const signerWallet = isSapphire ? wrapEthersSigner(baseWallet) : baseWallet;

const ARTIFACT_PATH = path.resolve(
  __dirname,
  '../artifacts/contracts/VotingSystem.sol/VotingSystem.json'
);

let contractABI: unknown[] = [];
if (fs.existsSync(ARTIFACT_PATH)) {
  type ArtifactJson = { abi: unknown[] };
  const artifact = JSON.parse(fs.readFileSync(ARTIFACT_PATH, 'utf8')) as ArtifactJson;
  contractABI = artifact.abi;
  console.log('ABI loaded from artifacts');
} else {
  console.warn('ABI not found at', ARTIFACT_PATH, '- run `npx hardhat compile` first');
}

const getContract = () => {
  if (!CONTRACT_ADDR) throw new Error('CONTRACT_ADDRESS is not set in .env');
  if (!contractABI.length) throw new Error('ABI not loaded, run npx hardhat compile');
  return new ethers.Contract(CONTRACT_ADDR, contractABI as ethers.InterfaceAbi, signerWallet);
};

const getReadContract = () => {
  if (!CONTRACT_ADDR) throw new Error('CONTRACT_ADDRESS is not set in .env');
  if (!contractABI.length) throw new Error('ABI not loaded, run npx hardhat compile');
  return new ethers.Contract(CONTRACT_ADDR, contractABI as ethers.InterfaceAbi, baseProvider);
};

async function syncVoteEvents(fromBlock?: number, toBlock?: number) {
  if (!CONTRACT_ADDR || !contractABI.length) return { synced: 0 };

  const contract = getReadContract();
  const latestBlock = toBlock ?? await baseProvider.getBlockNumber();
  const startBlock = fromBlock ?? Math.max(0, latestBlock - 5_000);
  const filter = contract.filters['Voted']();
  let synced = 0;

  for (let batchStart = startBlock; batchStart <= latestBlock; batchStart += LOG_SYNC_BLOCK_RANGE) {
    const batchEnd = Math.min(batchStart + LOG_SYNC_BLOCK_RANGE - 1, latestBlock);
    const events = await contract.queryFilter(filter, batchStart, batchEnd);

    for (const event of events) {
      if (!('args' in event) || !event.args) continue;
      const electionOnChainId = Number(event.args[0]);
      const candidateOnChainId = Number(event.args[1]);
      const voterWallet = String(event.args[2]).toLowerCase();
      const txHash = event.transactionHash;

      const [user, election] = await Promise.all([
        prisma.user.findUnique({
          where: { walletAddress: voterWallet },
          select: { id: true, name: true, walletAddress: true },
        }),
        prisma.election.findFirst({
          where: { onChainId: electionOnChainId },
          include: {
            candidates: {
              where: { onChainId: candidateOnChainId, isRemoved: false },
              take: 1,
            },
          },
        }),
      ]);

      if (!user || !election || !election.candidates[0]) continue;
      const candidate = election.candidates[0];

      await prisma.vote.upsert({
        where: { userId_categoryId: { userId: user.id, categoryId: election.id } },
        update: {
          candidateId: candidate.id,
          candidateName: candidate.name,
          categoryTitle: election.title,
          txHash,
        },
        create: {
          userId: user.id,
          categoryId: election.id,
          candidateId: candidate.id,
          candidateName: candidate.name,
          categoryTitle: election.title,
          txHash,
        },
      });
      synced++;
    }
  }

  return { synced, fromBlock: startBlock, toBlock: latestBlock };
}

// ─── Express ───────────────────────────────────────────────────────
const app = express();

app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  })
);
app.use(express.json());

// ─── Middleware factories ──────────────────────────────────────────
const auth = createAuthMiddleware(prisma);

// ─── Routes ────────────────────────────────────────────────────────
app.use(
  '/api/auth',
  createAuthRouter(prisma, {
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    user: SMTP_USER,
    pass: SMTP_PASS,
    from: MAIL_FROM,
  }, getContract)
);

app.use('/api/user', auth, createUserRouter(prisma, provider, CONTRACT_ADDR, contractABI as ethers.InterfaceAbi, getContract));
app.use('/api/admin', auth, requireAdmin, createAdminRouter(prisma, getContract));

// ─── Elections (public) ───────────────────────────────────────────
app.get('/api/elections', async (req: Request, res: Response) => {
  const activeOnly = req.query['active'] === 'true';
  try {
    const elections = await prisma.election.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      include: { candidates: { where: { isRemoved: false }, orderBy: { id: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(elections);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Failed to fetch elections', details: message });
  }
});

// ─── Results (public) ─────────────────────────────────────────────
app.get('/api/results', async (_req: Request, res: Response) => {
  try {
    const votes = await prisma.vote.findMany({
      select: { categoryId: true, candidateId: true, candidateName: true, categoryTitle: true },
    });

    const counts: Record<string, number> = {};
    const meta: Record<string, { candidateName: string; categoryTitle: string }> = {};
    for (const v of votes) {
      const key = `${v.categoryId}:${v.candidateId}`;
      counts[key] = (counts[key] ?? 0) + 1;
      meta[key] = { candidateName: v.candidateName, categoryTitle: v.categoryTitle };
    }

    const results = Object.entries(counts).map(([key, count]) => {
      const [catId, candId] = key.split(':').map(Number);
      return {
        categoryId: catId,
        candidateId: candId,
        candidateName: meta[key]?.candidateName ?? '',
        categoryTitle: meta[key]?.categoryTitle ?? '',
        voteCount: count,
      };
    });

    res.json(results);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Failed to fetch results', details: message });
  }
});

app.post('/api/sync/votes', auth, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const result = await syncVoteEvents();
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Failed to sync vote events', details: message });
  }
});

// ─── Health ────────────────────────────────────────────────────────
app.get('/health', async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1 AS ok`;
    res.json({
      status: 'ok',
      database: 'sqlite',
      contract: CONTRACT_ADDR || 'NOT SET',
      mailer: SMTP_HOST && SMTP_USER && SMTP_PASS ? 'smtp' : 'mock',
      adminWallet: ADMIN_WALLET ? `${ADMIN_WALLET.slice(0, 6)}...${ADMIN_WALLET.slice(-4)}` : 'NOT SET',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ status: 'error', details: message });
  }
});

// ─── Start ─────────────────────────────────────────────────────────
const PORT = parseInt(process.env['PORT'] || '3001', 10);
app.listen(PORT, () => {
  console.log(`\nBackend running on http://localhost:${PORT}`);
  console.log(`Contract address: ${CONTRACT_ADDR || 'NOT SET in .env'}`);
  console.log(`RPC: ${RPC_URL}`);
  console.log(`Admin wallet: ${ADMIN_WALLET ? `${ADMIN_WALLET.slice(0, 6)}...` : 'NOT SET'}`);
  console.log(`Frontend CORS: ${FRONTEND_URL}`);
  console.log(`Mailer mode: ${SMTP_HOST && SMTP_USER && SMTP_PASS ? 'smtp' : 'mock'}\n`);

  let lastSyncedBlock: number | undefined;
  setInterval(() => {
    baseProvider.getBlockNumber()
      .then(async (latestBlock) => {
        const fromBlock = lastSyncedBlock === undefined ? Math.max(0, latestBlock - 5_000) : lastSyncedBlock + 1;
        await syncVoteEvents(fromBlock, latestBlock);
        lastSyncedBlock = latestBlock;
      })
      .catch((err) => console.warn('[sync] vote event sync failed:', err instanceof Error ? err.message : String(err)));
  }, 60_000);
});
