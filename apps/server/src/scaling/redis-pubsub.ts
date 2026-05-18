import { Redis } from "ioredis";
import { createChildLogger } from "../utils/logger.js";

const log = createChildLogger("redis-pubsub");

type MessageHandler = (channel: string, data: Buffer) => void;

export class RedisPubSub {
  private publisher: Redis;
  private subscriber: Redis;
  private handlers: Map<string, MessageHandler[]> = new Map();
  private instanceId: string;

  constructor(redisUrl: string) {
    this.instanceId = crypto.randomUUID().slice(0, 8);

    this.publisher = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
    });

    this.subscriber = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
    });

    this.subscriber.on("message", (channel: string, message: string) => {
      const handlers = this.handlers.get(channel) || [];
      for (const handler of handlers) {
        handler(channel, Buffer.from(message, "binary"));
      }
    });
  }

  publish(roomId: string, data: Buffer): void {
    const channel = `room:${roomId}`;
    this.publisher.publish(channel, data);
    log.debug({ roomId, instanceId: this.instanceId, size: data.length }, "Published message");
  }

  subscribe(roomId: string, handler: MessageHandler): void {
    const channel = `room:${roomId}`;

    if (!this.handlers.has(channel)) {
      this.handlers.set(channel, []);
      this.subscriber.subscribe(channel);
      log.debug({ roomId }, "Subscribed to room channel");
    }

    this.handlers.get(channel)!.push(handler);
  }

  unsubscribe(roomId: string, handler?: MessageHandler): void {
    const channel = `room:${roomId}`;

    if (handler) {
      const handlers = this.handlers.get(channel) || [];
      const idx = handlers.indexOf(handler);
      if (idx >= 0) {
        handlers.splice(idx, 1);
      }
    } else {
      this.handlers.delete(channel);
    }

    if (!this.handlers.has(channel) || this.handlers.get(channel)!.length === 0) {
      this.handlers.delete(channel);
      this.subscriber.unsubscribe(channel);
    }
  }

  async trackRoom(roomId: string): Promise<void> {
    const key = `instances:${roomId}`;
    await this.publisher.sadd(key, this.instanceId);
    await this.publisher.expire(key, 60);
  }

  async getInstanceCount(roomId: string): Promise<number> {
    return this.publisher.scard(`instances:${roomId}`);
  }

  get InstanceId(): string {
    return this.instanceId;
  }

  async disconnect(): Promise<void> {
    await this.publisher.quit();
    await this.subscriber.quit();
  }
}
