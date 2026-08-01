import WebSocket from 'ws';
import { config } from './config.js';
import { P2PDeduper } from './dedupe.js';
import { formatP2P551 } from './formatters.js';
import { postToMisskey } from './misskey.js';
import { ansi, colorizeAnsiScale } from './logger.js';

export class P2PQuakeClient {
  private ws: WebSocket | null = null;
  private deduper = new P2PDeduper();
  private isStopped = false;
  private reconnectTimer: NodeJS.Timeout | null = null;

  public start(): void {
    this.isStopped = false;
    this.connect();
  }

  public stop(): void {
    this.isStopped = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  public isHealthy(): boolean {
    return !this.isStopped && this.ws?.readyState === WebSocket.OPEN;
  }

  private connect(): void {
    if (this.isStopped) return;

    console.log(`${ansi.dim}[P2P Quake] Connecting to ${config.p2pWsUrl}...${ansi.reset}`);
    this.ws = new WebSocket(config.p2pWsUrl);

    this.ws.on('open', () => {
      console.log(`${ansi.magenta}${ansi.bold}[P2P Quake] Connected successfully to /ws.${ansi.reset}`);
    });

    this.ws.on('message', async (rawMessage: WebSocket.Data) => {
      try {
        const text = rawMessage.toString();
        const json = JSON.parse(text);

        const checkResult = this.deduper.checkAndValidate(json);
        const data = checkResult.data;

        // Filter out non-551 codes silently
        if (checkResult.reason?.startsWith('Ignored non-551 code')) {
          return;
        }

        if (data) {
          const tag = `${ansi.bold}${ansi.magenta}[P2P Quake 551 Received]${ansi.reset}`;
          const idStr = `${ansi.dim}ID:${ansi.reset} ${ansi.bold}${data.id}${ansi.reset}`;
          const typeName = data.issue?.type || 'N/A';
          const typeStr = `${ansi.dim}Type:${ansi.reset} ${ansi.bold}${typeName}${ansi.reset}`;
          const hypName = data.earthquake?.hypocenter?.name || 'N/A';
          const hypStr = `${ansi.dim}Hypocenter:${ansi.reset} ${ansi.bold}${hypName}${ansi.reset}`;

          const maxScaleVal = data.earthquake?.maxScale;
          const maxScaleStr = maxScaleVal !== undefined && maxScaleVal >= 0
            ? colorizeAnsiScale(`震度${maxScaleVal / 10}`, maxScaleVal)
            : `${ansi.gray}N/A${ansi.reset}`;
          const scaleStr = `${ansi.dim}MaxScale:${ansi.reset} ${maxScaleStr}`;

          console.log(`${tag} ${idStr} | ${typeStr} | ${hypStr} | ${scaleStr} | ${ansi.dim}Time:${ansi.reset} ${data.time || 'N/A'}`);
        }

        if (!checkResult.valid) {
          console.log(` ${ansi.dim}└─>${ansi.reset} ${ansi.yellow}[Skipped]${ansi.reset} ${ansi.dim}Reason: ${checkResult.reason}${ansi.reset}`);
          return;
        }

        console.log(` ${ansi.dim}└─>${ansi.reset} ${ansi.bold}${ansi.green}[Posting to Misskey]${ansi.reset} P2P ID: ${data!.id}`);

        const noteText = formatP2P551(data!);
        await postToMisskey(noteText);
      } catch (err) {
        console.error(`${ansi.red}[P2P Quake Message Error] Failed to parse or process payload:${ansi.reset}`, err);
      }
    });

    this.ws.on('error', (err) => {
      console.error('[P2P Quake Socket Error]:', err.message);
    });

    this.ws.on('close', (code, reason) => {
      console.warn(`[P2P Quake Socket Closed] Code: ${code}, Reason: ${reason.toString()}`);
      this.scheduleReconnect();
    });
  }

  private scheduleReconnect(): void {
    if (this.isStopped) return;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

    console.log(`[P2P Quake] Will reconnect in ${config.reconnectIntervalMs / 1000}s...`);
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, config.reconnectIntervalMs);
  }
}
