import { WolfxEEWPayload, P2PQuake551Payload } from './types.js';

/**
 * Wolfx EEW Deduplication & Validity Checker
 */
export class WolfxDeduper {
  private processedEvents: Map<string, {
    lastSerial: number;
    isCancelled: boolean;
    firstAlertSent: boolean;
    firstNoteId?: string;
    lastSentMaxIntensity?: string;
    lastSentMagnitude?: number;
    lastSeenAt: number;
  }> = new Map();
  private maxCacheSize = 500;
  private cacheTtlMs = 24 * 60 * 60 * 1000; // 24 hours

  public recordSentNote(eventId: string, noteId: string, payload?: WolfxEEWPayload): void {
    const entry = this.processedEvents.get(eventId);
    const rawMag = payload ? (payload.Magunitude ?? payload.Magnitude) : undefined;
    const magNum = typeof rawMag === 'number' ? rawMag : typeof rawMag === 'string' ? parseFloat(rawMag) : undefined;

    if (entry) {
      if (!entry.firstNoteId && noteId) {
        entry.firstNoteId = noteId;
      }
      if (payload) {
        if (payload.MaxIntensity) entry.lastSentMaxIntensity = payload.MaxIntensity.trim();
        if (magNum !== undefined && !isNaN(magNum)) entry.lastSentMagnitude = magNum;
      }
    } else {
      this.processedEvents.set(eventId, {
        lastSerial: payload?.Serial ? Number(payload.Serial) : 0,
        isCancelled: Boolean(payload?.isCancel),
        firstAlertSent: true,
        firstNoteId: noteId,
        lastSentMaxIntensity: payload?.MaxIntensity?.trim(),
        lastSentMagnitude: magNum && !isNaN(magNum) ? magNum : undefined,
        lastSeenAt: Date.now(),
      });
    }
  }

  // Backwards-compatibility helper
  public recordNoteId(eventId: string, noteId: string): void {
    this.recordSentNote(eventId, noteId);
  }

  public getFirstNoteId(eventId: string): string | undefined {
    return this.processedEvents.get(eventId)?.firstNoteId;
  }

  private hasValidMaxIntensity(intensity?: string): boolean {
    if (!intensity || typeof intensity !== 'string') return false;
    const str = intensity.trim();
    return str !== '' && str !== '不明' && str !== '0';
  }

  public checkAndValidate(payload: any): { valid: boolean; reason?: string; data?: WolfxEEWPayload } {
    if (!payload || typeof payload !== 'object') {
      return { valid: false, reason: 'Invalid payload type' };
    }

    // 1. Filter out heartbeat / ping
    if (payload.type === 'heartbeat' || payload.type === 'ping') {
      return { valid: false, reason: 'Heartbeat packet' };
    }

    // 2. Validate essential fields
    const data = payload as WolfxEEWPayload;
    if (!data.EventID || typeof data.EventID !== 'string' || data.EventID.trim() === '') {
      return { valid: false, reason: 'Missing or empty EventID' };
    }

    // 3. Filter training messages if not allowed
    if ((data.isTraining || data.isAssumption) && !process.env.ALLOW_TRAINING) {
      return { valid: false, reason: 'Training/Assumption report filtered', data };
    }

    // 4. Check for information completeness
    const isCancel = Boolean(data.isCancel);
    if (!isCancel) {
      const hasHypocenter = data.Hypocenter && data.Hypocenter.trim().length > 0;
      const hasIntensity = this.hasValidMaxIntensity(data.MaxIntensity);
      const hasMag = data.Magunitude !== undefined || data.Magnitude !== undefined;

      if (!hasHypocenter && !hasIntensity && !hasMag) {
        return { valid: false, reason: 'Empty information payload (no hypocenter, intensity, or magnitude)', data };
      }
    }

    // 5. Serial & Event Deduplication
    const eventId = data.EventID;
    const currentSerial = typeof data.Serial === 'number' ? data.Serial : parseInt(String(data.Serial || '0'), 10);
    const isFinal = Boolean(data.isFinal);
    const now = Date.now();

    this.cleanupCache(now);

    const prev = this.processedEvents.get(eventId);
    const firstAlertSent = prev?.firstAlertSent ?? false;

    // Check if MaxIntensity or Magnitude changed since last sent alert
    const currentMagRaw = data.Magunitude ?? data.Magnitude;
    const currentMag = typeof currentMagRaw === 'number' ? currentMagRaw : typeof currentMagRaw === 'string' ? parseFloat(currentMagRaw) : undefined;
    const currentIntensity = data.MaxIntensity?.trim();

    let hasChanged = false;
    if (firstAlertSent && prev) {
      const intensityChanged = Boolean(currentIntensity && prev.lastSentMaxIntensity && currentIntensity !== prev.lastSentMaxIntensity);
      const magChanged = Boolean(
        currentMag !== undefined &&
        !isNaN(currentMag) &&
        prev.lastSentMagnitude !== undefined &&
        Math.abs(currentMag - prev.lastSentMagnitude) >= 0.05
      );
      if (intensityChanged || magChanged) {
        hasChanged = true;
      }
    }

    // 6. First, Final & Change report filter
    const onlyFirstAndFinal = process.env.ONLY_FIRST_AND_FINAL !== 'false'; // Default true
    if (onlyFirstAndFinal && !isCancel) {
      const hasIntensity = this.hasValidMaxIntensity(data.MaxIntensity);

      if (!firstAlertSent) {
        if (!hasIntensity) {
          return { valid: false, reason: `Initial report skipped: MaxIntensity not available yet (Serial: ${currentSerial})`, data };
        }
      } else if (!isFinal && !hasChanged) {
        return { valid: false, reason: `Intermediate report skipped: No change in MaxIntensity or Magnitude (Serial: ${currentSerial}, isFinal: false)`, data };
      }
    }

    if (prev) {
      if (isCancel) {
        if (prev.isCancelled) {
          return { valid: false, reason: 'Duplicate cancellation report for event', data };
        }
      } else if (currentSerial > 0 && currentSerial <= prev.lastSerial && !isFinal && !hasChanged) {
        return { valid: false, reason: `Outdated or duplicate serial (${currentSerial} <= ${prev.lastSerial})`, data };
      }
    }

    // Update cache
    const sendingFirstAlert = !isCancel && this.hasValidMaxIntensity(data.MaxIntensity);
    this.processedEvents.set(eventId, {
      lastSerial: Math.max(currentSerial, prev?.lastSerial || 0),
      isCancelled: isCancel || (prev?.isCancelled ?? false),
      firstAlertSent: firstAlertSent || sendingFirstAlert,
      firstNoteId: prev?.firstNoteId,
      lastSentMaxIntensity: hasChanged || sendingFirstAlert ? currentIntensity || prev?.lastSentMaxIntensity : prev?.lastSentMaxIntensity,
      lastSentMagnitude: hasChanged || sendingFirstAlert ? (currentMag && !isNaN(currentMag) ? currentMag : prev?.lastSentMagnitude) : prev?.lastSentMagnitude,
      lastSeenAt: now,
    });

    return { valid: true, data };
  }

