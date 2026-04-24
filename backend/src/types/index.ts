import type { Request } from 'express';

export interface AuthUser {
  userId: number;
  walletAddress: string;
  role: string;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}
