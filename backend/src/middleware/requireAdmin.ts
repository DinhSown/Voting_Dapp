import type { Response, NextFunction } from 'express';
import { isAdminWallet } from '../lib/wallet';
import type { AuthRequest } from '../types';

export function requireAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  // Double-check wallet against env var — never trust JWT role alone
  if (!isAdminWallet(req.user.walletAddress)) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  next();
}
