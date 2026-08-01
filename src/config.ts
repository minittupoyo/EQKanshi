import dotenv from 'dotenv';
import { MisskeyVisibility } from './types.js';

dotenv.config();

export interface AppConfig {
  misskeyOrigin: string;
  misskeyToken: string;
  misskeyVisibility: MisskeyVisibility;
  wolfxWsUrl: string;
  p2pWsUrl: string;
  allowTraining: boolean;
  onlyFirstAndFinal: boolean;
  reconnectIntervalMs: number;
  healthPort: number;
  unhealthyRestartAfterMs: number;
}

function normalizeUrl(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

export const config: AppConfig = {
  misskeyOrigin: normalizeUrl(process.env.MISSKEY_ORIGIN || 'https://misskey.io'),
  misskeyToken: process.env.MISSKEY_TOKEN || '',
  misskeyVisibility: (process.env.MISSKEY_VISIBILITY as MisskeyVisibility) || 'public',
  wolfxWsUrl: process.env.WOLFX_WS_URL || 'wss://ws-api.wolfx.jp/jma_eew',
  p2pWsUrl: process.env.P2P_WS_URL || 'wss://api.p2pquake.net/v2/ws',
  allowTraining: process.env.ALLOW_TRAINING === 'true',
  onlyFirstAndFinal: process.env.ONLY_FIRST_AND_FINAL !== 'false', // Default true
  reconnectIntervalMs: parseInt(process.env.RECONNECT_INTERVAL_MS || '5000', 10),
  healthPort: parseInt(process.env.HEALTH_PORT || '3000', 10),
  unhealthyRestartAfterMs: parseInt(process.env.UNHEALTHY_RESTART_AFTER_MS || '120000', 10),
};

export function validateConfig(): void {
  if (!config.misskeyToken) {
    console.warn('[Config Warning] MISSKEY_TOKEN is not set in environment or .env file. Posts will fail unless token is provided.');
  }

  if (!Number.isInteger(config.healthPort) || config.healthPort < 1 || config.healthPort > 65535) {
    throw new Error('HEALTH_PORT must be an integer between 1 and 65535.');
  }

  if (!Number.isFinite(config.unhealthyRestartAfterMs) || config.unhealthyRestartAfterMs < 10000) {
    throw new Error('UNHEALTHY_RESTART_AFTER_MS must be at least 10000.');
  }
}
