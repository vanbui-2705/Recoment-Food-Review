import { createHash } from "node:crypto";
import type { PrismaClient } from "../../generated/prisma/client.js";

export function securityNamespace(env = process.env) {
  const value = env.SECURITY_NAMESPACE?.trim() || "rec-food";
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(value)) throw new Error("Invalid SECURITY_NAMESPACE");
  return value;
}
export async function reserveQuota(
  prisma: PrismaClient,
  scope: string,
  identity: string,
  limit: number,
  windowMs: number,
  namespace = securityNamespace(),
) {
  if (
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 100000000 ||
    !Number.isSafeInteger(windowMs) ||
    windowMs < 1 ||
    windowMs > 86400000 ||
    !/^[A-Za-z0-9:_-]{1,80}$/.test(scope)
  )
    throw new Error("Invalid quota configuration");
  const key = createHash("sha256")
    .update(JSON.stringify([namespace, scope, identity]))
    .digest("hex");
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SET LOCAL statement_timeout = '2000ms'`;
      const accepted = await tx.$queryRaw<Array<{ count: number; reset_at: Date }>>`
      INSERT INTO shared_quota_buckets(key,namespace,scope,count,reset_at)
      VALUES (${key},${namespace},${scope},1,NOW()+(${windowMs}::double precision*INTERVAL '1 millisecond'))
      ON CONFLICT(key) DO UPDATE SET
        count=CASE WHEN shared_quota_buckets.reset_at<=NOW() THEN 1 ELSE shared_quota_buckets.count+1 END,
        reset_at=CASE WHEN shared_quota_buckets.reset_at<=NOW() THEN EXCLUDED.reset_at ELSE shared_quota_buckets.reset_at END
      WHERE shared_quota_buckets.reset_at<=NOW() OR shared_quota_buckets.count<${limit}
      RETURNING count,reset_at`;
      if (accepted.length)
        return { allowed: true, retryAfterSeconds: 0, count: accepted[0]!.count };
      const rows = await tx.$queryRaw<Array<{ retry: number }>>`
      SELECT GREATEST(1,CEIL(EXTRACT(EPOCH FROM(reset_at-NOW()))))::integer AS retry FROM shared_quota_buckets WHERE key=${key}`;
      return { allowed: false, retryAfterSeconds: rows[0]?.retry ?? 1, count: limit };
    },
    { maxWait: 2500, timeout: 3000 },
  );
}