  private cleanupCache(now: number): void {
    if (this.processedEvents.size > this.maxCacheSize) {
      for (const [key, value] of this.processedEvents.entries()) {
        if (now - value.lastSeenAt > this.cacheTtlMs) {
          this.processedEvents.delete(key);
        }
      }
    }
  }
}

/**
 * P2P Earthquake Information Deduplication & Validity Checker (Code 551 dedicated)
 */
export class P2PDeduper {
  private processedIds: Set<string> = new Set();
  private maxCacheSize = 1000;

  public checkAndValidate(payload: any): { valid: boolean; reason?: string; data?: P2PQuake551Payload } {
    if (!payload || typeof payload !== 'object') {
      return { valid: false, reason: 'Invalid payload type' };
    }

    // 1. Explicit requirement: process ONLY code 551
    if (payload.code !== 551) {
      return { valid: false, reason: `Ignored non-551 code (${payload.code})` };
    }

    const data = payload as P2PQuake551Payload;

    // 2. Validate & normalize ID (check 'id', '_id', or issue ID / fallback composite key)
    let extractedId: string | undefined;
    if (typeof data.id === 'string' && data.id.trim() !== '') {
      extractedId = data.id.trim();
    } else if (typeof (data as any)._id === 'string' && (data as any)._id.trim() !== '') {
      extractedId = (data as any)._id.trim();
    } else if (data.issue && typeof (data.issue as any).id === 'string' && (data.issue as any).id.trim() !== '') {
      extractedId = (data.issue as any).id.trim();
    } else if (data.time || data.issue?.time) {
      // Fallback composite key if ID is omitted in payload
      extractedId = `551_${data.time || ''}_${data.issue?.time || ''}_${data.earthquake?.time || ''}`;
    }

    if (!extractedId) {
      return { valid: false, reason: 'Missing or empty id' };
    }

    // Ensure data.id is populated with normalized ID
    data.id = extractedId;

    // 3. Deduplicate by id
    if (this.processedIds.has(data.id)) {
      return { valid: false, reason: `Duplicate id: ${data.id}`, data };
    }

    // 4. Information completeness check
    if (!data.issue || typeof data.issue !== 'object') {
      return { valid: false, reason: 'Missing issue details', data };
    }

    const hasPoints = Array.isArray(data.points) && data.points.length > 0;
    const hasEarthquakeInfo = data.earthquake && (
      (data.earthquake.hypocenter && data.earthquake.hypocenter.name) ||
      (data.earthquake.maxScale !== undefined && data.earthquake.maxScale >= 0)
    );

    if (!hasPoints && !hasEarthquakeInfo) {
      return { valid: false, reason: 'No points and no valid earthquake info present', data };
    }

    // Record ID
    this.processedIds.add(data.id);
    if (this.processedIds.size > this.maxCacheSize) {
      const firstItem = this.processedIds.values().next().value;
      if (firstItem) {
        this.processedIds.delete(firstItem);
      }
    }

    return { valid: true, data };
  }
}
