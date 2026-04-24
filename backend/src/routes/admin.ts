import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { ethers } from 'ethers';
import type { AuthRequest } from '../types';

const VOTER_SYNC_BATCH_SIZE = 50;

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function parseElectionCreatedId(contract: ethers.Contract, receipt: ethers.TransactionReceipt | null): number | null {
  if (!receipt?.logs) return null;
  const iface = contract.interface;

  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log as any);
      if (parsed?.name === 'ElectionCreated') return Number(parsed.args[0]);
    } catch {
      const eventHash = iface.getEvent('ElectionCreated')?.topicHash;
      if (log.topics[0] === eventHash && log.topics.length > 1) {
        return Number(ethers.toBigInt(log.topics[1]));
      }
    }
  }

  return null;
}

function parseCandidateAddedIds(contract: ethers.Contract, receipt: ethers.TransactionReceipt | null): number[] {
  if (!receipt?.logs) return [];
  const ids: number[] = [];
  const iface = contract.interface;

  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log as any);
      if (parsed?.name === 'CandidateAdded') ids.push(Number(parsed.args[1]));
    } catch {
      const eventHash = iface.getEvent('CandidateAdded')?.topicHash;
      if (log.topics[0] === eventHash && log.topics.length > 2) {
        ids.push(Number(ethers.toBigInt(log.topics[2])));
      }
    }
  }

  return ids;
}

async function addCandidatesOnChain(
  contract: ethers.Contract,
  electionOnChainId: number,
  count: number
): Promise<number[]> {
  const contractWithOptionalBatch = contract as ethers.Contract & {
    addCandidates?: (electionId: number, count: number) => Promise<ethers.TransactionResponse>;
    addCandidate?: (electionId: number) => Promise<ethers.TransactionResponse>;
  };

  if (typeof contractWithOptionalBatch.addCandidates === 'function') {
    const tx = await contractWithOptionalBatch.addCandidates(electionOnChainId, count);
    const receipt = await tx.wait();
    const ids = parseCandidateAddedIds(contract, receipt);
    if (ids.length === count) return ids;
  }

  if (typeof contractWithOptionalBatch.addCandidate !== 'function') {
    throw new Error('Contract does not support addCandidate/addCandidates');
  }

  const ids: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const tx = await contractWithOptionalBatch.addCandidate(electionOnChainId);
    const receipt = await tx.wait();
    const parsedIds = parseCandidateAddedIds(contract, receipt);
    const id = parsedIds[0];
    if (id === undefined) {
      throw new Error('Failed to parse CandidateAdded event');
    }
    ids.push(id);
  }

  return ids;
}

