import express, { Request, Response } from 'express';
import cors from 'cors';
import { ethers } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import twilio from 'twilio';

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
const TWILIO_ACCOUNT_SID = process.env['TWILIO_ACCOUNT_SID'];
const TWILIO_AUTH_TOKEN = process.env['TWILIO_AUTH_TOKEN'];
const TWILIO_PHONE_NUMBER = process.env['TWILIO_PHONE_NUMBER'];
const FRONTEND_URL = process.env['FRONTEND_URL'] || 'http://localhost:5173';

// ─── Prisma ────────────────────────────────────────────────────────
const adapter = new PrismaLibSql({ url: DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// ─── Ethers ────────────────────────────────────────────────────────
const provider = new ethers.JsonRpcProvider(RPC_URL);
const signerWallet = new ethers.Wallet(PRIVATE_KEY, provider);

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
  })
);

app.use('/api/user', auth, createUserRouter(prisma, provider));
app.use('/api/admin', auth, requireAdmin, createAdminRouter(prisma, getContract));

// ─── Legacy phone OTP (still used by existing frontend) ────────────
const sendOtpSms = async (phone: string, otpCode: string) => {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    console.log('\n==============================');
    console.log('[MOCK SMS] TO:', phone);
    console.log('[MOCK SMS] OTP CODE:', otpCode);
    console.log('==============================\n');
    return 'mock';
  }
  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  await client.messages.create({
    body: `[meChoice] Mã OTP của bạn là: ${otpCode}. Có hiệu lực trong 5 phút.`,
    from: TWILIO_PHONE_NUMBER,
    to: phone,
  });
  return 'sms';
};

app.post('/api/auth/send-phone-otp', async (req: Request, res: Response) => {
  const { phone } = req.body as { phone?: string };
  if (!phone) { res.status(400).json({ error: 'Số điện thoại là bắt buộc' }); return; }
  const normalized = phone.trim().replace(/\s+/g, '');
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 5 * 60_000);
  try {
    await prisma.phoneOtpSession.create({ data: { phone: normalized, otpCode, expiresAt } });
    const mode = await sendOtpSms(normalized, otpCode);
    res.json({ message: mode === 'sms' ? 'OTP đã được gửi qua SMS' : 'OTP được tạo ở mock mode', deliveryMode: mode });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Không thể tạo OTP', details: message });
  }
});

app.post('/api/auth/verify-phone-otp', async (req: Request, res: Response) => {
  const { phone, otpCode, walletAddress } = req.body as {
    phone?: string; otpCode?: string; walletAddress?: string;
  };
  if (!phone || !otpCode || !walletAddress) {
    res.status(400).json({ error: 'Thiếu trường bắt buộc: phone, otpCode, walletAddress' });
    return;
  }
  const normalized = phone.trim().replace(/\s+/g, '');
  try {
    const session = await prisma.phoneOtpSession.findFirst({
      where: { phone: normalized, otpCode, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!session) { res.status(400).json({ error: 'OTP không hợp lệ hoặc đã hết hạn' }); return; }

    await prisma.user.upsert({
      where: { phone: normalized },
      update: { walletAddress, isVerified: true },
      create: { phone: normalized, walletAddress, isVerified: true },
    });

    await prisma.phoneOtpSession.delete({ where: { id: session.id } });
    await prisma.log.create({ data: { action: 'VERIFY_PHONE_SUCCESS', description: `${walletAddress} verified phone ${normalized}` } });
    res.json({ message: 'Xác minh thành công! Ví đã được xác thực.' });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Lỗi server', details: message });
  }
});

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

// ─── Health ────────────────────────────────────────────────────────
app.get('/health', async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1 AS ok`;
    res.json({
      status: 'ok',
      database: 'sqlite',
      contract: CONTRACT_ADDR || 'NOT SET',
      mailer: SMTP_HOST && SMTP_USER && SMTP_PASS ? 'smtp' : 'mock',
      sms: TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER ? 'twilio' : 'mock',
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
});
