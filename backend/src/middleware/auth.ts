import type { Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { verifyToken } from '../lib/jwt';
import type { AuthRequest } from '../types';

export function createAuthMiddleware(prisma: PrismaClient) {
  return async function auth(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid Authorization header' });
      return;
    }

    const token = authHeader.slice(7);
    try {
      const payload = verifyToken(token);

      const user = await prisma.user.findUnique({ where: { id: payload.userId } });
      if (!user) {
        res.status(401).json({ error: 'User not found' });
        return;
      }
      if (user.isBanned) {
        res.status(403).json({ error: 'Account is banned' });
        return;
      }

      req.user = {
        userId: payload.userId,
        walletAddress: payload.walletAddress,
        role: payload.role,
      };
      next();
    } catch {
      res.status(401).json({ error: 'Invalid or expired token' });
    }
  };
}
