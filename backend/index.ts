import express, { Request, Response } from 'express';
import cors from 'cors';
import { ethers } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaMssql } from '@prisma/adapter-mssql';
import nodemailer from 'nodemailer';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const DATABASE_URL = process.env['DATABASE_URL'] || '';
const prismaAdapter = new PrismaMssql(DATABASE_URL);
const prisma = new PrismaClient({ adapter: prismaAdapter });

const RPC_URL = process.env['RPC_URL'] || 'http://127.0.0.1:8545';
const PRIVATE_KEY = process.env['PRIVATE_KEY'] || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const CONTRACT_ADDR = process.env['CONTRACT_ADDRESS'] || '';
const SMTP_HOST = process.env['SMTP_HOST'];
const SMTP_PORT = parseInt(process.env['SMTP_PORT'] || '587', 10);
const SMTP_SECURE = process.env['SMTP_SECURE'] === 'true';
const SMTP_USER = process.env['SMTP_USER'];
const SMTP_PASS = process.env['SMTP_PASS'];
const MAIL_FROM = process.env['MAIL_FROM'] || SMTP_USER || 'no-reply@wechoice.local';

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

const ARTIFACT_PATH = path.resolve(
  __dirname,
  '../../artifacts/contracts/VotingSystem.sol/VotingSystem.json'
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
  return new ethers.Contract(CONTRACT_ADDR, contractABI as ethers.InterfaceAbi, wallet);
};

const createMailer = () => {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
};

const sendOtpEmail = async (email: string, otpCode: string) => {
  const transporter = createMailer();

  if (!transporter) {
    console.log('\n==============================');
    console.log('MOCK EMAIL TO:', email);
    console.log('OTP CODE:     ', otpCode);
    console.log('==============================\n');
    return { mode: 'mock' as const };
  }

  await transporter.sendMail({
    from: MAIL_FROM,
    to: email,
    subject: 'WECHOICE OTP Verification Code',
    text: `Your OTP code is ${otpCode}. It will expire in 5 minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
        <h2>WECHOICE OTP Verification</h2>
        <p>Your OTP code is:</p>
        <div style="font-size: 28px; font-weight: bold; letter-spacing: 8px; margin: 16px 0;">${otpCode}</div>
        <p>This code expires in 5 minutes.</p>
      </div>
    `,
  });

  return { mode: 'smtp' as const };
};

app.post('/api/auth/send-otp', async (req: Request, res: Response) => {
  const { email } = req.body as { email?: string };
  if (!email) {
    res.status(400).json({ error: 'Email is required' });
    return;
  }

  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 5 * 60_000);

  try {
    await prisma.otpSession.create({ data: { email, otpCode, expiresAt } });
    const delivery = await sendOtpEmail(email, otpCode);
    res.json({
      message: delivery.mode === 'smtp' ? 'OTP sent successfully' : 'OTP generated in mock mode',
      deliveryMode: delivery.mode,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(err);
    await prisma.log.create({
      data: {
        action: 'OTP_SEND_FAILED',
        description: message,
      },
    }).catch(() => undefined);
    res.status(500).json({ error: 'Failed to generate OTP', details: message });
  }
});

app.post('/api/auth/verify-otp', async (req: Request, res: Response) => {
  const { email, otpCode, walletAddress, electionId } =
    req.body as { email?: string; otpCode?: string; walletAddress?: string; electionId?: number };

  if (!email || !otpCode || !walletAddress || !electionId) {
    res.status(400).json({ error: 'Missing required fields: email, otpCode, walletAddress, electionId' });
    return;
  }

  try {
    const session = await prisma.otpSession.findFirst({
      where: { email, otpCode, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });

    if (!session) {
      res.status(400).json({ error: 'OTP khong hop le hoac da het han' });
      return;
    }

    await prisma.user.upsert({
      where: { email },
      update: { walletAddress, isVerified: true },
      create: { email, walletAddress, isVerified: true },
    });

    const contract = getContract();
    console.log(`Whitelisting ${walletAddress} for election ${electionId}...`);
    const tx = await contract.whitelistEligibleWallet(electionId, walletAddress);
    console.log(`Tx hash: ${tx.hash}`);
    await tx.wait();
    console.log(`Confirmed: ${walletAddress} is whitelisted`);

    await prisma.otpSession.delete({ where: { id: session.id } });

    await prisma.log.create({
      data: {
        action: 'WHITELIST_SUCCESS',
        description: `${walletAddress} whitelisted for election ${electionId}`,
      },
    });

    res.json({ message: 'Xac minh thanh cong! Vi da duoc whitelist.' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Error:', message);
    await prisma.log.create({
      data: {
        action: 'WHITELIST_FAILED',
        description: message,
      },
    }).catch(() => undefined);
    res.status(500).json({ error: 'Loi server hoac blockchain', details: message });
  }
});

app.get('/health', async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1 AS ok`;
    res.json({
      status: 'ok',
      database: 'sqlserver',
      contract: CONTRACT_ADDR || 'NOT SET',
      mailer: SMTP_HOST && SMTP_USER && SMTP_PASS ? 'smtp' : 'mock',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({
      status: 'error',
      database: 'sqlserver',
      contract: CONTRACT_ADDR || 'NOT SET',
      mailer: SMTP_HOST && SMTP_USER && SMTP_PASS ? 'smtp' : 'mock',
      details: message,
    });
  }
});

const PORT = parseInt(process.env['PORT'] || '3001', 10);
app.listen(PORT, () => {
  console.log(`\nBackend running on http://localhost:${PORT}`);
  console.log('Database: sqlserver');
  console.log(`Contract address: ${CONTRACT_ADDR || 'NOT SET in .env'}`);
  console.log(`RPC: ${RPC_URL}`);
  console.log(`Mailer mode: ${SMTP_HOST && SMTP_USER && SMTP_PASS ? 'smtp' : 'mock'}\n`);
});
