import { MessageType, ControlSubType } from "@hypersync/shared";
import { createChildLogger } from "../utils/logger.js";
import { encodeEnvelope } from "../utils/binary.js";
import { TokenBucket } from "../middleware/rate-limiter.js";
import { CONSTANTS } from "../config/constants.js";

const log = createChildLogger("connection");

type MessageHandler = (conn: Connection, data: Uint8Array) => void;

export class Connection {
  public id: string;
  public userId: string;
  public username: string;
  public roomId: string | null = null;
  public lastActivity: number = Date.now();
  public isConnected: boolean = true;

  public ws: any;
  private rateLimits: Map<string, TokenBucket> = new Map();
  private messageHandler: MessageHandler | null = null;

  constructor(
    ws: any,
    userId: string,
    username: string,
    connectionId: string
  ) {
    this.ws = ws;
    this.userId = userId;
    this.username = username;
    this.id = connectionId;
  }

  onMessage(handler: MessageHandler) {
    this.messageHandler = handler;
  }

  handleMessage(data: ArrayBuffer | Uint8Array) {
    this.lastActivity = Date.now();
    if (this.messageHandler) {
      const buf = data instanceof Uint8Array ? data : new Uint8Array(data);
      this.messageHandler(this, buf);
    }
  }

  send(type: MessageType, flags: number, payload: Uint8Array) {
    if (!this.isConnected) return;
    try {
      const frame = encodeEnvelope(type, flags, payload);
      this.ws.send(frame, true);
    } catch (err) {
      log.error({ err, connectionId: this.id }, "Failed to send message");
    }
  }

  sendPing() {
    this.send(MessageType.CONTROL, 0, new Uint8Array([ControlSubType.HEARTBEAT_PING]));
  }

  sendPong() {
    this.send(MessageType.CONTROL, 0, new Uint8Array([ControlSubType.HEARTBEAT_PONG]));
  }

  sendError(message: string) {
    const encoder = new TextEncoder();
    const payload = encoder.encode(message);
    this.send(MessageType.CONTROL, 0, new Uint8Array([ControlSubType.ERROR, ...payload]));
  }

  canConsume(type: string, cost: number = 1): boolean {
    if (!this.rateLimits.has(type)) {
      const config = CONSTANTS.RATE_LIMIT[type as keyof typeof CONSTANTS.RATE_LIMIT];
      if (!config) return true;
      this.rateLimits.set(type, new TokenBucket(config.capacity, config.refillRate));
    }
    return this.rateLimits.get(type)!.consume(cost);
  }

  close(code: number = 1000, reason: string = "") {
    this.isConnected = false;
    try {
      this.ws.close(code, reason);
    } catch {}
  }
}
