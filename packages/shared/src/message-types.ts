import { MessageType, CRDTSubType, ControlSubType, RoomSubType } from "./protocol-constants.js";

export interface BinaryEnvelope {
  type: MessageType;
  flags: number;
  payload: Uint8Array;
}

export interface CRDTSyncMessage {
  subType: CRDTSubType;
  data: Uint8Array;
}

export interface AwarenessMessage {
  clientId: number;
  data: Uint8Array;
}

export interface VideoSyncMessage {
  state: PlaybackState;
}

export interface PlaybackState {
  videoId: string;
  state: "IDLE" | "LOADING" | "READY" | "PLAYING" | "PAUSED" | "SEEKING" | "BUFFERING";
  currentTime: number;
  playbackRate: number;
  serverTimestamp: number;
  initiatorId: string;
  vectorClock: Record<string, number>;
}

export interface RoomManagementMessage {
  subType: RoomSubType;
  roomId: string;
  data?: unknown;
}

export interface ControlMessage {
  subType: ControlSubType;
  data?: unknown;
}
