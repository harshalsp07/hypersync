import uWS from "uWebSockets.js";
import { createChildLogger } from "../utils/logger.js";
import { Connection } from "./connection.js";
import { MessageRouter } from "./message-router.js";
import { verifyToken } from "../middleware/auth.js";

const log = createChildLogger("ws-server");

export class WSServer {
  private connections: Map<string, Connection> = new Map();
  private router: MessageRouter;
  private corsOrigin: string;

  constructor(messageRouter: MessageRouter, corsOrigin: string = "*") {
    this.router = messageRouter;
    this.corsOrigin = corsOrigin;
  }

  start(port: number, host: string) {
    const app = uWS.App();

    app.options("/*", (res: any) => {
      res.writeHeader("Access-Control-Allow-Origin", this.corsOrigin);
      res.writeHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.writeHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.end();
    });

    app.get("/health", (res: any) => {
      res.writeHeader("Access-Control-Allow-Origin", this.corsOrigin);
      res.writeHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ status: "ok", connections: this.connections.size }));
    });

    app.ws("/*", {
      maxPayloadLength: 16 * 1024 * 1024,
      idleTimeout: 60,

      upgrade: (res: any, req: any, context: any) => {
        const origin = req.getHeader("origin");
        if (this.corsOrigin !== "*" && origin !== this.corsOrigin) {
          log.warn({ origin }, "Rejected WebSocket connection from unauthorized origin");
          res.close();
          return;
        }

        const urlStr = req.getUrl();
        const query = req.getQuery();
        const fullUrl = `http://localhost${urlStr}${query ? "?" + query : ""}`;

        res.upgrade(
          { url: fullUrl },
          req.getHeader("sec-websocket-key"),
          req.getHeader("sec-websocket-protocol"),
          req.getHeader("sec-websocket-extensions"),
          context
        );
      },

      open: (ws: any) => {
        const fullUrl = ws.upgradeReq?.url || "/";
        const url = new URL(fullUrl, "http://localhost");
        const token = url.searchParams.get("token");

        if (!token) {
          ws.close(1008, "Token required");
          return;
        }

        const payload = verifyToken(token);
        if (!payload) {
          ws.close(1008, "Invalid token");
          return;
        }

        const connectionId = crypto.randomUUID();
        const conn = new Connection(ws, payload.userId, payload.username, connectionId);
        this.connections.set(connectionId, conn);

        log.info(
          { connectionId, userId: payload.userId, username: payload.username },
          "Client connected"
        );

        conn.onMessage((c, data) => {
          this.router.route(c, data);
        });

        ws.userId = payload.userId;
        ws.connectionId = connectionId;
      },

      message: (ws: any, message: ArrayBuffer, isBinary: boolean) => {
        const connId = ws.connectionId;
        const conn = this.connections.get(connId);
        if (!conn) return;

        if (!isBinary) {
          log.warn({ connectionId: connId }, "Received non-binary message");
          return;
        }

        conn.handleMessage(message);
      },

      close: (ws: any) => {
        const connId = ws.connectionId;
        const conn = this.connections.get(connId);
        if (conn) {
          log.info({ connectionId: connId, userId: conn.userId }, "Client disconnected");
          conn.isConnected = false;
          this.connections.delete(connId);
        }
      },
    });

    app.listen(port, (listenSocket) => {
      if (listenSocket) {
        log.info({ port, host, cors: this.corsOrigin }, "WebSocket server listening");
      } else {
        log.error("Failed to start WebSocket server");
        process.exit(1);
      }
    });

    return app;
  }

  getConnectionCount(): number {
    return this.connections.size;
  }

  shutdown() {
    for (const [id, conn] of this.connections) {
      conn.close(1001, "Server shutting down");
    }
    this.connections.clear();
  }
}
