import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import nodemailer from 'nodemailer';
import { createHash, timingSafeEqual } from 'crypto';
import { ethers } from 'ethers';
import { createNonce, consumeNonce } from '../lib/nonce';
import { verifyWalletSignature, isAdminWallet } from '../lib/wallet';
import { signToken, signTempToken, verifyTempToken } from '../lib/jwt';

const ACCOUNT_BANNED_RESPONSE = { code: 'ACCOUNT_BANNED', error: 'Account is banned' } as const;
const OTP_MAX_ATTEMPTS = 5;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashOtp(email: string, otpCode: string): string {
  const secret = process.env['JWT_SECRET'] ?? 'dev-secret';
  return createHash('sha256').update(`${normalizeEmail(email)}:${otpCode}:${secret}`).digest('hex');
}

function verifyOtpHash(email: string, otpCode: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashOtp(email, otpCode), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function rateLimit(maxRequests: number, windowMs: number) {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();
    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }
    if (bucket.count >= maxRequests) {
      res.status(429).json({ error: 'Too many requests, please try again later' });
      return;
    }
    bucket.count++;
    next();
  };
}

export function createAuthRouter(
  prisma: PrismaClient,
  mailerConfig: {
    host?: string;
    port: number;
    secure: boolean;
    user?: string;
    pass?: string;
    from: string;
  },
  getContract?: () => ethers.Contract
) {
  const router = Router();
  const strictAuthLimit = rateLimit(10, 60_000);
  const otpLimit = rateLimit(5, 60_000);

  const createMailer = () => {
    if (!mailerConfig.host || !mailerConfig.user || !mailerConfig.pass) return null;
    return nodemailer.createTransport({
      host: mailerConfig.host,
      port: mailerConfig.port,
      secure: mailerConfig.secure,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
      auth: { user: mailerConfig.user, pass: mailerConfig.pass },
    });
  };

  const printMockOtp = (email: string, otpCode: string) => {
    console.log('\n==============================');
    console.log('MOCK EMAIL TO:', email);
    console.log('OTP CODE:     ', otpCode);
    console.log('==============================\n');
  };

  const sendOtpEmail = async (email: string, otpCode: string): Promise<'smtp' | 'mock'> => {
    const transporter = createMailer();
    if (!transporter) {
      printMockOtp(email, otpCode);
      return 'mock';
    }
    try {
      await transporter.sendMail({
        from: mailerConfig.from,
        to: email,
        subject: 'meChoice OTP Verification Code',
        text: `Your OTP code is ${otpCode}. It will expire in 5 minutes.`,
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
            <h2>meChoice OTP Verification</h2>
            <p>Your OTP code is:</p>
            <div style="font-size: 28px; font-weight: bold; letter-spacing: 8px; margin: 16px 0;">${otpCode}</div>
            <p>This code expires in 5 minutes.</p>
          </div>
        `,
      });
      return 'smtp';
    } catch (smtpErr) {
      // SMTP failed (e.g. wrong credentials, network issue) — fall back to mock mode
      // so the flow still works in development. OTP is printed to server console.
      const reason = smtpErr instanceof Error ? smtpErr.message : String(smtpErr);
      console.warn(`[SMTP] Failed to send email (${reason}). Falling back to mock mode.`);
      printMockOtp(email, otpCode);
      return 'mock';
    }
  };

  // GET /api/auth/nonce?walletAddress=0x...
  router.get('/nonce', strictAuthLimit, async (req: Request, res: Response) => {
    const walletAddress = String(req.query['walletAddress'] ?? '').trim();
    if (!walletAddress || !walletAddress.startsWith('0x')) {
      res.status(400).json({ error: 'Invalid wallet address' });
      return;
    }

    try {
      const nonce = await createNonce(prisma, walletAddress);
      res.json({ nonce });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: 'Failed to generate nonce', details: message });
    }
  });

  // POST /api/auth/wallet
  router.post('/wallet', strictAuthLimit, async (req: Request, res: Response) => {
    const { walletAddress, signature, nonce } = req.body as {
      walletAddress?: string;
      signature?: string;
      nonce?: string;
    };

    if (!walletAddress || !signature || !nonce) {
      res.status(400).json({ error: 'Missing walletAddress, signature, or nonce' });
      return;
    }

    try {
      // 1. Verify signature
      const valid = verifyWalletSignature(walletAddress, signature, nonce);
      if (!valid) {
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }

      // 2. Consume nonce (one-time use)
      const nonceValid = await consumeNonce(prisma, walletAddress, nonce);
      if (!nonceValid) {
        res.status(401).json({ error: 'Nonce expired or already used' });
        return;
      }

      // 3. Determine role
      const role = isAdminWallet(walletAddress) ? 'admin' : 'user';

      // 4. Look up existing user
      const existingUser = await prisma.user.findUnique({
        where: { walletAddress: walletAddress.toLowerCase() },
      });
      if (existingUser?.isBanned) {
        res.status(403).json(ACCOUNT_BANNED_RESPONSE);
        return;
      }

      // 5. Returning verified wallet — issue full JWT immediately
      if (existingUser && existingUser.emailVerified) {
        // Sync role in case ADMIN_WALLET changed
        const user =
          existingUser.role !== role
            ? await prisma.user.update({
                where: { id: existingUser.id },
                data: { role },
              })
            : existingUser;
        try {
          const tx = await getContract?.().setVoterStatus(walletAddress.toLowerCase(), true, false);
          await tx?.wait();
        } catch (chainErr) {
          console.warn(
            '[auth] Could not sync voter eligibility on-chain:',
            chainErr instanceof Error ? chainErr.message : String(chainErr)
          );
        }

        const token = signToken({
          userId: user.id,
          walletAddress: walletAddress.toLowerCase(),
          role,
        });

        res.json({
          requiresOtp: false,
          token,
          user: {
            id: user.id,
            name: user.name,
            walletAddress: user.walletAddress,
            role: user.role,
            emailVerified: user.emailVerified,
          },
        });
        return;
      }

      // 6. First-time or unverified wallet — upsert user, return temp token
      const user = await prisma.user.upsert({
        where: { walletAddress: walletAddress.toLowerCase() },
        update: { role },
        create: {
          walletAddress: walletAddress.toLowerCase(),
          role,
          name: 'Unknown User',
          emailVerified: false,
          isVerified: false,
        },
      });

      const tempToken = signTempToken({ walletAddress: walletAddress.toLowerCase() });

      res.json({
        requiresOtp: true,
        tempToken,
        user: {
          id: user.id,
          walletAddress: user.walletAddress,
          role: user.role,
          emailVerified: user.emailVerified,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Wallet auth error:', message);
      res.status(500).json({ error: 'Authentication failed', details: message });
    }
  });

  // POST /api/auth/send-otp  (new: uses tempToken instead of electionId)
  router.post('/send-otp', otpLimit, async (req: Request, res: Response) => {
    const { email: rawEmail, tempToken } = req.body as { email?: string; tempToken?: string };

    if (!rawEmail || !tempToken) {
      res.status(400).json({ error: 'Missing email or tempToken' });
      return;
    }
    const email = normalizeEmail(rawEmail);

    let walletAddress: string;
    try {
      const payload = verifyTempToken(tempToken);
      walletAddress = payload.walletAddress;
    } catch {
      res.status(401).json({ error: 'Invalid or expired session' });
      return;
    }

    const walletUser = await prisma.user.findUnique({ where: { walletAddress } });
    if (walletUser?.isBanned) {
      res.status(403).json(ACCOUNT_BANNED_RESPONSE);
      return;
    }

    // Block if email is already verified by a different wallet
    const existingEmailOwner = await prisma.user.findUnique({ where: { email } });
    if (existingEmailOwner?.isBanned) {
      res.status(403).json(ACCOUNT_BANNED_RESPONSE);
      return;
    }
    if (existingEmailOwner && existingEmailOwner.emailVerified && existingEmailOwner.walletAddress !== walletAddress) {
      res.status(409).json({ error: 'Email này đã được xác thực bởi một ví khác' });
      return;
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60_000);

    try {
      // Delete any existing unexpired OTP for this email before creating a new one
      await prisma.otpSession.deleteMany({
        where: { email, expiresAt: { gt: new Date() } },
      });
      await prisma.otpSession.create({ data: { email, otpHash: hashOtp(email, otpCode), expiresAt } });
      // sendOtpEmail never throws — it falls back to mock mode on SMTP failure
      const mode = await sendOtpEmail(email, otpCode);
      res.json({
        message: mode === 'smtp' ? 'OTP sent to email' : 'OTP generated (check server console)',
        deliveryMode: mode,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: 'Failed to create OTP session', details: message });
    }
  });

  // POST /api/auth/verify-otp  (new: wallet-based, issues JWT)
  router.post('/verify-otp', otpLimit, async (req: Request, res: Response) => {
    const { email: rawEmail, otpCode, tempToken } = req.body as {
      email?: string;
      otpCode?: string;
      tempToken?: string;
    };

    if (!rawEmail || !otpCode || !tempToken) {
      res.status(400).json({ error: 'Missing email, otpCode, or tempToken' });
      return;
    }
    const email = normalizeEmail(rawEmail);

    try {
      // Validate temp token
      let walletAddress: string;
      try {
        const payload = verifyTempToken(tempToken);
        walletAddress = payload.walletAddress;
      } catch {
        res.status(401).json({ error: 'Invalid or expired session' });
        return;
      }

      const walletUser = await prisma.user.findUnique({ where: { walletAddress } });
      if (walletUser?.isBanned) {
        res.status(403).json(ACCOUNT_BANNED_RESPONSE);
        return;
      }

      // Verify OTP
      const session = await prisma.otpSession.findFirst({
        where: { email, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
      });

      if (!session || session.attempts >= OTP_MAX_ATTEMPTS || !verifyOtpHash(email, otpCode, session.otpHash)) {
        if (session) {
          await prisma.otpSession.update({
            where: { id: session.id },
            data: { attempts: { increment: 1 } },
          });
        }
        res.status(400).json({ error: 'OTP không hợp lệ hoặc đã hết hạn' });
        return;
      }

      await prisma.otpSession.delete({ where: { id: session.id } });

      // Block if email is already verified by a different wallet
      const existingEmailOwner = await prisma.user.findUnique({ where: { email } });
      if (existingEmailOwner?.isBanned) {
        res.status(403).json(ACCOUNT_BANNED_RESPONSE);
        return;
      }
      if (existingEmailOwner && existingEmailOwner.walletAddress !== walletAddress && existingEmailOwner.emailVerified) {
        res.status(409).json({ error: 'Email này đã được xác thực bởi một ví khác' });
        return;
      }

      const role = isAdminWallet(walletAddress) ? 'admin' : 'user';
      const user = await prisma.user.upsert({
        where: { walletAddress },
        update: { email, emailVerified: true, isVerified: true, role },
        create: {
          walletAddress,
          email,
          emailVerified: true,
          isVerified: true,
          role,
          name: 'Unknown User',
        },
      });
      try {
        const tx = await getContract?.().setVoterStatus(walletAddress, true, false);
        await tx?.wait();
      } catch (chainErr) {
        console.warn(
          '[auth] Could not sync voter eligibility on-chain:',
          chainErr instanceof Error ? chainErr.message : String(chainErr)
        );
      }

      await prisma.log.create({
        data: {
          action: 'EMAIL_VERIFIED',
          description: `${walletAddress} verified email ${email}`,
        },
      });

      const token = signToken({ userId: user.id, walletAddress, role });

      res.json({
        token,
        user: {
          id: user.id,
          name: user.name,
          walletAddress: user.walletAddress,
          role: user.role,
          emailVerified: user.emailVerified,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: 'Verification failed', details: message });
    }
  });

  // POST /api/auth/logout
  router.post('/logout', async (_req: Request, res: Response) => {
    // JWT is stateless; client drops the token.
    // If session tracking is needed, delete from Session table here.
    res.json({ message: 'Logged out successfully' });
  });

  return router;
}