export function createAdminRouter(
  prisma: PrismaClient,
  getContract: () => ethers.Contract,
  getVoteSyncState?: () => { lastSyncedBlock: number; updatedAt: string } | null
) {
  const router = Router();

  router.get('/on-chain/status', async (_req: AuthRequest, res: Response) => {
    try {
      const contract = getContract();
      const address = await contract.getAddress();
      const runner = contract.runner as ethers.ContractRunner & {
        getAddress?: () => Promise<string>;
        provider?: ethers.Provider | null;
      };

      const [owner, electionCount, dbElections, dbVerifiedUsers, dbEligibleUsers] = await Promise.all([
        contract.owner() as Promise<string>,
        contract.electionCount() as Promise<bigint>,
        prisma.election.count({ where: { onChainId: { not: null } } }),
        prisma.user.count({ where: { emailVerified: true, walletAddress: { not: null } } }),
        prisma.user.count({ where: { emailVerified: true, isBanned: false, walletAddress: { not: null } } }),
      ]);

      const signerAddress = runner.getAddress ? await runner.getAddress() : null;
      const code = runner.provider ? await runner.provider.getCode(address) : '0x';

      const voteSyncState = getVoteSyncState?.() ?? null;

      res.json({
        address,
        owner,
        signerAddress,
        signerIsOwner: signerAddress ? signerAddress.toLowerCase() === owner.toLowerCase() : false,
        codeExists: code !== '0x',
        electionCount: Number(electionCount),
        dbElections,
        dbVerifiedUsers,
        dbEligibleUsers,
        lastVoteSyncBlock: voteSyncState?.lastSyncedBlock ?? null,
        lastVoteSyncAt: voteSyncState?.updatedAt ?? null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: 'Failed to fetch on-chain status', details: message });
    }
  });

  router.post('/sync-eligible-users', async (_req: AuthRequest, res: Response) => {
    try {
      const contract = getContract();
      const users = await prisma.user.findMany({
        where: { emailVerified: true, walletAddress: { not: null } },
        select: { id: true, walletAddress: true, isBanned: true, emailVerified: true },
        orderBy: { id: 'asc' },
      });

      let eligibleSynced = 0;
      let bannedSynced = 0;
      let batchesSynced = 0;
      const errors: Array<{ userId: number; walletAddress: string; error: string }> = [];

      for (const batch of chunkArray(users, VOTER_SYNC_BATCH_SIZE)) {
        try {
          const voters = batch.map((user) => user.walletAddress).filter((wallet): wallet is string => !!wallet);
          const eligibleList = batch.map((user) => user.emailVerified && !user.isBanned);
          const bannedList = batch.map((user) => user.isBanned);

          if (voters.length !== batch.length) {
            for (const user of batch) {
              if (!user.walletAddress) {
                errors.push({ userId: user.id, walletAddress: '', error: 'Wallet address is missing' });
              }
            }
            continue;
          }

          const tx = await contract.setManyVoterStatus(voters, eligibleList, bannedList) as ethers.TransactionResponse;
          await tx.wait();

          batchesSynced += 1;
          eligibleSynced += batch.filter((user) => user.emailVerified && !user.isBanned).length;
          bannedSynced += batch.filter((user) => user.isBanned).length;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          for (const user of batch) {
            errors.push({
              userId: user.id,
              walletAddress: user.walletAddress ?? '',
              error: message,
            });
          }
        }
      }

      res.json({
        total: users.length,
        eligibleSynced,
        bannedSynced,
        batchesSynced,
        failed: errors.length,
        errors,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: 'Failed to sync eligible users', details: message });
    }
  });

  // ─── Elections ───────────────────────────────────────────────────

  // GET /api/admin/elections
  router.get('/elections', async (_req: AuthRequest, res: Response) => {
    try {
      const elections = await prisma.election.findMany({
        include: { candidates: { where: { isRemoved: false } } },
        orderBy: { createdAt: 'desc' },
      });
      res.json({ data: elections, total: elections.length });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: 'Failed to fetch elections', details: message });
    }
  });

  // POST /api/admin/elections
  router.post('/elections', async (req: AuthRequest, res: Response) => {
    const { title, description, startTime, endTime } = req.body as {
      title?: string;
      description?: string;
      startTime?: string;
      endTime?: string;
    };

    if (!title || !title.trim()) {
      res.status(400).json({ error: 'Election title is required' });
      return;
    }

    try {
      // Create in DB as draft first
      const election = await prisma.election.create({
        data: {
          title: title.trim(),
          description: description?.trim() ?? '',
          startTime: startTime ? new Date(startTime) : null,
          endTime: endTime ? new Date(endTime) : null,
        },
      });

      res.status(201).json({ ...election, pushedToChain: false });
      return;

      /*
      // Push to chain
      try {
        const contract = getContract();
        const tx = await contract.createElection() as ethers.TransactionResponse;
        const receipt = await tx.wait();
        // Extract onChainId from event logs if available, otherwise use election.id
        let onChainId: number | null = null;
        if (receipt && receipt.logs) {
          const iface = contract.interface;
          for (const log of receipt.logs) {
            try {
              // Try parsing the log directly
              const parsed = iface.parseLog(log as any);
              if (!parsed) continue;
              if (parsed.name !== 'ElectionCreated' && parsed.name !== 'CandidateAdded') continue;
              onChainId = parsed.name === 'ElectionCreated' ? Number(parsed.args[0]) : Number(parsed.args[1]);
              break;
            } catch (e) {
              // If direct parsing fails, try manual match for standard nodes
              // ElectionCreated(uint256 electionId) -> topic0 is hash, topic1 is electionId (indexed)
              const eventHash = iface.getEvent('ElectionCreated')?.topicHash;
              if (log.topics[0] === eventHash && log.topics.length > 1) {
                onChainId = Number(ethers.toBigInt(log.topics[1]));
                break;
              }
            }
          }
        }

        await prisma.election.update({
          where: { id: election.id },
          data: { onChainId: onChainId ?? election.id },
        });

        res.status(201).json({ ...election, onChainId: onChainId ?? election.id, pushedToChain: true });
      } catch (chainErr: unknown) {
        const chainMsg = chainErr instanceof Error ? chainErr.message : String(chainErr);
        console.error('Chain error (election saved as draft):', chainMsg);
        // Return election without onChainId — it's a draft
        res.status(201).json({ ...election, pushedToChain: false, chainError: chainMsg });
      }
      */
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: 'Failed to create election', details: message });
    }
  });

  // PATCH /api/admin/elections/:id
  router.patch('/elections/:id', async (req: AuthRequest, res: Response) => {
    const id = parseInt(String(req.params['id'] ?? ''), 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid election id' }); return; }

    const { title, description, startTime, endTime } = req.body as {
      title?: string;
      description?: string;
      startTime?: string;
      endTime?: string;
    };

    try {
      const election = await prisma.election.update({
        where: { id },
        data: {
          ...(title !== undefined && title.trim() && { title: title.trim() }),
          ...(description !== undefined && { description: description.trim() }),
          ...(startTime !== undefined && { startTime: startTime ? new Date(startTime) : null }),
          ...(endTime !== undefined && { endTime: endTime ? new Date(endTime) : null }),
        },
      });
      res.json(election);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: 'Failed to update election', details: message });
    }
  });

  // DELETE /api/admin/elections/:id
  router.delete('/elections/:id', async (req: AuthRequest, res: Response) => {
    const id = parseInt(String(req.params['id'] ?? ''), 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid election id' }); return; }

    try {
      const election = await prisma.election.findUnique({ where: { id } });
      if (!election) { res.status(404).json({ error: 'Election not found' }); return; }
      if (election.isActive) {
        res.status(400).json({ error: 'Cannot delete an active election' });
        return;
      }

      // Delete candidates first (no cascade in schema), then election
      await prisma.candidate.deleteMany({ where: { electionId: id } });
      await prisma.election.delete({ where: { id } });
      res.json({ message: 'Election deleted' });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: 'Failed to delete election', details: message });
    }
  });

  // POST /api/admin/elections/:id/sync-candidates
  // Retry syncing candidates that are in DB (onChainId = null) for an already on-chain election
  router.post('/elections/:id/sync-candidates', async (req: AuthRequest, res: Response) => {
    const id = parseInt(String(req.params['id'] ?? ''), 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid election id' }); return; }

    try {
      const election = await prisma.election.findUnique({
        where: { id },
        include: { candidates: { where: { isRemoved: false, onChainId: null }, orderBy: { id: 'asc' } } },
      });
      if (!election) { res.status(404).json({ error: 'Election not found' }); return; }
      if (election.onChainId === null) {
        res.status(400).json({ error: 'Election not on chain yet — use push-to-chain first' });
        return;
      }
      if (election.candidates.length === 0) {
        res.json({ synced: 0, message: 'All candidates already on chain' });
        return;
      }

      const contract = getContract();
      const candidateIds = await addCandidatesOnChain(contract, election.onChainId, election.candidates.length);

      const results: { id: number; name: string; onChainId: number }[] = [];
      for (const [index, cand] of election.candidates.entries()) {
        const candOnChainId = candidateIds[index];
        await prisma.candidate.update({ where: { id: cand.id }, data: { onChainId: candOnChainId } });
        results.push({ id: cand.id, name: cand.name, onChainId: candOnChainId });
      }

      res.json({ synced: results.length, candidates: results });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: 'Failed to sync candidates', details: message });
    }
  });

  // POST /api/admin/elections/:id/push-to-chain
  // Promote a draft election (onChainId = null) to the blockchain, then start it
  router.post('/elections/:id/push-to-chain', async (req: AuthRequest, res: Response) => {
    const id = parseInt(String(req.params['id'] ?? ''), 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid election id' }); return; }

    try {
      const election = await prisma.election.findUnique({
        where: { id },
        include: { candidates: { where: { isRemoved: false }, orderBy: { id: 'asc' } } },
      });
      if (!election) { res.status(404).json({ error: 'Election not found' }); return; }
      if (election.onChainId !== null) {
        res.status(400).json({ error: 'Election already on chain' });
        return;
      }
      if (election.candidates.length < 2) {
        res.status(400).json({ error: 'Cần ít nhất 2 ứng viên để đẩy lên chain' });
        return;
      }

      const contract = getContract();

      const tx1 = await contract.createElectionWithCandidates(election.candidates.length, true) as ethers.TransactionResponse;
      const receipt1 = await tx1.wait();

      const onChainId = parseElectionCreatedId(contract, receipt1);
      if (onChainId === null) {
        res.status(500).json({ error: 'Không thể đọc onChainId từ event' });
        return;
      }

      await prisma.election.update({ where: { id }, data: { onChainId } });

      const candidateIds = parseCandidateAddedIds(contract, receipt1);
      if (candidateIds.length !== election.candidates.length) {
        throw new Error('Failed to parse all CandidateAdded events for election');
      }
      for (const [index, cand] of election.candidates.entries()) {
        await prisma.candidate.update({ where: { id: cand.id }, data: { onChainId: candidateIds[index] } });
      }

      const updated = await prisma.election.update({
        where: { id },
        data: {
          isActive: true,
          startTime: election.startTime ?? new Date(),
        },
        include: { candidates: { where: { isRemoved: false } } },
      });

      res.json(updated);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: 'Failed to push election to chain', details: message });
    }
  });

  // POST /api/admin/elections/:id/start
  router.post('/elections/:id/start', async (req: AuthRequest, res: Response) => {
    const id = parseInt(String(req.params['id'] ?? ''), 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid election id' }); return; }

    try {
      const election = await prisma.election.findUnique({ where: { id } });
      if (!election) { res.status(404).json({ error: 'Election not found' }); return; }
      if (election.onChainId === null) {
        res.status(400).json({ error: 'Election not yet pushed to chain' });
        return;
      }

      const contract = getContract();
      const tx = await contract.startElection(election.onChainId) as ethers.TransactionResponse;
      await tx.wait();

      const updated = await prisma.election.update({
        where: { id },
        data: {
          isActive: true,
          startTime: election.startTime ?? new Date(),
        },
      });

      res.json(updated);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Start election error:', err);
      res.status(500).json({ 
        error: 'Failed to start election', 
        details: message,
        tip: message.includes('ECONNRESET') ? 'Lỗi mạng Blockchain, hãy nhấn Thử lại sau vài giây.' : undefined
      });
    }
  });

  // POST /api/admin/elections/:id/end
  router.post('/elections/:id/end', async (req: AuthRequest, res: Response) => {
    const id = parseInt(String(req.params['id'] ?? ''), 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid election id' }); return; }

    try {
      const election = await prisma.election.findUnique({ where: { id } });
      if (!election) { res.status(404).json({ error: 'Election not found' }); return; }
      if (!election.isActive) { res.status(400).json({ error: 'Election is not active' }); return; }

      const contract = getContract();
      const tx = await contract.endElection(election.onChainId) as ethers.TransactionResponse;
      await tx.wait();

      const updated = await prisma.election.update({
        where: { id },
        data: {
          isActive: false,
          endTime: new Date(),
        },
      });

      res.json(updated);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: 'Failed to end election', details: message });
    }
  });

  // ─── Candidates ──────────────────────────────────────────────────

  // POST /api/admin/elections/:id/candidates
  router.post('/elections/:id/candidates', async (req: AuthRequest, res: Response) => {
    const electionId = parseInt(String(req.params['id'] ?? ''), 10);
    if (isNaN(electionId)) { res.status(400).json({ error: 'Invalid election id' }); return; }

    const { name, description, image } = req.body as {
      name?: string;
      description?: string;
      image?: string;
    };

    if (!name || !name.trim()) {
      res.status(400).json({ error: 'Candidate name is required' });
      return;
    }

    try {
      const election = await prisma.election.findUnique({ where: { id: electionId } });
      if (!election) { res.status(404).json({ error: 'Election not found' }); return; }
      if (election.isActive) {
        res.status(400).json({ error: 'Cannot add candidates to an active election' });
        return;
      }

      const candidate = await prisma.candidate.create({
        data: {
          name: name.trim(),
          description: description?.trim() ?? '',
          image: image?.trim() ?? '',
          electionId,
        },
      });

      // Push to chain if election is on-chain
      if (election.onChainId !== null) {
        try {
          const contract = getContract();
          const onChainId = (await addCandidatesOnChain(contract, election.onChainId, 1))[0] ?? null;

          const syncedCandidate = await prisma.candidate.update({
            where: { id: candidate.id },
            data: { onChainId },
          });

          res.status(201).json({ ...syncedCandidate, pushedToChain: true });
        } catch (chainErr) {
          const chainMsg = chainErr instanceof Error ? chainErr.message : String(chainErr);
          try {
            await prisma.candidate.delete({ where: { id: candidate.id } });
          } catch (rollbackErr) {
            const rollbackMsg = rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr);
            res.status(500).json({
              error: 'Failed to add candidate on chain and rollback local record',
              details: chainMsg,
              rollbackError: rollbackMsg,
            });
            return;
          }

          res.status(502).json({
            error: 'Failed to add candidate on chain',
            details: chainMsg,
          });
        }
      } else {
        res.status(201).json({ ...candidate, pushedToChain: false });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: 'Failed to add candidate', details: message });
    }
  });

  // PATCH /api/admin/elections/:id/candidates/:cid
  router.patch('/elections/:id/candidates/:cid', async (req: AuthRequest, res: Response) => {
    const electionId = parseInt(String(req.params['id'] ?? ''), 10);
    const candidateId = parseInt(String(req.params['cid'] ?? ''), 10);
    if (isNaN(electionId) || isNaN(candidateId)) {
      res.status(400).json({ error: 'Invalid id' });
      return;
    }

    const { name, description, image } = req.body as {
      name?: string;
      description?: string;
      image?: string;
    };

    try {
      const election = await prisma.election.findUnique({ where: { id: electionId } });
      if (!election) { res.status(404).json({ error: 'Election not found' }); return; }
      
      // If the election is active or already on chain, we usually don't want to change metadata 
      // unless we also sync with blockchain. For simplicity, we only allow editing draft/inactive elections.
      if (election.isActive) {
        res.status(400).json({ error: 'Cannot edit candidates of an active election' });
        return;
      }

      const updated = await prisma.candidate.update({
        where: { id: candidateId },
        data: {
          ...(name !== undefined && { name: name.trim() }),
          ...(description !== undefined && { description: description.trim() }),
          ...(image !== undefined && { image: image.trim() }),
        },
      });

      res.json(updated);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: 'Failed to update candidate', details: message });
    }
  });

  // DELETE /api/admin/elections/:id/candidates/:cid
  router.delete('/elections/:id/candidates/:cid', async (req: AuthRequest, res: Response) => {
    const electionId = parseInt(String(req.params['id'] ?? ''), 10);
    const candidateId = parseInt(String(req.params['cid'] ?? ''), 10);
    if (isNaN(electionId) || isNaN(candidateId)) {
      res.status(400).json({ error: 'Invalid id' });
      return;
    }

    try {
      const election = await prisma.election.findUnique({ where: { id: electionId } });
      if (!election) { res.status(404).json({ error: 'Election not found' }); return; }
      if (election.isActive) {
        res.status(400).json({ error: 'Cannot remove candidates from an active election' });
        return;
      }

      await prisma.candidate.update({
        where: { id: candidateId },
        data: { isRemoved: true },
      });

      res.json({ message: 'Candidate removed' });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: 'Failed to remove candidate', details: message });
    }
  });

  // ─── Users ───────────────────────────────────────────────────────

  // GET /api/admin/users
  router.get('/users', async (req: AuthRequest, res: Response) => {
    try {
      const page = Math.max(1, parseInt(String(req.query['page'] ?? '1'), 10));
      const limit = Math.min(50, Math.max(1, parseInt(String(req.query['limit'] ?? '10'), 10)));
      const skip = (page - 1) * limit;
      const search = String(req.query['search'] ?? '').trim();

      const where = search
        ? {
            OR: [
              { walletAddress: { contains: search } },
              { email: { contains: search } },
              { name: { contains: search } },
            ],
          }
        : {};

      const [data, total] = await Promise.all([
        prisma.user.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            name: true,
            walletAddress: true,
            email: true,
            role: true,
            isBanned: true,
            emailVerified: true,
            isVerified: true,
            createdAt: true,
          },
        }),
        prisma.user.count({ where }),
      ]);

      res.json({ data, total, page, limit });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: 'Failed to fetch users', details: message });
    }
  });

  // PATCH /api/admin/users/:id  (ban/unban)
  router.patch('/users/:id', async (req: AuthRequest, res: Response) => {
    const id = parseInt(String(req.params['id'] ?? ''), 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid user id' }); return; }

    const { isBanned } = req.body as { isBanned?: boolean };
    if (typeof isBanned !== 'boolean') {
      res.status(400).json({ error: 'isBanned (boolean) is required' });
      return;
    }

    // Prevent self-ban
    if (req.user && req.user.userId === id) {
      res.status(400).json({ error: 'Cannot ban yourself' });
      return;
    }

    try {
      const user = await prisma.user.update({
        where: { id },
        data: { isBanned },
        select: { id: true, name: true, walletAddress: true, isBanned: true, emailVerified: true },
      });
      if (user.walletAddress) {
        try {
          const tx = await getContract().setVoterStatus(
            user.walletAddress,
            user.emailVerified && !isBanned,
            isBanned
          );
          await tx.wait();
        } catch (chainErr) {
          console.warn(
            '[admin] Could not sync voter ban on-chain:',
            chainErr instanceof Error ? chainErr.message : String(chainErr)
          );
        }
      }

      await prisma.log.create({
        data: {
          action: isBanned ? 'USER_BANNED' : 'USER_UNBANNED',
          description: `User ${user.walletAddress ?? user.id} ${isBanned ? 'banned' : 'unbanned'} by admin`,
        },
      });

      res.json(user);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: 'Failed to update user', details: message });
    }
  });

  // GET /api/admin/logs
  router.get('/logs', async (req: AuthRequest, res: Response) => {
    try {
      const page = Math.max(1, parseInt(String(req.query['page'] ?? '1'), 10));
      const limit = Math.min(50, Math.max(1, parseInt(String(req.query['limit'] ?? '10'), 10)));
      const skip = (page - 1) * limit;

      const [data, total] = await Promise.all([
        prisma.log.findMany({ skip, take: limit, orderBy: { timestamp: 'desc' } }),
        prisma.log.count(),
      ]);

      res.json({ data, total, page, limit });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: 'Failed to fetch logs', details: message });
    }
  });

  return router;
}
