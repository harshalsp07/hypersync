import { getEnv } from "./config/env.js";
import { WSServer } from "./transport/ws-server.js";
import { MessageRouter } from "./transport/message-router.js";
import { RoomManager } from "./rooms/room-manager.js";
import { CRDTDocManager } from "./crdt/doc-manager.js";
import { AwarenessHandler } from "./crdt/awareness-handler.js";
import { VideoSyncManager } from "./media/video-sync.js";
import { HeartbeatManager } from "./middleware/heartbeat.js";
import { RedisWAL } from "./persistence/redis-wal.js";
import { PGStore } from "./persistence/pg-store.js";
import { CompactionWorker } from "./persistence/compaction.js";
import { RedisPubSub } from "./scaling/redis-pubsub.js";
import { createChildLogger } from "./utils/logger.js";

const log = createChildLogger("main");

async function main() {
  const env = getEnv();
  log.info({ env: env.NODE_ENV, port: env.PORT }, "Starting HyperSync Engine");

  // Initialize persistence
  const redisWAL = new RedisWAL(env.REDIS_URL);
  const pgStore = new PGStore(env.PG_URL);
  const compaction = new CompactionWorker(redisWAL, pgStore);
  const redisPubSub = new RedisPubSub(env.REDIS_URL);

  // Initialize core services
  const roomManager = new RoomManager();
  const docManager = new CRDTDocManager(roomManager, redisWAL, compaction);
  const awarenessHandler = new AwarenessHandler(roomManager);
  const videoSync = new VideoSyncManager(roomManager);

  const messageRouter = new MessageRouter(
    roomManager,
    docManager,
    awarenessHandler,
    videoSync,
    redisPubSub
  );
  const wsServer = new WSServer(messageRouter, env.CORS_ORIGIN);

  const heartbeat = new HeartbeatManager(env.HEARTBEAT_INTERVAL_MS, env.HEARTBEAT_TIMEOUT_MS);

  // Start server
  wsServer.start(env.PORT, env.HOST);
  heartbeat.start((wsServer as any).connections);

  // Health check
  const pgHealthy = await pgStore.healthCheck();
  log.info({ pgHealthy }, "Database health check");

  log.info(
    {
      port: env.PORT,
      host: env.HOST,
      instanceId: redisPubSub.InstanceId,
    },
    "HyperSync Engine is running"
  );

  const shutdown = async () => {
    log.info("Shutting down...");
    heartbeat.stop();
    compaction.shutdown();
    wsServer.shutdown();
    await redisWAL.disconnect();
    await pgStore.disconnect();
    await redisPubSub.disconnect();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  log.error(err, "Failed to start server");
  process.exit(1);
});
