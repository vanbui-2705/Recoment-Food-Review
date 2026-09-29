import type { FastifyReply, FastifyRequest, preHandlerAsyncHookHandler } from "fastify";

import { AppError } from "../errors/app-error.js";

type RateLimitOptions = {
  keyPrefix: string;
  limit: number;
  windowMs: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

export function createRateLimitHook(options: RateLimitOptions): preHandlerAsyncHookHandler {
  const buckets = new Map<string, Bucket>();
  let lastCleanupAt = 0;

  return async function rateLimit(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const now = Date.now();
    if (now - lastCleanupAt >= options.windowMs) {
      for (const [key, bucket] of buckets) {
        if (bucket.resetAt <= now) {
          buckets.delete(key);
        }
      }
      lastCleanupAt = now;
    }

    const key = `${options.keyPrefix}:${request.ip}`;
    const bucket = buckets.get(key);
    const current = bucket && bucket.resetAt > now ? bucket : { count: 0, resetAt: now + options.windowMs };

    if (current.count >= options.limit) {
      const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1_000));
      reply.header("Retry-After", retryAfterSeconds.toString());
      throw new AppError(429, "RATE_LIMITED", "Quá nhiều yêu cầu, vui lòng thử lại sau", [
        { retryAfterSeconds },
      ]);
    }

    current.count += 1;
    buckets.set(key, current);
  };
}
