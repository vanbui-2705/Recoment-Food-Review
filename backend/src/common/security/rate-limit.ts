import type { FastifyReply, FastifyRequest, preHandlerAsyncHookHandler } from "fastify";

import { AppError } from "../errors/app-error.js";
import { reserveQuota } from "./shared-quota.js";

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
    if (request.server?.hasDecorator("prisma")) {
      let reservation;
      try {
        reservation = await reserveQuota(
          request.server.prisma,
          `rate:${options.keyPrefix}`,
          request.authUser?.id ?? request.ip,
          options.limit,
          options.windowMs,
        );
      } catch {
        throw new AppError(
          503,
          "RATE_LIMIT_UNAVAILABLE",
          "Chưa kiểm tra được giới hạn yêu cầu. Vui lòng thử lại.",
        );
      }
      if (!reservation.allowed) {
        reply.header("Retry-After", String(reservation.retryAfterSeconds));
        throw new AppError(429, "RATE_LIMITED", "Quá nhiều yêu cầu, vui lòng thử lại sau", [
          { retryAfterSeconds: reservation.retryAfterSeconds },
        ]);
      }
      return;
    }
    // Database-free test applications only. Production always uses the shared counter.
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
    const current =
      bucket && bucket.resetAt > now ? bucket : { count: 0, resetAt: now + options.windowMs };

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
