import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { ethers } from 'ethers';
import type { AuthRequest } from '../types';

export function createAdminRouter(
  prisma: PrismaClient,
  getContract: () => ethers.Contract
) {
  const router = Router();

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
              if (parsed && (parsed.name === 'ElectionCreated' || parsed.name === 'CandidateAdded')) {
                // If it's ElectionCreated, arg[0] is electionId
                // If it's CandidateAdded, arg[1] is candidateId
                onChainId = parsed.name === 'ElectionCreated' ? Number(parsed.args[0]) : Number(parsed.args[1]);
                break;
              }
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
      } catch (chainErr) {
        const chainMsg = chainErr instanceof Error ? chainErr.message : String(chainErr);
        console.error('Chain error (election saved as draft):', chainMsg);
        // Return election without onChainId — it's a draft
        res.status(201).json({ ...election, pushedToChain: false, chainError: chainMsg });
      }
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
      const results: { id: number; name: string; onChainId: number }[] = [];

      for (const cand of election.candidates) {
        const tx = await contract.addCandidate(election.onChainId) as ethers.TransactionResponse;
        const receipt = await tx.wait();
        let candOnChainId: number | null = null;
        if (receipt?.logs) {
          for (const log of receipt.logs) {
            try {
              const parsed = contract.interface.parseLog({ topics: [...log.topics], data: log.data });
              if (parsed?.name === 'CandidateAdded') { candOnChainId = Number(parsed.args[1]); break; }
            } catch { /* skip */ }
          }
        }
        if (candOnChainId === null) {
          throw new Error(`Failed to parse CandidateAdded event for candidate "${cand.name}"`);
        }
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

      // 1. Create election on chain
      const tx1 = await contract.createElection() as ethers.TransactionResponse;
      const receipt1 = await tx1.wait();

      let onChainId: number | null = null;
      if (receipt1?.logs) {
        const iface = contract.interface;
        for (const log of receipt1.logs) {
          try {
            const parsed = iface.parseLog(log as any);
            if (parsed?.name === 'ElectionCreated') { 
              onChainId = Number(parsed.args[0]); 
              break; 
            }
          } catch {
            const eventHash = iface.getEvent('ElectionCreated')?.topicHash;
            if (log.topics[0] === eventHash && log.topics.length > 1) {
              onChainId = Number(ethers.toBigInt(log.topics[1]));
              break;
            }
          }
        }
      }
      if (onChainId === null) {
        res.status(500).json({ error: 'Không thể đọc onChainId từ event' });
        return;
      }

      await prisma.election.update({ where: { id }, data: { onChainId } });

      // 2. Add each candidate on chain
      for (const cand of election.candidates) {
        const tx2 = await contract.addCandidate(onChainId) as ethers.TransactionResponse;
        const receipt2 = await tx2.wait();
        let candOnChainId: number | null = null;
        if (receipt2?.logs) {
          const iface = contract.interface;
          for (const log of receipt2.logs) {
            try {
              const parsed = iface.parseLog(log as any);
              if (parsed?.name === 'CandidateAdded') { 
                candOnChainId = Number(parsed.args[1]); 
                break; 
              }
            } catch {
              const eventHash = iface.getEvent('CandidateAdded')?.topicHash;
              if (log.topics[0] === eventHash && log.topics.length > 2) {
                // CandidateAdded(uint256 indexed electionId, uint256 indexed candidateId)
                // topic1 is electionId, topic2 is candidateId
                candOnChainId = Number(ethers.toBigInt(log.topics[2]));
                break;
              }
            }
          }
        }
        if (candOnChainId === null) {
          throw new Error(`Failed to parse CandidateAdded event for candidate "${cand.name}"`);
        }
        await prisma.candidate.update({ where: { id: cand.id }, data: { onChainId: candOnChainId } });
      }

      // 3. Start election on chain
      const tx3 = await contract.startElection(onChainId) as ethers.TransactionResponse;
      await tx3.wait();

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
          const tx = await contract.addCandidate(election.onChainId) as ethers.TransactionResponse;
          const receipt = await tx.wait();

          let onChainId: number | null = null;
          if (receipt?.logs) {
            const iface = contract.interface;
            for (const log of receipt.logs) {
              try {
                const parsed = iface.parseLog(log as any);
                if (parsed?.name === 'CandidateAdded') {
                  onChainId = Number(parsed.args[1]);
                  break;
                }
              } catch {
                const eventHash = iface.getEvent('CandidateAdded')?.topicHash;
                if (log.topics[0] === eventHash && log.topics.length > 2) {
                  onChainId = Number(ethers.toBigInt(log.topics[2]));
                  break;
                }
              }
            }
          }

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
            phone: true,
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
        select: { id: true, name: true, walletAddress: true, isBanned: true },
      });

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
