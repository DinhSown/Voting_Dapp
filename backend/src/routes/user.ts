import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { ethers } from 'ethers';
import type { AuthRequest } from '../types';

export function createUserRouter(prisma: PrismaClient, provider: ethers.JsonRpcProvider) {
  const router = Router();

  // GET /api/user/profile
  router.get('/profile', async (req: AuthRequest, res: Response) => {
    if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }

    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: {
          id: true,
          name: true,
          walletAddress: true,
          email: true,
          role: true,
          emailVerified: true,
          isBanned: true,
          createdAt: true,
        },
      });

      if (!user) { res.status(404).json({ error: 'User not found' }); return; }

      // Fetch on-chain balance
      let balance: string | null = null;
      if (user.walletAddress) {
        try {
          const raw = await provider.getBalance(user.walletAddress);
          balance = ethers.formatEther(raw); // returns balance in ROSE/ETH
        } catch {
          balance = null;
        }
      }

      res.json({ ...user, balance });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: 'Failed to fetch profile', details: message });
    }
  });

  // POST /api/user/vote — record a vote after on-chain submission
  router.post('/vote', async (req: AuthRequest, res: Response) => {
    if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }

    const { categoryId, candidateId, candidateName, categoryTitle, txHash } = req.body as {
      categoryId?: number;
      candidateId?: number;
      candidateName?: string;
      categoryTitle?: string;
      txHash?: string;
    };

    if (!categoryId || !candidateId) {
      res.status(400).json({ error: 'categoryId and candidateId are required' });
      return;
    }

    try {
      const vote = await prisma.vote.upsert({
        where: { userId_categoryId: { userId: req.user.userId, categoryId } },
        update: { candidateId, candidateName: candidateName ?? '', categoryTitle: categoryTitle ?? '', txHash: txHash ?? null },
        create: { userId: req.user.userId, categoryId, candidateId, candidateName: candidateName ?? '', categoryTitle: categoryTitle ?? '', txHash: txHash ?? null },
      });
      res.json(vote);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: 'Failed to record vote', details: message });
    }
  });

  // GET /api/user/votes — fetch vote history for the logged-in user
  router.get('/votes', async (req: AuthRequest, res: Response) => {
    if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }

    try {
      const votes = await prisma.vote.findMany({
        where: { userId: req.user.userId },
        orderBy: { votedAt: 'desc' },
      });
      res.json(votes);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: 'Failed to fetch vote history', details: message });
    }
  });

  // PATCH /api/user/profile
  router.patch('/profile', async (req: AuthRequest, res: Response) => {
    if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }

    const { name } = req.body as { name?: string };
    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: 'name is required' });
      return;
    }

    const trimmed = name.trim();
    if (trimmed.length < 1 || trimmed.length > 50) {
      res.status(400).json({ error: 'Name must be 1-50 characters' });
      return;
    }

    try {
      const user = await prisma.user.update({
        where: { id: req.user.userId },
        data: { name: trimmed },
        select: { id: true, name: true, walletAddress: true, role: true },
      });
      res.json(user);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: 'Failed to update profile', details: message });
    }
  });

  return router;
}
