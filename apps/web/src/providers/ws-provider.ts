import * as Y from "yjs";

export class WSProvider {
  private doc: Y.Doc;
  private ws: WebSocket | null = null;
  private url: string;
  private awareness: Map<number, unknown> = new Map();
  private onSyncCallback: (() => void) | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;

  constructor(url: string, doc: Y.Doc) {
    this.url = url;
    this.doc = doc;
  }

  connect() {
    this.ws = new WebSocket(this.url);
    this.ws.binaryType = "arraybuffer";

    this.ws.onopen = () => {
      console.log("WebSocket connected");
      this.reconnectDelay = 1000;
      this.sendSyncStep1();
    };

    this.ws.onmessage = (event) => {
      if (typeof event.data === "string") return;

      const data = new Uint8Array(event.data);
      if (data.length < 2) return;

      const type = data[0];
      const payload = data.slice(2);

      if (type === 0x00) {
        this.handleCRDTMessage(payload);
      }
    };

    this.ws.onclose = () => {
      console.log("WebSocket closed, reconnecting...");
      this.scheduleReconnect();
    };

    this.ws.onerror = (err) => {
      console.error("WebSocket error:", err);
    };
  }

  private handleCRDTMessage(payload: Uint8Array) {
    if (payload.length < 1) return;

    const subType = payload[0];
    const data = payload.slice(1);

    if (subType === 0x00) {
      Y.applyUpdate(this.doc, data);
      this.sendSyncStep2(data);
    } else if (subType === 0x01) {
      Y.applyUpdate(this.doc, data);
      if (this.onSyncCallback) {
        this.onSyncCallback();
      }
    } else if (subType === 0x02) {
      Y.applyUpdate(this.doc, data);
    }
  }

  private sendSyncStep1() {
    const stateVector = Y.encodeStateVector(this.doc);
    const payload = new Uint8Array([0x00, 0x00, ...stateVector]);
    this.ws?.send(payload);
  }

  private sendSyncStep2(data: Uint8Array) {
    const update = Y.encodeStateAsUpdate(this.doc, data);
    const payload = new Uint8Array([0x00, 0x01, ...update]);
    this.ws?.send(payload);
  }

  sendUpdate(update: Uint8Array) {
    const payload = new Uint8Array([0x00, 0x02, ...update]);
    this.ws?.send(payload);
  }

  onSync(callback: () => void) {
    this.onSyncCallback = callback;
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
