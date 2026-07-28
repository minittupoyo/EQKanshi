export type MisskeyVisibility = 'public' | 'home' | 'unlisted' | 'specified';

export interface MisskeyNoteRequest {
  i: string;
  text: string;
  visibility?: MisskeyVisibility;
  cw?: string;
  renoteId?: string;
}

export interface WolfxEEWPayload {
  type: string;
  Title?: string;
  EventID?: string;
  Serial?: number | string;
  AnnouncedTime?: string;
  Hypocenter?: string;
  Latitude?: number | string;
  Longitude?: number | string;
  Depth?: number | string;
  Magunitude?: number | string;
  Magnitude?: number | string;
  MaxIntensity?: string;
  isWarn?: boolean;
  isFinal?: boolean;
  isCancel?: boolean;
  isTraining?: boolean;
  isAssumption?: boolean;
  CodeType?: string;
  ver?: string;
  timestamp?: number;
}

export interface P2PQuakeHypocenter {
  name: string;
  latitude: number;
  longitude: number;
  depth: number | string;
  magnitude: number;
}

export interface P2PQuakeEarthquake {
  time: string;
  hypocenter?: P2PQuakeHypocenter;
  maxScale?: number;
  domesticTsunami?: string;
  foreignTsunami?: string;
}

export interface P2PQuakePoint {
  pref: string;
  addr: string;
  scale: number;
  isScaleAfterprepare: boolean;
}

export interface P2PQuake551Issue {
  time: string;
  eventId?: string;
  type: 'ScalePrompt' | 'Destination' | 'ScaleAndDestination' | 'DetailScale' | 'Foreign' | 'Other' | string;
  correct: 'None' | 'Unknown' | 'ScaleOnly' | 'DestinationOnly' | 'All' | string;
}

export interface P2PQuake551Payload {
  code: 551;
  id: string;
  time: string;
  issue: P2PQuake551Issue;
  earthquake?: P2PQuakeEarthquake;
  points?: P2PQuakePoint[];
}
