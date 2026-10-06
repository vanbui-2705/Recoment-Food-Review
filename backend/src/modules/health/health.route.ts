import { Type, type FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { metricsText } from "../../common/observability/metrics.js";
import { loadAiConfig } from "../ai/ai.config.js";
import { retention } from "../account/account.retention.js";
import { securityNamespace } from "../../common/security/shared-quota.js";
import { providerHosts, providerRequestLimit } from "../discovery/provider.quota.js";

const HealthResponseSchema = Type.Object({
  status: Type.Literal("ok"),
  service: Type.String(),
  timestamp: Type.String(),
});

export const healthRoutes: FastifyPluginAsyncTypebox = async function healthRoutes(app) {
  const workerEnabled = loadAiConfig().workerEnabled;
  app.get("/privacy-policy", async (_req, reply) => {
    reply.header("Cache-Control", "no-store");
    const lease = app.hasDecorator("prisma")
      ? await app.prisma.maintenanceLease.findUnique({
          where: { name: "retention-v1" },
          select: { lastCompletedAt: true },
        })
      : null;
    const fresh = lease?.lastCompletedAt && lease.lastCompletedAt.getTime() > Date.now() - 7200000;
    return {
      data: { retention, cleanupState: !workerEnabled ? "DISABLED" : fresh ? "ACTIVE" : "PENDING" },
    };
  });
  app.get("/ready", async (_req, reply) => {
    reply.header("Cache-Control", "no-store");
    if (!app.hasDecorator("prisma"))
      return reply.status(503).send({ status: "unavailable", database: "unavailable" });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const query = app.prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SET LOCAL statement_timeout = '2000ms'`;
          await tx.$queryRaw`SELECT 1 AS ready`;
        },
        { timeout: 2500, maxWait: 1000 },
      );
      await Promise.race([
        query,
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error("Readiness timeout")), 3000);
        }),
      ]);
      return { status: "ok", database: "ready" };
    } catch {
      return reply.status(503).send({ status: "unavailable", database: "unavailable" });
    } finally {
      if (timer) clearTimeout(timer);
    }
  });
  if (app.hasDecorator("authenticate"))
    app.get(
      "/admin/metrics",
      {
        preHandler: [app.authenticate, app.requireRoles("ADMIN")],
      },
      async (_req, reply) => {
        reply.header("Cache-Control", "no-store");
        reply.type("text/plain; version=0.0.4; charset=utf-8");
        const [analysis, chat, sync, usage, email, deletion, providers, quotas, cleanup, budget] =
          await app.prisma.$transaction([
            app.prisma.tasteAnalysisJob.groupBy({
              by: ["status"],
              _count: true,
              _min: { createdAt: true },
            }),
            app.prisma.chatRun.groupBy({ by: ["status"], _count: true, _min: { createdAt: true } }),
            app.prisma.menuSyncJob.groupBy({
              by: ["status"],
              _count: true,
              _min: { createdAt: true },
            }),
            app.prisma.aiRequestCounter.findUnique({
              where: {
                namespace_day: {
                  namespace: securityNamespace(),
                  day: new Date().toISOString().slice(0, 10),
                },
              },
              select: { requests: true },
            }),
            app.prisma.emailOutbox.groupBy({
              by: ["status"],
              _count: true,
              _min: { createdAt: true },
            }),
            app.prisma.accountDeletionJob.groupBy({
              by: ["status"],
              _count: true,
              _min: { createdAt: true },
            }),
            app.prisma.providerObservation.findMany({ where: { namespace: securityNamespace() } }),
            app.prisma.sharedQuotaBucket.findMany({
              where: {
                namespace: securityNamespace(),
                scope: { startsWith: "provider:" },
                resetAt: { gt: new Date() },
              },
              select: { scope: true, count: true },
            }),
            app.prisma.maintenanceLease.findUnique({ where: { name: "retention-v1" } }),
            app.prisma.aiBudgetUsage.findUnique({
              where: {
                namespace_day: {
                  namespace: securityNamespace(),
                  day: new Date().toISOString().slice(0, 10),
                },
              },
            }),
          ]);
        const statuses = new Set([
          "QUEUED",
          "RUNNING",
          "APPLIED",
          "NEEDS_REVIEW",
          "FAILED",
          "SUPERSEDED",
          "SUCCEEDED",
          "COMPLETED",
          "CANCELLED",
          "STAGING",
          "COMMITTED",
          "ABANDONED",
          "PREVIEWED",
          "PROCESSING",
          "SENT",
        ]);
        const jobLines = ["# TYPE food_jobs gauge", "# TYPE food_oldest_job_seconds gauge"];
        for (const [kind, rows] of [
          ["analysis", analysis],
          ["chat", chat],
          ["menu_sync", sync],
          ["email", email],
          ["deletion", deletion],
        ] as const)
          for (const status of statuses) {
            const row = rows.find((row) => row.status === status);
            jobLines.push(`food_jobs{kind="${kind}",status="${status}"} ${row?._count ?? 0}`);
            jobLines.push(
              `food_oldest_job_seconds{kind="${kind}",status="${status}"} ${row?._min.createdAt ? Math.max(0, Math.floor((Date.now() - row._min.createdAt.getTime()) / 1000)) : 0}`,
            );
          }
        const providerLines = [
          "# TYPE food_background_enabled gauge",
          `food_background_enabled ${workerEnabled ? 1 : 0}`,
          "# TYPE food_ai_configured gauge",
          `food_ai_configured ${loadAiConfig().apiKey ? 1 : 0}`,
          "# TYPE food_ai_budget_reserved_usd gauge",
          `food_ai_budget_reserved_usd ${Number(budget?.reservedMicros ?? 0n) / 1000000}`,
          "# TYPE food_ai_budget_limit_usd gauge",
          `food_ai_budget_limit_usd ${loadAiConfig().dailyBudgetMicros / 1000000}`,
          "# TYPE food_provider_requests_total counter",
          "# TYPE food_provider_failures_total counter",
          "# TYPE food_provider_quota_rejections_total counter",
          "# TYPE food_provider_quota_used gauge",
          "# TYPE food_provider_quota_limit gauge",
        ];
        for (const source of Object.values(providerHosts)) {
          const observed = providers.find((row) => row.provider === source),
            quota = quotas.find((row) => row.scope === `provider:${source}`);
          providerLines.push(
            `food_provider_requests_total{source="${source}"} ${observed?.requests ?? 0}`,
            `food_provider_failures_total{source="${source}"} ${observed?.failures ?? 0}`,
            `food_provider_quota_rejections_total{source="${source}"} ${observed?.quotaRejections ?? 0}`,
            `food_provider_quota_used{source="${source}"} ${quota?.count ?? 0}`,
            `food_provider_quota_limit{source="${source}"} ${providerRequestLimit()}`,
          );
        }
        return `${metricsText()}${jobLines.join("\n")}\n${providerLines.join("\n")}\n# TYPE food_ai_requests_today gauge\nfood_ai_requests_today ${usage?.requests ?? 0}\n# TYPE food_retention_last_success_seconds gauge\nfood_retention_last_success_seconds ${cleanup?.lastCompletedAt ? Math.floor(cleanup.lastCompletedAt.getTime() / 1000) : 0}\n# TYPE food_retention_failed gauge\nfood_retention_failed ${cleanup?.lastErrorCode ? 1 : 0}\n`;
      },
    );
  app.get(
    "/health",
    {
      schema: {
        response: {
          200: HealthResponseSchema,
        },
      },
    },
    async () => ({
      status: "ok" as const,
      service: "Rec-Food Backend",
      timestamp: new Date().toISOString(),
    }),
  );
};
