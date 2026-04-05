import { createChildLogger } from "../utils/logger.js";
import { verifyToken } from "../middleware/auth.js";

const log = createChildLogger("rate-limiter");

export function authenticateRequest(req: any, res: any): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.writeStatus("401 Unauthorized").end("Missing token");
    return null;
  }

  const token = authHeader.slice(7);
  const payload = verifyToken(token);
  if (!payload) {
    res.writeStatus("401 Unauthorized").end("Invalid token");
    return null;
  }

  return payload.userId;
}
