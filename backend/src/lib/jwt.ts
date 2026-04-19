import jwt from 'jsonwebtoken';

export interface JwtPayload {
  userId: number;
  walletAddress: string;
  role: string;
}

function getSecret(): string {
  const secret = process.env['JWT_SECRET'];
  if (!secret) throw new Error('JWT_SECRET is not set');
  return secret;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, getSecret(), { expiresIn: '24h' });
}

export function signTempToken(payload: { walletAddress: string }): string {
  return jwt.sign({ ...payload, temp: true }, getSecret(), { expiresIn: '10m' });
}

export function verifyToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, getSecret());
  if (typeof decoded !== 'object' || !decoded || !('userId' in decoded)) {
    throw new Error('Invalid token payload');
  }
  return decoded as JwtPayload;
}

export function verifyTempToken(token: string): { walletAddress: string } {
  const decoded = jwt.verify(token, getSecret());
  if (
    typeof decoded !== 'object' ||
    !decoded ||
    !('walletAddress' in decoded) ||
    !('temp' in decoded)
  ) {
    throw new Error('Invalid temp token');
  }
  return decoded as { walletAddress: string };
}
