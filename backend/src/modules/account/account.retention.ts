import { randomUUID } from "node:crypto";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { serializableWrite } from "../../common/security/transaction-retry.js";
export const retention = {
  conversationsDays: 90,
  recommendationsDays: 90,
  actionsDays: 180,
  auditDays: 365,
  serverExportHours: 0,
} as const;
export function createRetentionService(prisma: PrismaClient, enabled: boolean) {
  return {
    async tick(scopeUserId?: string) {
      if (!enabled) return false;
      const name = scopeUserId ? `retention-test:${scopeUserId}` : "retention-v1",
        leaseToken = randomUUID();
      const claimed = await prisma.$queryRaw<Array<{ name: string }>>`
      INSERT INTO maintenance_leases(name,lease_token,lease_until,next_run_at) VALUES (${name},${leaseToken}::uuid,NOW()+INTERVAL '2 minutes',NOW())
      ON CONFLICT(name) DO UPDATE SET lease_token=EXCLUDED.lease_token,lease_until=EXCLUDED.lease_until
      WHERE maintenance_leases.next_run_at<=NOW() AND (maintenance_leases.lease_until IS NULL OR maintenance_leases.lease_until<=NOW()) RETURNING name`;
      if (!claimed.length) return false;
      try {
        const full = await serializableWrite(prisma, async (tx) => {
          await tx.$executeRaw`SET LOCAL statement_timeout = '3000ms'`;
          const before = (days: number) => new Date(Date.now() - days * 86400000),
            user = scopeUserId ? { userId: scopeUserId } : {};
          let more = false;
          const actionRows = await tx.userInteraction.findMany({
            where: { ...user, createdAt: { lt: before(retention.actionsDays) } },
            select: { id: true },
            take: 200,
            orderBy: { createdAt: "asc" },
          });
          if (actionRows.length)
            await tx.userInteraction.deleteMany({
              where: { id: { in: actionRows.map((row) => row.id) } },
            });
          more ||= actionRows.length === 200;
          const recipeRows = await tx.recipeInteraction.findMany({
            where: { ...user, createdAt: { lt: before(retention.actionsDays) } },
            select: { id: true },
            take: 200,
            orderBy: { createdAt: "asc" },
          });
          if (recipeRows.length)
            await tx.recipeInteraction.deleteMany({
              where: { id: { in: recipeRows.map((row) => row.id) } },
            });
          more ||= recipeRows.length === 200;
          const requests = await tx.recommendationRequest.findMany({
            where: {
              ...user,
              requestedAt: { lt: before(retention.recommendationsDays) },
              OR: [{ processingState: { not: "PROCESSING" } }, { leaseUntil: { lte: new Date() } }],
            },
            select: { id: true },
            take: 200,
            orderBy: { requestedAt: "asc" },
          });
          if (requests.length)
            await tx.recommendationRequest.deleteMany({
              where: { id: { in: requests.map((row) => row.id) } },
            });
          more ||= requests.length === 200;
          const conversations = await tx.conversation.findMany({
            where: {
              ...user,
              updatedAt: { lt: before(retention.conversationsDays) },
              runs: { none: { status: "RUNNING", leaseUntil: { gt: new Date() } } },
            },
            select: { id: true },
            take: 200,
            orderBy: { updatedAt: "asc" },
          });
          if (conversations.length)
            await tx.conversation.deleteMany({
              where: { id: { in: conversations.map((row) => row.id) } },
            });
          more ||= conversations.length === 200;
          const analysis = await tx.tasteAnalysisJob.findMany({
            where: {
              ...user,
              createdAt: { lt: before(90) },
              OR: [{ status: { not: "RUNNING" } }, { leaseUntil: { lte: new Date() } }],
            },
            select: { id: true },
            take: 200,
            orderBy: { createdAt: "asc" },
          });
          if (analysis.length)
            await tx.tasteAnalysisJob.deleteMany({
              where: { id: { in: analysis.map((row) => row.id) } },
            });
          more ||= analysis.length === 200;
          const tokens = await tx.emailActionToken.findMany({
            where: { ...user, expiresAt: { lt: before(7) } },
            select: { id: true },
            take: 200,
            orderBy: { expiresAt: "asc" },
          });
          if (tokens.length)
            await tx.emailActionToken.deleteMany({
              where: { id: { in: tokens.map((row) => row.id) } },
            });
          more ||= tokens.length === 200;
          const sessions = await tx.refreshToken.findMany({
            where: { ...user, expiresAt: { lt: before(7) } },
            select: { id: true },
            take: 200,
            orderBy: { expiresAt: "asc" },
          });
          if (sessions.length)
            await tx.refreshToken.deleteMany({
              where: { id: { in: sessions.map((row) => row.id) } },
            });
          more ||= sessions.length === 200;
          const audits = await tx.adminAudit.findMany({
            where: {
              ...(scopeUserId ? { OR: [{ actorId: scopeUserId }, { targetId: scopeUserId }] } : {}),
              createdAt: { lt: before(retention.auditDays) },
            },
            select: { id: true },
            take: 200,
            orderBy: { createdAt: "asc" },
          });
          if (audits.length)
            await tx.adminAudit.deleteMany({ where: { id: { in: audits.map((row) => row.id) } } });
          more ||= audits.length === 200;
          const reports = await tx.dataReport.findMany({
            where: {
              ...user,
              status: { in: ["RESOLVED", "DISMISSED"] },
              updatedAt: { lt: before(90) },
            },
            select: { id: true },
            take: 200,
            orderBy: { updatedAt: "asc" },
          });
          if (reports.length)
            await tx.dataReport.deleteMany({ where: { id: { in: reports.map((row) => row.id) } } });
          more ||= reports.length === 200;
          if (!scopeUserId) {
            const expiredBuckets = await tx.sharedQuotaBucket.findMany({
              where: { resetAt: { lt: before(1) } },
              select: { key: true },
              take: 200,
              orderBy: { resetAt: "asc" },
            });
            if (expiredBuckets.length)
              await tx.sharedQuotaBucket.deleteMany({
                where: { key: { in: expiredBuckets.map((row) => row.key) } },
              });
            more ||= expiredBuckets.length === 200;
            await tx.aiRequestUsage.deleteMany({
              where: { day: { lt: before(31).toISOString().slice(0, 10) } },
            });
          }
          return more;
        });
        await prisma.maintenanceLease.updateMany({
          where: { name, leaseToken, leaseUntil: { gt: new Date() } },
          data: {
            leaseToken: null,
            leaseUntil: null,
            nextRunAt: new Date(Date.now() + (full ? 30000 : 3600000)),
            lastCompletedAt: new Date(),
            lastErrorCode: null,
          },
        });
      } catch {
        await prisma.maintenanceLease.updateMany({
          where: { name, leaseToken, leaseUntil: { gt: new Date() } },
          data: {
            leaseToken: null,
            leaseUntil: null,
            nextRunAt: new Date(Date.now() + 60000),
            lastErrorCode: "RETENTION_FAILED",
          },
        });
      }
      return true;
    },
  };
}
