import { Type, type FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { metricsText } from "../../common/observability/metrics.js";
import { loadAiConfig } from "../ai/ai.config.js";
import { retention } from "../account/account.retention.js";

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
        const [analysis, chat, sync, usage] = await app.prisma.$transaction([
          app.prisma.tasteAnalysisJob.groupBy({ by: ["status"], _count: true }),
          app.prisma.chatRun.groupBy({ by: ["status"], _count: true }),
          app.prisma.menuSyncRun.groupBy({ by: ["status"], _count: true }),
          app.prisma.aiRequestUsage.findUnique({
            where: { day: new Date().toISOString().slice(0, 10) },
            select: { requests: true },
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
          "CANCELLED",
          "STAGING",
          "COMMITTED",
          "ABANDONED",
          "PREVIEWED",
        ]);
        const jobLines = ["# TYPE food_jobs gauge"];
        for (const [kind, rows] of [
          ["analysis", analysis],
          ["chat", chat],
          ["menu_sync", sync],
        ] as const)
          for (const row of rows)
            if (statuses.has(row.status))
              jobLines.push(`food_jobs{kind="${kind}",status="${row.status}"} ${row._count}`);
        return `${metricsText()}${jobLines.join("\n")}\n# TYPE food_ai_requests_today gauge\nfood_ai_requests_today ${usage?.requests ?? 0}\n`;
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
