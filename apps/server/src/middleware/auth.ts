import jwt from "jsonwebtoken";
import { getEnv } from "../config/env.js";

export interface JWTPayload {
  userId: string;
  username: string;
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    const env = getEnv();
    const decoded = jwt.verify(token, env.JWT_SECRET) as JWTPayload;
    return decoded;
  } catch {
    return null;
  }
}

export function generateToken(payload: JWTPayload): string {
  const env = getEnv();
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: "24h" });
}
