import { validateConfig, config } from './config.js';
import { WolfxEEWClient } from './wolfx.js';
import { P2PQuakeClient } from './p2p.js';

console.log('=== Earthquake Notification Bot for Misskey ===');
validateConfig();

console.log(`Misskey Target: ${config.misskeyOrigin} (Visibility: ${config.misskeyVisibility})`);
console.log(`Wolfx Endpoint: ${config.wolfxWsUrl}`);
console.log(`P2P Endpoint  : ${config.p2pWsUrl} (code 551 only)`);
console.log('-----------------------------------------------');

const wolfxClient = new WolfxEEWClient();
const p2pClient = new P2PQuakeClient();

// Start WebSocket services
wolfxClient.start();
p2pClient.start();

function handleShutdown(signal: string) {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  wolfxClient.stop();
  p2pClient.stop();
  process.exit(0);
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
