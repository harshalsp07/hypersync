import * as Y from "yjs";
import { MessageType, RoomSubType } from "@hypersync/shared";

export interface RoomMember {
  id: string;
  username: string;
}

export class WSProvider {
  public doc: Y.Doc;
  private ws: WebSocket | null = null;
  private url: string;
  private onSyncCallback: (() => void) | null = null;
  private onMemberListCallback: ((members: RoomMember[]) => void) | null = null;
  private onVideoSyncCallback: ((state: any) => void) | null = null;
  private onWebRTCSignalCallback: ((signal: any) => void) | null = null;
  private onStatusChangeCallback: ((connected: boolean) => void) | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;

  constructor(url: string, doc: Y.Doc) {
    this.url = url;
    this.doc = doc;

    // Listen to local doc updates and broadcast them to server
    this.doc.on("update", (update: Uint8Array, origin: any) => {
      if (origin !== this) {
        this.sendUpdate(update);
      }
    });
  }

  connect() {
    this.ws = new WebSocket(this.url);
    this.ws.binaryType = "arraybuffer";

    this.ws.onopen = () => {
      console.log("[HyperSync WS] Connected");
      this.reconnectDelay = 1000;
      this.onStatusChangeCallback?.(true);
      this.sendSyncStep1();
    };

    this.ws.onmessage = (event) => {
      if (typeof event.data === "string") return;

      const data = new Uint8Array(event.data);
      if (data.length < 2) return;

      const type = data[0];
      const payload = data.slice(2);

      switch (type) {
        case MessageType.CRDT_SYNC:
          this.handleCRDTMessage(payload);
          break;

        case MessageType.ROOM_MGMT:
          this.handleRoomMgmtMessage(payload);
          break;

        case MessageType.VIDEO_SYNC:
          this.handleVideoSyncMessage(payload);
          break;

        case MessageType.WEBRTC_SIGNAL:
          this.handleWebRTCSignalMessage(payload);
          break;
      }
    };

    this.ws.onclose = () => {
      console.log("[HyperSync WS] Disconnected, scheduling reconnect...");
      this.onStatusChangeCallback?.(false);
      this.scheduleReconnect();
    };

    this.ws.onerror = (err) => {
      console.error("[HyperSync WS] Error:", err);
    };
  }

  private handleCRDTMessage(payload: Uint8Array) {
    if (payload.length < 1) return;

    const subType = payload[0];
    const data = payload.slice(1);

    if (subType === 0x00) {
      Y.applyUpdate(this.doc, data, this);
      this.sendSyncStep2(data);
    } else if (subType === 0x01) {
      Y.applyUpdate(this.doc, data, this);
      this.onSyncCallback?.();
    } else if (subType === 0x02) {
      Y.applyUpdate(this.doc, data, this);
    }
  }

  private handleRoomMgmtMessage(payload: Uint8Array) {
    if (payload.length < 1) return;
    const subType = payload[0];
    const data = payload.slice(1);

    if (subType === RoomSubType.MEMBER_LIST) {
      try {
        const decoded = new TextDecoder().decode(data);
        const parsed = JSON.parse(decoded);
        if (parsed.members && Array.isArray(parsed.members)) {
          this.onMemberListCallback?.(parsed.members);
        }
      } catch (err) {
        console.error("Failed to parse member list:", err);
      }
    }
  }

  private handleVideoSyncMessage(payload: Uint8Array) {
    try {
      const decoded = new TextDecoder().decode(payload);
      const state = JSON.parse(decoded);
      this.onVideoSyncCallback?.(state);
    } catch (err) {
      console.error("Failed to parse video sync:", err);
    }
  }

  private handleWebRTCSignalMessage(payload: Uint8Array) {
    try {
      const decoded = new TextDecoder().decode(payload);
      const signal = JSON.parse(decoded);
      this.onWebRTCSignalCallback?.(signal);
    } catch (err) {
      console.error("Failed to parse webrtc signal:", err);
    }
  }

  private sendSyncStep1() {
    const stateVector = Y.encodeStateVector(this.doc);
    const payload = new Uint8Array([0x00, 0x00, ...stateVector]);
    this.sendRaw(payload);
  }

  private sendSyncStep2(data: Uint8Array) {
    const update = Y.encodeStateAsUpdate(this.doc, data);
    const payload = new Uint8Array([0x00, 0x01, ...update]);
    this.sendRaw(payload);
  }

  sendUpdate(update: Uint8Array) {
    const payload = new Uint8Array([0x00, 0x02, ...update]);
    this.sendRaw(payload);
  }

  sendVideoSync(state: any) {
    const jsonStr = JSON.stringify(state);
    const encoded = new TextEncoder().encode(jsonStr);
    const frame = new Uint8Array(2 + encoded.length);
    frame[0] = MessageType.VIDEO_SYNC;
    frame[1] = 0;
    frame.set(encoded, 2);
    this.sendRaw(frame);
  }

  sendWebRTCSignal(signal: any) {
    const jsonStr = JSON.stringify(signal);
    const encoded = new TextEncoder().encode(jsonStr);
    const frame = new Uint8Array(2 + encoded.length);
    frame[0] = MessageType.WEBRTC_SIGNAL;
    frame[1] = 0;
    frame.set(encoded, 2);
    this.sendRaw(frame);
  }

  private sendRaw(data: Uint8Array) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    }
  }

  onSync(callback: () => void) {
    this.onSyncCallback = callback;
  }

  onMemberList(callback: (members: RoomMember[]) => void) {
    this.onMemberListCallback = callback;
  }

  onVideoSync(callback: (state: any) => void) {
    this.onVideoSyncCallback = callback;
  }

  onWebRTCSignal(callback: (signal: any) => void) {
    this.onWebRTCSignalCallback = callback;
  }

  onStatusChange(callback: (connected: boolean) => void) {
    this.onStatusChangeCallback = callback;
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
      this.connect();
    }, this.reconnectDelay);
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
