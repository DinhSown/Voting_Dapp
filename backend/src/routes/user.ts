import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { ethers } from 'ethers';
import type { AuthRequest } from '../types';

function formatUserDisplayName(name: string | null, walletAddress: string): string {
  const trimmed = name?.trim();
  if (trimmed && trimmed !== 'Unknown User') return trimmed;
  return `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
}

type VoteEventData = {
  electionOnChainId: number;
  candidateOnChainId: number;
  voter: string;
};

export function createUserRouter(
  prisma: PrismaClient,
  provider: ethers.Provider,
  contractAddress: string,
  contractABI: ethers.InterfaceAbi,
  getContract?: () => ethers.Contract
) {
  const router = Router();
  const contractInterface = new ethers.Interface(contractABI);

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
  router.post('/sync-eligibility', async (req: AuthRequest, res: Response) => {
    if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }
    if (!getContract) { res.status(500).json({ error: 'Contract sync is not configured' }); return; }

    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: {
          walletAddress: true,
          emailVerified: true,
          isBanned: true,
        },
      });

      if (!user?.walletAddress) {
        res.status(400).json({ error: 'User wallet is not linked' });
        return;
      }

      const eligible = user.emailVerified && !user.isBanned;
      const contract = getContract();
      const [onChainEligible, onChainBanned] = await Promise.all([
        contract.isEligible(user.walletAddress) as Promise<boolean>,
        contract.isBanned(user.walletAddress) as Promise<boolean>,
      ]);

      let updated = false;

      if (onChainEligible !== eligible) {
        const eligibleTx = await contract.setVoterEligible(user.walletAddress, eligible) as ethers.TransactionResponse;
        await eligibleTx.wait();
        updated = true;
      }

      if (onChainBanned !== user.isBanned) {
        const bannedTx = await contract.setVoterBanned(user.walletAddress, user.isBanned) as ethers.TransactionResponse;
        await bannedTx.wait();
        updated = true;
      }

      res.json({
        walletAddress: user.walletAddress,
        eligible,
        isBanned: user.isBanned,
        updated,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: 'Failed to sync user eligibility', details: message });
    }
  });

  router.post('/vote', async (req: AuthRequest, res: Response) => {
    if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }

    const { txHash } = req.body as {
      txHash?: string;
    };

    if (!txHash || !ethers.isHexString(txHash, 32)) {
      res.status(400).json({ error: 'Valid txHash is required' });
      return;
    }
    if (!contractAddress || !ethers.isAddress(contractAddress)) {
      res.status(500).json({ error: 'Contract address is not configured' });
      return;
    }

    try {
      const [user, receipt, tx] = await Promise.all([
        prisma.user.findUnique({
          where: { id: req.user.userId },
          select: { name: true, walletAddress: true },
        }),
        provider.getTransactionReceipt(txHash),
        provider.getTransaction(txHash),
      ]);

      if (!user?.walletAddress) {
        res.status(400).json({ error: 'User wallet is not linked' });
        return;
      }
      if (!receipt || !tx) {
        res.status(409).json({ error: 'Transaction is not confirmed yet' });
        return;
      }
      if (receipt.status !== 1) {
        res.status(400).json({ error: 'Transaction failed on blockchain' });
        return;
      }
      if (tx.to?.toLowerCase() !== contractAddress.toLowerCase()) {
        res.status(400).json({ error: 'Transaction was not sent to the voting contract' });
        return;
      }
      if (tx.from.toLowerCase() !== user.walletAddress.toLowerCase()) {
        res.status(403).json({ error: 'Transaction sender does not match logged-in wallet' });
        return;
      }

      let voteEvent: VoteEventData | null = null;
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== contractAddress.toLowerCase()) continue;
        try {
          const parsed = contractInterface.parseLog({ topics: [...log.topics], data: log.data });
          if (!parsed || parsed.name !== 'Voted') continue;
          const eventVoter = String(parsed.args[2]).toLowerCase();
          if (eventVoter !== user.walletAddress.toLowerCase()) continue;
          voteEvent = {
            electionOnChainId: Number(parsed.args[0] as bigint),
            candidateOnChainId: Number(parsed.args[1] as bigint),
            voter: eventVoter,
          };
          break;
        } catch {
          continue;
        }
      }

      if (!voteEvent) {
        res.status(400).json({ error: 'Transaction does not contain the expected vote event' });
        return;
      }

      const election = await prisma.election.findFirst({
        where: { onChainId: voteEvent.electionOnChainId },
        include: {
          candidates: {
            where: { onChainId: voteEvent.candidateOnChainId, isRemoved: false },
            take: 1,
          },
        },
      });
      if (!election) {
        res.status(400).json({ error: 'Vote event election is not registered in database' });
        return;
      }
      const candidate = election.candidates[0];
      if (!candidate) {
        res.status(400).json({ error: 'Vote event candidate is not registered in database' });
        return;
      }

      const vote = await prisma.vote.upsert({
        where: { userId_categoryId: { userId: req.user.userId, categoryId: election.id } },
        update: {
          candidateId: candidate.id,
          candidateName: candidate.name,
          categoryTitle: election.title,
          txHash,
        },
        create: {
          userId: req.user.userId,
          categoryId: election.id,
          candidateId: candidate.id,
          candidateName: candidate.name,
          categoryTitle: election.title,
          txHash,
        },
      });

      await prisma.log.create({
        data: {
          action: 'USER_VOTED',
          description: `${formatUserDisplayName(user.name, user.walletAddress)} voted in election "${election.title}" (tx: ${txHash})`,
        },
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
