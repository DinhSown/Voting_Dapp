import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

export function generateNonceValue(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function buildNonceMessage(nonce: string): string {
  return `Sign this message to authenticate with meChoice.\n\nNonce: ${nonce}`;
}

export async function createNonce(
  prisma: PrismaClient,
  walletAddress: string
): Promise<string> {
  // Clean up expired nonces for this wallet
  await prisma.authNonce.deleteMany({
    where: { walletAddress: walletAddress.toLowerCase(), expiresAt: { lt: new Date() } },
  });

  const nonce = generateNonceValue();
  const expiresAt = new Date(Date.now() + 5 * 60_000); // 5 minutes

  await prisma.authNonce.create({
    data: { walletAddress: walletAddress.toLowerCase(), nonce, expiresAt },
  });

  return nonce;
}

export async function consumeNonce(
  prisma: PrismaClient,
  walletAddress: string,
  nonce: string
): Promise<boolean> {
  const record = await prisma.authNonce.findFirst({
    where: {
      walletAddress: walletAddress.toLowerCase(),
      nonce,
      expiresAt: { gt: new Date() },
    },
  });

  if (!record) return false;

  await prisma.authNonce.delete({ where: { id: record.id } });
  return true;
}
