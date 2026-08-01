import { validateConfig, config } from './config.js';
import { WolfxEEWClient } from './wolfx.js';
import { P2PQuakeClient } from './p2p.js';
import { startHealthMonitor } from './health.js';

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

let shuttingDown = false;
const healthMonitor = startHealthMonitor(
  config.healthPort,
  [
    { name: 'wolfx', isHealthy: () => wolfxClient.isHealthy() },
    { name: 'p2p', isHealthy: () => p2pClient.isHealthy() },
  ],
  config.unhealthyRestartAfterMs,
  () => handleShutdown('health watchdog', 1),
);

function handleShutdown(signal: string, exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  healthMonitor.stop();
  wolfxClient.stop();
  p2pClient.stop();
  process.exit(exitCode);
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
