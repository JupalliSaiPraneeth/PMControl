import { createHash, randomInt } from 'crypto';
import { db } from './dbStore.js';
import { config } from '../config/env.js';
import { Device } from '../types/index.js';

export class PairingService {
  // In-memory rate limiting map: ipOrKey -> { count: number, resetAt: number }
  private attemptCounts = new Map<string, { count: number; resetAt: number }>();

  // Hash code using SHA-256
  static hashCode(code: string): string {
    return createHash('sha256').update(code.trim()).digest('hex');
  }

  // Rate limit check
  checkRateLimit(key: string): boolean {
    const now = Date.now();
    const entry = this.attemptCounts.get(key);
    if (!entry || entry.resetAt < now) {
      this.attemptCounts.set(key, { count: 1, resetAt: now + config.RATE_LIMIT_WINDOW_MS });
      return true;
    }
    if (entry.count >= config.RATE_LIMIT_MAX_ATTEMPTS) {
      return false; // Rate limit exceeded
    }
    entry.count += 1;
    return true;
  }

  // Generate a cryptographically secure 6-digit numeric pairing code
  async createPairingCode(ownerId: string): Promise<{ code: string; expiresAt: string }> {
    // 6-digit code between 100000 and 999999
    const code = randomInt(100000, 1000000).toString();
    const codeHash = PairingService.hashCode(code);

    const pairingReq = await db.createPairingRequest(
      ownerId,
      codeHash,
      config.PAIRING_CODE_TTL_SECONDS
    );

    return {
      code,
      expiresAt: pairingReq.expiresAt,
    };
  }

  // Validate code and register the device under the owner account
  async completePairing(
    code: string,
    deviceInfo: { displayName: string; appVersion?: string },
    clientKey: string
  ): Promise<{ success: boolean; device?: Device; error?: string }> {
    if (!this.checkRateLimit(clientKey)) {
      return { success: false, error: 'Too many failed attempts. Please try again later.' };
    }

    const codeHash = PairingService.hashCode(code);
    const pairingReq = await db.findValidPairingByHash(codeHash);

    if (!pairingReq) {
      return { success: false, error: 'Invalid or expired pairing code.' };
    }

    // Mark code as consumed immediately so it cannot be reused
    await db.markPairingConsumed(pairingReq.id);

    // Create device linked to the pairing owner
    const newDevice = await db.createDevice({
      ownerId: pairingReq.ownerId,
      displayName: deviceInfo.displayName,
      platform: 'android',
      appVersion: deviceInfo.appVersion || '1.0.0',
    });

    return { success: true, device: newDevice };
  }
}

export const pairingService = new PairingService();
