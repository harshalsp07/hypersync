import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default("0.0.0.0"),

  REDIS_URL: z.string().default("redis://localhost:6379"),
  PG_URL: z.string().default("postgresql://postgres:postgres@localhost:5432/hypersync"),

  JWT_SECRET: z.string().min(16).default("dev-secret-change-in-production-1234"),

  HEARTBEAT_INTERVAL_MS: z.coerce.number().default(15000),
  HEARTBEAT_TIMEOUT_MS: z.coerce.number().default(20000),
  MAX_CONNECTIONS_PER_USER: z.coerce.number().default(3),
  MAX_ROOM_SIZE: z.coerce.number().default(50),
  CORS_ORIGIN: z.string().default("*"),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | null = null;

export function getEnv(): Env {
  if (!_env) {
    _env = envSchema.parse(process.env);
  }
  return _env;
}
