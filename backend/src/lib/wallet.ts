import { ethers } from 'ethers';
import { buildNonceMessage } from './nonce';

/**
 * Verifies a personal_sign (EIP-191) signature.
 * Returns true if the recovered address matches the claimed wallet address.
 */
export function verifyWalletSignature(
  walletAddress: string,
  signature: string,
  nonce: string
): boolean {
  try {
    const message = buildNonceMessage(nonce);
    const recovered = ethers.verifyMessage(message, signature);
    return recovered.toLowerCase() === walletAddress.toLowerCase();
  } catch {
    return false;
  }
}

export function isAdminWallet(walletAddress: string): boolean {
  const adminWallet = process.env['ADMIN_WALLET'];
  if (!adminWallet) return false;
  return walletAddress.toLowerCase() === adminWallet.toLowerCase();
}
