import WebSocket from 'ws';
import { config } from './config.js';
import { WolfxDeduper } from './dedupe.js';
import { formatWolfxEEW } from './formatters.js';
import { postToMisskey } from './misskey.js';
import { ansi, colorizeAnsiScale } from './logger.js';

export class WolfxEEWClient {
  private ws: WebSocket | null = null;
  private deduper = new WolfxDeduper();
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

    console.log(`${ansi.dim}[Wolfx EEW] Connecting to ${config.wolfxWsUrl}...${ansi.reset}`);
    this.ws = new WebSocket(config.wolfxWsUrl);

    this.ws.on('open', () => {
      console.log(`${ansi.green}${ansi.bold}[Wolfx EEW] Connected successfully.${ansi.reset}`);
    });

    this.ws.on('message', async (rawMessage: WebSocket.Data) => {
      try {
        const text = rawMessage.toString();
        const json = JSON.parse(text);

        const checkResult = this.deduper.checkAndValidate(json);
        const data = checkResult.data;

        // Skip heartbeat logging
        if (checkResult.reason === 'Heartbeat packet') {
          return;
        }

        // Log detailed packet info for all EEW reports (including intermediate ones)
        if (data) {
          const tag = `${ansi.bold}${ansi.cyan}[Wolfx EEW Received]${ansi.reset}`;
          const eventIdStr = `${ansi.dim}EventID:${ansi.reset} ${ansi.bold}${data.EventID || 'N/A'}${ansi.reset}`;
          const serialStr = `${ansi.dim}Serial:${ansi.reset} ${ansi.bold}${data.Serial ?? 'N/A'}${ansi.reset}`;
          const hypStr = `${ansi.dim}Hypocenter:${ansi.reset} ${ansi.bold}${data.Hypocenter || (data.isCancel ? 'Cancel' : 'N/A')}${ansi.reset}`;

          const coloredMax = data.MaxIntensity ? colorizeAnsiScale(`震度${data.MaxIntensity}`, data.MaxIntensity) : `${ansi.gray}N/A${ansi.reset}`;
          const maxStr = `${ansi.dim}MaxIntensity:${ansi.reset} ${coloredMax}`;

          const mag = data.Magunitude ?? data.Magnitude ?? 'N/A';
          const magStr = `${ansi.dim}Mag:${ansi.reset} ${ansi.bold}${mag}${ansi.reset}`;

          const finalStr = `${ansi.dim}Final:${ansi.reset} ${data.isFinal ? `${ansi.brightGreen}${ansi.bold}true${ansi.reset}` : `${ansi.dim}false${ansi.reset}`}`;
          const cancelStr = `${ansi.dim}Cancel:${ansi.reset} ${data.isCancel ? `${ansi.brightRed}${ansi.bold}true${ansi.reset}` : `${ansi.dim}false${ansi.reset}`}`;

          console.log(`${tag} ${eventIdStr} | ${serialStr} | ${hypStr} | ${maxStr} | ${magStr} | ${finalStr} | ${cancelStr}`);
        }

        if (!checkResult.valid) {
          console.log(` ${ansi.dim}└─>${ansi.reset} ${ansi.yellow}[Skipped]${ansi.reset} ${ansi.dim}Reason: ${checkResult.reason}${ansi.reset}`);
          return;
        }

        const eventId = data!.EventID || '';
        const isFinal = Boolean(data!.isFinal);
        const renoteId = this.deduper.getFirstNoteId(eventId);

        if (isFinal && renoteId) {
          console.log(` ${ansi.dim}└─>${ansi.reset} ${ansi.bold}${ansi.green}[Posting Final Alert (Quote-Renote)]${ansi.reset} EventID: ${eventId}, RenoteTargetID: ${renoteId}`);
        } else if (renoteId) {
          console.log(` ${ansi.dim}└─>${ansi.reset} ${ansi.bold}${ansi.green}[Posting Updated Alert (Quote-Renote)]${ansi.reset} EventID: ${eventId}, Serial: ${data!.Serial}, RenoteTargetID: ${renoteId}`);
        } else {
          console.log(` ${ansi.dim}└─>${ansi.reset} ${ansi.bold}${ansi.green}[Posting Initial Alert]${ansi.reset} EventID: ${eventId}, Serial: ${data!.Serial}`);
        }

        const noteText = formatWolfxEEW(data!);
        const cw = data!.isWarn ? '🚨【緊急地震速報（警報）】' : undefined;

        const postedNoteId = await postToMisskey(noteText, cw, renoteId);
        if (postedNoteId && eventId) {
          this.deduper.recordSentNote(eventId, postedNoteId, data!);
        }
      } catch (err) {
        console.error(`${ansi.red}[Wolfx EEW Message Error] Failed to parse or process payload:${ansi.reset}`, err);
      }
    });

    this.ws.on('error', (err) => {
      console.error('[Wolfx EEW Socket Error]:', err.message);
    });

    this.ws.on('close', (code, reason) => {
      console.warn(`[Wolfx EEW Socket Closed] Code: ${code}, Reason: ${reason.toString()}`);
      this.scheduleReconnect();
    });
  }

  private scheduleReconnect(): void {
    if (this.isStopped) return;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

    console.log(`[Wolfx EEW] Will reconnect in ${config.reconnectIntervalMs / 1000}s...`);
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, config.reconnectIntervalMs);
  }
}
