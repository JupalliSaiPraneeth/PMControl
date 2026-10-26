import crypto from 'crypto';
import { config } from '../config/env.js';

export interface RTCIceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export class IceService {
  /**
   * Generates a compliant list of RTCIceServer objects for WebRTC peer connections.
   * Supports standard STUN servers and TURN servers with either static credentials
   * or standard HMAC-SHA1 ephemeral short-lived credentials (coturn / RFC 5766).
   */
  getIceServers(userId?: string): RTCIceServerConfig[] {
    const iceServers: RTCIceServerConfig[] = [];

    // 1. STUN Servers (support multiple comma-separated URLs)
    const stunUrls = config.STUN_SERVER_URL.split(',')
      .map((u) => u.trim())
      .filter(Boolean);

    if (stunUrls.length > 0) {
      iceServers.push({ urls: stunUrls });
    }

    // 2. TURN Server Configuration
    if (config.TURN_SERVER_URL) {
      const turnUrls = config.TURN_SERVER_URL.split(',')
        .map((u) => u.trim())
        .filter(Boolean);

      if (config.TURN_SECRET) {
        // Ephemeral HMAC-SHA1 TURN credentials (TTL = 1 hour)
        const ttlSeconds = 3600;
        const expiry = Math.floor(Date.now() / 1000) + ttlSeconds;
        const username = `${expiry}:${userId || 'omnicontrol-peer'}`;
        const hmac = crypto.createHmac('sha1', config.TURN_SECRET);
        hmac.update(username);
        const credential = hmac.digest('base64');

        iceServers.push({
          urls: turnUrls,
          username,
          credential,
        });
      } else if (config.TURN_USERNAME && config.TURN_CREDENTIAL) {
        // Static TURN credentials
        iceServers.push({
          urls: turnUrls,
          username: config.TURN_USERNAME,
          credential: config.TURN_CREDENTIAL,
        });
      } else {
        // Open TURN / STUN combo without auth
        iceServers.push({ urls: turnUrls });
      }
    }

    return iceServers;
  }
}

export const iceService = new IceService();
